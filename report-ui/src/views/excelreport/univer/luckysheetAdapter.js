/**
 * Luckysheet ↔ Univer Data Adapter
 *
 * Converts data between Luckysheet format (used by the backend/existing system)
 * and Univer IWorkbookData format.
 *
 * Luckysheet format (stored in DB as jsonStr):
 *   Array of sheet objects, each with:
 *   - name, index, status, order, row, column, celldata, config, etc.
 *   - celldata: Array of {r, c, v} where v is the cell value/style object
 *   - config.merge: {key: {r, c, rs, cs}}
 *   - config.rowlen: {rowIndex: height}
 *   - config.columnlen: {colIndex: width}
 *
 * Univer IWorkbookData format:
 *   - id, name, locale, styles
 *   - sheets: {sheetId: {id, name, cellData, mergeData, rowData, columnData, ...}}
 *   - cellData: {row: {col: {v, t, s, f, custom}}}
 *
 * Current compatibility (MVP):
 *   ✅ Cell values (text, numbers, booleans)
 *   ✅ Basic styling (background, font color, size, bold, italic, underline, strikethrough)
 *   ✅ Horizontal and vertical alignment
 *   ✅ Merge cells
 *   ✅ Row heights and column widths
 *   ✅ Formulas
 *   ✅ Custom properties (auto-expand flag)
 *   ⚠️ Borders (partial - basic support)
 *   ❌ Conditional formatting
 *   ❌ Charts
 *   ❌ Images
 *   ❌ Data validation
 *   ❌ Pivot tables
 *   ❌ Filters
 *   ❌ Frozen panes
 *   ❌ Alternating colors
 */

// Univer enum values (matching @univerjs/core)
var CellValueType = {
  STRING: 1,
  NUMBER: 2,
  BOOLEAN: 3,
  FORCE_STRING: 4
};

var HorizontalAlign = {
  UNSPECIFIED: 0,
  LEFT: 1,
  CENTER: 2,
  RIGHT: 3
};

var VerticalAlign = {
  UNSPECIFIED: 0,
  TOP: 1,
  MIDDLE: 2,
  BOTTOM: 3
};

var BooleanNumber = {
  FALSE: 0,
  TRUE: 1
};

var WrapStrategy = {
  UNSPECIFIED: 0,
  CLIP: 1,
  OVERFLOW: 2,
  WRAP: 3
};

// Luckysheet font family mapping (index → name)
var FONT_FAMILIES = [
  'Times New Roman',
  'Arial',
  'Tahoma',
  'Verdana',
  '微软雅黑',
  '宋体',
  '黑体',
  '楷体',
  '仿宋',
  '新宋体',
  '华文新魏',
  '华文行楷',
  '华文隶书'
];

/**
 * Generate a unique ID
 */
function generateId() {
  return 'id_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
}

/**
 * Convert Luckysheet horizontal alignment to Univer
 * Luckysheet: 0=center, 1=left, 2=right (based on actual usage)
 * Univer: 0=unspecified, 1=left, 2=center, 3=right
 */
function convertHAlign(ht) {
  if (ht === undefined || ht === null) return undefined;
  switch (Number(ht)) {
    case 0: return HorizontalAlign.CENTER;
    case 1: return HorizontalAlign.LEFT;
    case 2: return HorizontalAlign.RIGHT;
    default: return undefined;
  }
}

/**
 * Convert Univer horizontal alignment back to Luckysheet
 */
function revertHAlign(ht) {
  if (ht === undefined || ht === null) return undefined;
  switch (Number(ht)) {
    case HorizontalAlign.CENTER: return 0;
    case HorizontalAlign.LEFT: return 1;
    case HorizontalAlign.RIGHT: return 2;
    default: return undefined;
  }
}

/**
 * Convert Luckysheet vertical alignment to Univer
 * Luckysheet: 0=middle, 1=up(top), 2=down(bottom)
 * Univer: 0=unspecified, 1=top, 2=middle, 3=bottom
 */
function convertVAlign(vt) {
  if (vt === undefined || vt === null) return undefined;
  switch (Number(vt)) {
    case 0: return VerticalAlign.MIDDLE;
    case 1: return VerticalAlign.TOP;
    case 2: return VerticalAlign.BOTTOM;
    default: return undefined;
  }
}

/**
 * Convert Univer vertical alignment back to Luckysheet
 */
function revertVAlign(vt) {
  if (vt === undefined || vt === null) return undefined;
  switch (Number(vt)) {
    case VerticalAlign.MIDDLE: return 0;
    case VerticalAlign.TOP: return 1;
    case VerticalAlign.BOTTOM: return 2;
    default: return undefined;
  }
}

/**
 * Convert Luckysheet font family to string
 */
function convertFontFamily(ff) {
  if (ff === undefined || ff === null) return undefined;
  if (typeof ff === 'string') return ff;
  if (typeof ff === 'number' && FONT_FAMILIES[ff]) return FONT_FAMILIES[ff];
  return undefined;
}

/**
 * Convert a Luckysheet cell value object to Univer inline style
 */
function convertCellStyle(v) {
  if (!v || typeof v !== 'object') return null;

  var style = {};
  var hasStyle = false;

  // Background color
  if (v.bg) {
    style.bg = { rgb: v.bg };
    hasStyle = true;
  }

  // Font color
  if (v.fc) {
    style.cl = { rgb: v.fc };
    hasStyle = true;
  }

  // Font family
  var ff = convertFontFamily(v.ff);
  if (ff) {
    style.ff = ff;
    hasStyle = true;
  }

  // Font size
  if (v.fs !== undefined && v.fs !== null) {
    style.fs = Number(v.fs);
    hasStyle = true;
  }

  // Bold
  if (v.bl !== undefined && v.bl !== null) {
    style.bl = Number(v.bl) === 1 ? BooleanNumber.TRUE : BooleanNumber.FALSE;
    hasStyle = true;
  }

  // Italic
  if (v.it !== undefined && v.it !== null) {
    style.it = Number(v.it) === 1 ? BooleanNumber.TRUE : BooleanNumber.FALSE;
    hasStyle = true;
  }

  // Underline
  if (v.un !== undefined && v.un !== null) {
    style.ul = { s: Number(v.un) === 1 ? BooleanNumber.TRUE : BooleanNumber.FALSE };
    hasStyle = true;
  }

  // Strikethrough
  if (v.cl !== undefined && v.cl !== null) {
    style.st = { s: Number(v.cl) === 1 ? BooleanNumber.TRUE : BooleanNumber.FALSE };
    hasStyle = true;
  }

  // Horizontal alignment
  var hAlign = convertHAlign(v.ht);
  if (hAlign !== undefined) {
    style.ht = hAlign;
    hasStyle = true;
  }

  // Vertical alignment
  var vAlign = convertVAlign(v.vt);
  if (vAlign !== undefined) {
    style.vt = vAlign;
    hasStyle = true;
  }

  // Text wrap
  if (v.tb !== undefined && v.tb !== null) {
    style.tb = Number(v.tb) === 1 ? WrapStrategy.WRAP : WrapStrategy.CLIP;
    hasStyle = true;
  }

  return hasStyle ? style : null;
}

/**
 * Convert Univer style back to Luckysheet cell properties
 */
function revertCellStyle(style) {
  if (!style || typeof style !== 'object') return {};
  var props = {};

  if (style.bg && style.bg.rgb) props.bg = style.bg.rgb;
  if (style.cl && style.cl.rgb) props.fc = style.cl.rgb;
  if (style.ff) props.ff = style.ff;
  if (style.fs !== undefined) props.fs = style.fs;
  if (style.bl !== undefined) props.bl = style.bl === BooleanNumber.TRUE ? 1 : 0;
  if (style.it !== undefined) props.it = style.it === BooleanNumber.TRUE ? 1 : 0;
  if (style.ul && style.ul.s !== undefined) props.un = style.ul.s === BooleanNumber.TRUE ? 1 : 0;
  if (style.st && style.st.s !== undefined) props.cl = style.st.s === BooleanNumber.TRUE ? 1 : 0;

  var ht = revertHAlign(style.ht);
  if (ht !== undefined) props.ht = ht;

  var vt = revertVAlign(style.vt);
  if (vt !== undefined) props.vt = vt;

  if (style.tb !== undefined) {
    props.tb = style.tb === WrapStrategy.WRAP ? 1 : 0;
  }

  return props;
}

/**
 * Determine Univer CellValueType from a Luckysheet cell
 */
function getCellValueType(v) {
  if (!v) return undefined;
  if (v.ct && v.ct.t) {
    switch (v.ct.t) {
      case 'n': return CellValueType.NUMBER;
      case 's': return CellValueType.STRING;
      case 'b': return CellValueType.BOOLEAN;
      case 'g': return undefined; // general - let Univer decide
      default: return undefined;
    }
  }
  // Infer from value
  var val = v.v;
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'number') return CellValueType.NUMBER;
  if (typeof val === 'boolean') return CellValueType.BOOLEAN;
  if (typeof val === 'string') {
    if (!isNaN(Number(val)) && val.trim() !== '') return CellValueType.NUMBER;
    return CellValueType.STRING;
  }
  return undefined;
}

/**
 * Convert Luckysheet sheets array to Univer IWorkbookData
 *
 * @param {Array} luckySheets - Array of Luckysheet sheet objects
 * @returns {Object} Univer IWorkbookData
 */
export function luckysheetToUniver(luckySheets) {
  if (!luckySheets || !Array.isArray(luckySheets) || luckySheets.length === 0) {
    return createEmptyWorkbook();
  }

  var workbookId = generateId();
  var sheets = {};
  var sheetOrder = [];
  var styles = {};
  var styleIndex = 0;
  var styleKeyMap = {}; // Map of JSON-stringified style → style ID for O(1) dedup

  luckySheets.forEach(function (luckySheet, idx) {
    var sheetId = luckySheet.index !== undefined ? String(luckySheet.index) : generateId();
    var sheetName = luckySheet.name || ('Sheet' + (idx + 1));

    // Convert celldata to Univer cellData format
    var cellData = {};
    var cellDataArr = luckySheet.celldata || [];

    cellDataArr.forEach(function (cell) {
      var r = cell.r;
      var c = cell.c;
      var v = cell.v;

      if (!cellData[r]) cellData[r] = {};

      var univerCell = {};

      if (v === null || v === undefined) {
        cellData[r][c] = univerCell;
        return;
      }

      // Handle simple value (not an object)
      if (typeof v !== 'object') {
        univerCell.v = v;
        cellData[r][c] = univerCell;
        return;
      }

      // Raw value
      if (v.v !== undefined && v.v !== null) {
        univerCell.v = v.v;
      } else if (v.m !== undefined && v.m !== null) {
        univerCell.v = v.m;
      }

      // Cell value type
      var vType = getCellValueType(v);
      if (vType) {
        univerCell.t = vType;
      }

      // Formula
      if (v.f) {
        univerCell.f = v.f;
      }

      // Style
      var style = convertCellStyle(v);
      if (style) {
        var styleKey = JSON.stringify(style);
        // De-duplicate styles using pre-built map for O(1) lookup
        if (styleKeyMap[styleKey]) {
          univerCell.s = styleKeyMap[styleKey];
        } else {
          var newId = 's_' + styleIndex++;
          styles[newId] = style;
          styleKeyMap[styleKey] = newId;
          univerCell.s = newId;
        }
      }

      // Custom properties (auto-expand, etc.)
      if (v.auto) {
        univerCell.custom = { auto: v.auto };
      }

      cellData[r][c] = univerCell;
    });

    // Convert merge config
    var mergeData = [];
    var mergeConfig = (luckySheet.config && luckySheet.config.merge) || {};
    for (var key in mergeConfig) {
      var m = mergeConfig[key];
      if (m && m.r !== undefined && m.c !== undefined) {
        mergeData.push({
          startRow: m.r,
          startColumn: m.c,
          endRow: m.r + (m.rs || 1) - 1,
          endColumn: m.c + (m.cs || 1) - 1
        });
      }
    }

    // Convert row heights
    var rowData = {};
    var rowlenConfig = (luckySheet.config && luckySheet.config.rowlen) || {};
    for (var rowIdx in rowlenConfig) {
      rowData[rowIdx] = { h: rowlenConfig[rowIdx], ah: rowlenConfig[rowIdx] };
    }

    // Convert column widths
    var columnData = {};
    var columnlenConfig = (luckySheet.config && luckySheet.config.columnlen) || {};
    for (var colIdx in columnlenConfig) {
      columnData[colIdx] = { w: columnlenConfig[colIdx] };
    }

    // Handle hidden rows
    var rowHiddenConfig = (luckySheet.config && luckySheet.config.rowhidden) || {};
    for (var hiddenRow in rowHiddenConfig) {
      if (!rowData[hiddenRow]) rowData[hiddenRow] = {};
      rowData[hiddenRow].hd = BooleanNumber.TRUE;
    }

    // Handle hidden columns
    var colHiddenConfig = (luckySheet.config && luckySheet.config.colhidden) || {};
    for (var hiddenCol in colHiddenConfig) {
      if (!columnData[hiddenCol]) columnData[hiddenCol] = {};
      columnData[hiddenCol].hd = BooleanNumber.TRUE;
    }

    var univerSheet = {
      id: sheetId,
      name: sheetName,
      cellData: cellData,
      mergeData: mergeData.length > 0 ? mergeData : undefined,
      rowCount: luckySheet.row || 36,
      columnCount: luckySheet.column || 18,
      defaultRowHeight: luckySheet.defaultRowHeight || 19,
      defaultColumnWidth: luckySheet.defaultColWidth || 73,
      rowData: Object.keys(rowData).length > 0 ? rowData : undefined,
      columnData: Object.keys(columnData).length > 0 ? columnData : undefined,
      showGridLines: luckySheet.showGridLines !== undefined ? luckySheet.showGridLines : 1,
      tabColor: luckySheet.color || '',
      hidden: luckySheet.hide === 1 ? BooleanNumber.TRUE : BooleanNumber.FALSE,
      status: luckySheet.status || 0
    };

    sheets[sheetId] = univerSheet;
    sheetOrder.push(sheetId);
  });

  return {
    id: workbookId,
    name: 'Workbook',
    appVersion: '1.0.0',
    locale: 'zhCN',
    styles: Object.keys(styles).length > 0 ? styles : {},
    sheets: sheets,
    sheetOrder: sheetOrder
  };
}

/**
 * Convert Univer workbook snapshot back to Luckysheet sheets array
 *
 * @param {Object} workbookData - Univer IWorkbookData (from workbook.save() or getSnapshot())
 * @returns {Array} Array of Luckysheet sheet objects
 */
export function univerToLuckysheet(workbookData) {
  if (!workbookData || !workbookData.sheets) {
    return [{}];
  }

  var sheets = workbookData.sheets;
  var stylesMap = workbookData.styles || {};
  var sheetOrder = workbookData.sheetOrder || Object.keys(sheets);
  var result = [];

  sheetOrder.forEach(function (sheetId, orderIdx) {
    var uniSheet = sheets[sheetId];
    if (!uniSheet) return;

    // Convert cellData back to celldata array
    var celldata = [];
    var cellDataObj = uniSheet.cellData || {};

    for (var rowStr in cellDataObj) {
      var row = Number(rowStr);
      var rowObj = cellDataObj[rowStr];
      for (var colStr in rowObj) {
        var col = Number(colStr);
        var uniCell = rowObj[colStr];

        if (!uniCell) continue;

        var luckyV = {};

        // Value
        if (uniCell.v !== undefined && uniCell.v !== null) {
          luckyV.v = uniCell.v;
          luckyV.m = String(uniCell.v);
        }

        // Formula
        if (uniCell.f) {
          luckyV.f = uniCell.f;
        }

        // Cell type
        if (uniCell.t !== undefined) {
          switch (uniCell.t) {
            case CellValueType.NUMBER:
              luckyV.ct = { fa: 'General', t: 'n' };
              if (luckyV.v !== undefined) luckyV.v = Number(luckyV.v);
              break;
            case CellValueType.STRING:
            case CellValueType.FORCE_STRING:
              luckyV.ct = { fa: 'General', t: 's' };
              break;
            case CellValueType.BOOLEAN:
              luckyV.ct = { fa: 'General', t: 'b' };
              break;
          }
        }

        // Style (resolve from styles map or inline)
        var style = null;
        if (uniCell.s) {
          if (typeof uniCell.s === 'string') {
            style = stylesMap[uniCell.s];
          } else if (typeof uniCell.s === 'object') {
            style = uniCell.s;
          }
        }
        if (style) {
          var revertedStyle = revertCellStyle(style);
          for (var prop in revertedStyle) {
            luckyV[prop] = revertedStyle[prop];
          }
        }

        // Custom properties
        if (uniCell.custom && uniCell.custom.auto) {
          luckyV.auto = uniCell.custom.auto;
        }

        celldata.push({ r: row, c: col, v: luckyV });
      }
    }

    // Convert mergeData to Luckysheet merge config
    var merge = {};
    if (uniSheet.mergeData && uniSheet.mergeData.length > 0) {
      uniSheet.mergeData.forEach(function (m) {
        var key = m.startRow + '_' + m.startColumn;
        merge[key] = {
          r: m.startRow,
          c: m.startColumn,
          rs: m.endRow - m.startRow + 1,
          cs: m.endColumn - m.startColumn + 1
        };
      });
    }

    // Convert rowData to rowlen
    var rowlen = {};
    var rowhidden = {};
    if (uniSheet.rowData) {
      for (var rIdx in uniSheet.rowData) {
        var rd = uniSheet.rowData[rIdx];
        if (rd.h !== undefined) rowlen[rIdx] = rd.h;
        if (rd.hd === BooleanNumber.TRUE) rowhidden[rIdx] = 0;
      }
    }

    // Convert columnData to columnlen
    var columnlen = {};
    var colhidden = {};
    if (uniSheet.columnData) {
      for (var cIdx in uniSheet.columnData) {
        var cd = uniSheet.columnData[cIdx];
        if (cd.w !== undefined) columnlen[cIdx] = cd.w;
        if (cd.hd === BooleanNumber.TRUE) colhidden[cIdx] = 0;
      }
    }

    var luckySheet = {
      name: uniSheet.name || ('Sheet' + (orderIdx + 1)),
      color: uniSheet.tabColor || '',
      index: sheetId,
      status: orderIdx === 0 ? 1 : 0,
      order: orderIdx,
      hide: uniSheet.hidden === BooleanNumber.TRUE ? 1 : 0,
      row: uniSheet.rowCount || 36,
      column: uniSheet.columnCount || 18,
      defaultRowHeight: uniSheet.defaultRowHeight || 19,
      defaultColWidth: uniSheet.defaultColumnWidth || 73,
      celldata: celldata,
      config: {
        merge: merge,
        rowlen: rowlen,
        columnlen: columnlen,
        rowhidden: rowhidden,
        colhidden: colhidden,
        borderInfo: {},
        authority: {}
      },
      scrollLeft: 0,
      scrollTop: 0,
      luckysheet_select_save: [],
      calcChain: [],
      isPivotTable: false,
      pivotTable: {},
      filter_select: {},
      filter: null,
      luckysheet_alternateformat_save: [],
      luckysheet_alternateformat_save_modelCustom: [],
      luckysheet_conditionformat_save: {},
      frozen: {},
      chart: [],
      zoomRatio: 1,
      image: [],
      showGridLines: uniSheet.showGridLines !== undefined ? uniSheet.showGridLines : 1,
      dataVerification: {},
      data: []
    };

    result.push(luckySheet);
  });

  return result.length > 0 ? result : [{}];
}

/**
 * Create an empty Univer workbook
 */
export function createEmptyWorkbook() {
  var sheetId = generateId();
  return {
    id: generateId(),
    name: 'Workbook',
    appVersion: '1.0.0',
    locale: 'zhCN',
    styles: {},
    sheets: {
      [sheetId]: {
        id: sheetId,
        name: 'Sheet1',
        cellData: {},
        rowCount: 36,
        columnCount: 18,
        defaultRowHeight: 19,
        defaultColumnWidth: 73
      }
    },
    sheetOrder: [sheetId]
  };
}
