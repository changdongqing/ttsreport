<!--
 * Univer Viewer Page
 * Migrated from the Luckysheet-based viewer (excelreport/viewer)
 * Uses Univer for read-only spreadsheet display
 -->
<template>
  <div class="layout">
    <div class="layout-top">
      <div v-if="hasQueryConditions" class="query-conditions">
        <div
          v-for="(son, y) in flatParams"
          :key="y + 'excel'"
          class="condition-item"
        >
          <span class="condition-label">{{ son.name }}</span>
          <el-date-picker
            v-if="son.paramType === '日期'"
            v-model="son.value"
            type="date"
            size="small"
            value-format="yyyy-MM-dd"
            style="width:180px"
          />
          <el-time-picker
            v-else-if="son.paramType === '时间'"
            v-model="son.value"
            size="small"
            value-format="HH:mm:ss"
            style="width:160px"
          />
          <el-date-picker
            v-else-if="son.paramType === '日期时间'"
            v-model="son.value"
            type="datetime"
            size="small"
            value-format="yyyy-MM-dd HH:mm:ss"
            style="width:200px"
          />
          <el-input-number
            v-else-if="son.paramType === '数字输入框'"
            v-model="son.value"
            size="small"
            controls-position="right"
          />
          <el-select
            v-else-if="son.paramType === '选择器'"
            v-model="son.value"
            size="small"
            clearable
            style="width:160px"
          >
            <template v-if="son.dictCode && son.dictOptions && son.dictOptions.length">
              <el-option
                v-for="opt in son.dictOptions"
                :key="opt.id"
                :label="opt.text"
                :value="opt.id"
              />
            </template>
            <template v-else>
              <el-option
                v-for="opt in son.extParamOptions"
                :key="opt.value"
                :label="opt.key"
                :value="opt.value"
              />
            </template>
          </el-select>
          <el-input v-else v-model="son.value" size="small" />
        </div>
      </div>
      <div class="action-buttons">
        <el-button type="primary" size="small" @click="searchPreview">查询</el-button>
        <el-button v-if="reportCode != null" size="small" @click="download('gaea_template_excel')">
          <i class="iconfont iconexcel"></i> 导出excel
        </el-button>
        <el-button v-if="reportCode != null" size="small" @click="download('gaea_template_pdf')">
          <i class="iconfont iconpdf"></i> 导出pdf
        </el-button>
      </div>
    </div>
    <div class="layout-middle">
      <div v-if="loading" class="loading-mask">
        <i class="el-icon-loading"></i>
        <span>正在加载预览...</span>
      </div>
      <div
        id="univer-viewer-container"
        style="margin:0;padding:0;width:100%;height:100%;"
      />
    </div>
    <div class="layout-bottom">
      <el-pagination
        :current-page.sync="currentPage"
        :page-sizes="[10, 20, 50, 100]"
        :page-size.sync="pageSize"
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </div>
</template>

<script>
import { preview, exportExcel, detailBysetCode } from "@/api/GaeaReport";
import { getDictList } from "@/api/dict-data";
import { getAccessUser } from "@/utils/auth";
import { luckysheetToUniver } from "../univer/luckysheetAdapter";
import { createUniverSheet, destroyUniver } from "../univer/univerService";

export default {
  name: "ViewerUniver",
  computed: {
    hasQueryConditions() {
      return this.flatParams.length > 0;
    }
  },
  data() {
    return {
      loading: true,
      reportId: null,
      reportCode: null,
      reportName: null,
      dataSet: null,
      tableData2: [],
      flatParams: [],
      excelData: {},
      sheetData: [],
      allData: [],
      currentPage: 1,
      pageSize: 20,
      total: 0,
      headerRowCount: 1,
      params: {
        reportCode: "",
        setParam: ""
      },
      paramMetaMap: {},
      dictOptionsCache: {},
      // Univer instances
      univerInstance: null,
      univerAPI: null,
      workbook: null,
    };
  },
  mounted() {
    this.loadPreview();
  },
  created() {
    this.reportCode = this.$route.query.reportCode;
  },
  beforeDestroy() {
    if (this.univerInstance) {
      destroyUniver(this.univerInstance);
      this.univerInstance = null;
      this.univerAPI = null;
      this.workbook = null;
    }
  },
  methods: {
    handleSizeChange(val) {
      this.pageSize = val;
      this.currentPage = 1;
      this.renderSheetData();
    },
    handleCurrentChange(val) {
      this.currentPage = val;
      this.renderSheetData();
    },

    /**
     * Render paginated sheet data using Univer
     */
    async renderSheetData() {
      if (!this.sheetData || this.sheetData.length === 0) {
        this.total = 0;
        this.currentPage = 1;
        return;
      }

      var sheet = JSON.parse(JSON.stringify(this.sheetData[0]));
      var celldata = sheet.celldata || [];
      var headerRowCount = this.headerRowCount;

      // Separate header and data cells
      var dataRows = [];
      var headerCells = [];
      celldata.forEach(function (cell) {
        if (cell.r < headerRowCount) {
          headerCells.push(cell);
        } else {
          dataRows.push(cell);
        }
      });

      // Group data cells by row
      var rowMap = {};
      dataRows.forEach(function (cell) {
        if (!rowMap[cell.r]) rowMap[cell.r] = [];
        rowMap[cell.r].push(cell);
      });
      var sortedRowKeys = Object.keys(rowMap).map(Number).sort(function (a, b) { return a - b; });

      this.total = sortedRowKeys.length;

      // Slice for current page
      var start = (this.currentPage - 1) * this.pageSize;
      var end = start + this.pageSize;
      var pageRowKeys = sortedRowKeys.slice(start, end);

      // Rebuild celldata: header cells + paginated data cells with re-indexed rows
      var newCelldata = [].concat(headerCells);
      pageRowKeys.forEach(function (origRow, idx) {
        var newRow = headerRowCount + idx;
        rowMap[origRow].forEach(function (cell) {
          newCelldata.push(Object.assign({}, cell, { r: newRow }));
        });
      });

      // Build a new sheet with paginated data
      var newSheet = JSON.parse(JSON.stringify(sheet));
      newSheet.celldata = newCelldata;
      newSheet.row = headerRowCount + pageRowKeys.length + 5;

      // Remap merge config for paginated rows
      if (sheet.config && sheet.config.merge) {
        var newMerge = {};
        for (var key in sheet.config.merge) {
          var m = sheet.config.merge[key];
          if (m.r < headerRowCount) {
            newMerge[key] = m;
          }
        }
        for (var key2 in sheet.config.merge) {
          var m2 = sheet.config.merge[key2];
          if (m2.r >= headerRowCount) {
            var pageIdx = pageRowKeys.indexOf(m2.r);
            if (pageIdx !== -1) {
              var newRow2 = headerRowCount + pageIdx;
              var newKey = newRow2 + '_' + m2.c;
              newMerge[newKey] = Object.assign({}, m2, { r: newRow2 });
            }
          }
        }
        newSheet.config = Object.assign({}, newSheet.config, { merge: newMerge });
      }

      // Remap rowlen config
      if (sheet.config && sheet.config.rowlen) {
        var newRowlen = {};
        for (var rk in sheet.config.rowlen) {
          var rowIdx = Number(rk);
          if (rowIdx < headerRowCount) {
            newRowlen[rk] = sheet.config.rowlen[rk];
          }
        }
        pageRowKeys.forEach(function (origRow, idx) {
          var nr = headerRowCount + idx;
          if (sheet.config.rowlen[origRow] !== undefined) {
            newRowlen[nr] = sheet.config.rowlen[origRow];
          }
        });
        newSheet.config = Object.assign({}, newSheet.config, { rowlen: newRowlen });
      }

      // Create Univer sheet with paginated data
      await this.createUniverViewer([newSheet]);
    },

    /**
     * Create or recreate the Univer viewer
     */
    async createUniverViewer(sheetDataOverride) {
      try {
        // Destroy existing instance
        if (this.univerInstance) {
          destroyUniver(this.univerInstance);
          this.univerInstance = null;
          this.univerAPI = null;
          this.workbook = null;
          // Clear the container
          var container = document.getElementById('univer-viewer-container');
          if (container) {
            container.innerHTML = '';
          }
        }

        var data = sheetDataOverride || this.sheetData;
        var workbookData = luckysheetToUniver(data);

        var result = await createUniverSheet({
          container: "univer-viewer-container",
          workbookData: workbookData,
          editable: false,
        });

        this.univerInstance = result.univer;
        this.univerAPI = result.univerAPI;
        this.workbook = result.workbook;
        this.loading = false;
      } catch (e) {
        console.error("Failed to create Univer viewer:", e);
        this.loading = false;
        this.$message.error("加载预览失败: " + e.message);
      }
    },

    async searchPreview() {
      var arr = this.buildSetParamObj();
      this.params.setParam = JSON.stringify(arr);
      this.loadPreview();
    },

    async loadPreview() {
      this.loading = true;
      this.excelData = {};
      this.params.reportCode = this.reportCode;
      var result = await preview(this.params);
      var code = result.code;
      var data = result.data;
      if (code != 200) {
        this.loading = false;
        return;
      }
      this.reportName = data.reportName || '';

      // Parse setParam for query conditions
      var setParamObj = null;
      try {
        setParamObj = data.setParam ? JSON.parse(data.setParam) : null;
      } catch (e) {
        console.error('Failed to parse setParam:', data.setParam, e);
        setParamObj = null;
      }
      this.params.setParam = data.setParam || '';
      var extendObj = setParamObj;

      // Fetch dataset param metadata
      for (var setCode in (extendObj || {})) {
        if (!this.paramMetaMap[setCode]) {
          try {
            var metaResult = await detailBysetCode(setCode);
            if (metaResult.code == 200 && metaResult.data && metaResult.data.dataSetParamDtoList) {
              this.paramMetaMap[setCode] = {};
              for (var pi = 0; pi < metaResult.data.dataSetParamDtoList.length; pi++) {
                var param = metaResult.data.dataSetParamDtoList[pi];
                this.paramMetaMap[setCode][param.paramName] = {
                  paramType: param.paramType,
                  dictCode: param.dictCode,
                  extParam: param.extParam
                };
                if (param.dictCode && !this.dictOptionsCache[param.dictCode]) {
                  try {
                    var dictResult = await getDictList(param.dictCode);
                    if (dictResult.code == 200) {
                      this.dictOptionsCache[param.dictCode] = dictResult.data || [];
                    }
                  } catch (e2) {
                    this.dictOptionsCache[param.dictCode] = [];
                  }
                }
              }
            }
          } catch (e3) {
            this.paramMetaMap[setCode] = {};
          }
        }
      }

      // Build query conditions UI
      var extendArray = [];
      for (var i in (extendObj || {})) {
        var children = [];
        for (var y in extendObj[i]) {
          var meta = (this.paramMetaMap[i] && this.paramMetaMap[i][y]) || {};
          var dictCode = meta.dictCode || '';
          var dictOptions = dictCode ? (this.dictOptionsCache[dictCode] || []) : [];
          var extParamOptions = [];
          if (!dictCode && meta.extParam) {
            try {
              extParamOptions = JSON.parse(meta.extParam) || [];
            } catch (e4) {
              extParamOptions = [];
            }
          }
          children.push({
            name: y,
            value: this.resolveParamValue(extendObj[i][y]),
            paramType: meta.paramType || '输入框',
            dictCode: dictCode,
            dictOptions: dictOptions,
            extParamOptions: extParamOptions
          });
        }
        extendArray.push({ name: i, children: children });
      }
      this.tableData2 = extendArray;
      this.flatParams = this.buildFlatParams();

      this.excelData = data.jsonStr;
      this.sheetData = (data && data.jsonStr) ? JSON.parse(data.jsonStr) : [{}];

      // Determine header row count
      if (this.sheetData && this.sheetData.length > 0) {
        var celldata = this.sheetData[0].celldata || [];
        this.headerRowCount = celldata.length > 0 ? 1 : 0;
      }

      this.currentPage = 1;
      this.renderSheetData();
    },

    async download(val) {
      var extend = '.xlsx';
      var downloadResult = {};
      downloadResult["reportCode"] = this.reportCode;
      downloadResult["setParam"] = this.params.setParam || '';
      if (val != "") {
        downloadResult["exportType"] = val;
        if (val === "gaea_template_pdf") {
          extend = '.pdf';
        }
      }
      // Note: getCellStyleData uses Luckysheet API which is not available in Univer viewer.
      // Export uses the backend's data, so styling from the live view is not needed for basic export.
      var fileName = this.reportCode + extend;
      var self = this;
      exportExcel(downloadResult).then(function (res) {
        var type = res.type;
        if (type == "application/json") {
          var reader = new FileReader();
          reader.readAsText(res, "utf-8");
          reader.onload = function () {
            var data = JSON.parse(reader.result);
            self.$message.error(data.message);
          };
          return;
        }

        var blob = new Blob([res], { type: "application/octet-stream" });
        if (window.navigator.msSaveOrOpenBlob) {
          navigator.msSaveBlob(blob, fileName);
        } else {
          var link = document.createElement("a");
          link.href = window.URL.createObjectURL(blob);
          link.download = fileName;
          link.click();
          window.URL.revokeObjectURL(link.href);
        }
      });
    },

    buildFlatParams() {
      var seen = new Set();
      var flat = [];
      for (var item of this.tableData2) {
        for (var child of (item.children || [])) {
          if (!seen.has(child.name)) {
            seen.add(child.name);
            flat.push(child);
          }
        }
      }
      return flat;
    },
    buildSetParamObj() {
      var valueMap = {};
      this.flatParams.forEach(function (p) { valueMap[p.name] = p.value; });
      var result = {};
      this.tableData2.forEach(function (item) {
        if (item.name) {
          var newObj = {};
          (item.children || []).forEach(function (child) {
            newObj[child.name] = Object.prototype.hasOwnProperty.call(valueMap, child.name)
              ? valueMap[child.name]
              : child.value;
          });
          result[item.name] = newObj;
        }
      });
      return result;
    },
    resolveParamValue(value) {
      if (!value || typeof value !== 'string' || !value.startsWith('@')) return value;
      var now = new Date();
      var fmt = function (d) {
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
      };
      switch (value) {
        case '@当天': return fmt(now);
        case '@昨天': { var d1 = new Date(now); d1.setDate(d1.getDate() - 1); return fmt(d1); }
        case '@当月第一天': return fmt(new Date(now.getFullYear(), now.getMonth(), 1));
        case '@当月最后一天': return fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        case '@上月第一天': return fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        case '@上月最后一天': return fmt(new Date(now.getFullYear(), now.getMonth(), 0));
        case '@当年第一天': return fmt(new Date(now.getFullYear(), 0, 1));
        case '@当年最后一天': return fmt(new Date(now.getFullYear(), 11, 31));
        case '@当前登录用户': {
          const user = getAccessUser();
          return (user && user.loginName) ? user.loginName : '';
        }
        case '@当前登录用户部门': {
          const user = getAccessUser();
          return (user && user.deptName) ? user.deptName : '';
        }
        default: return value;
      }
    },
    toObject(val) {
      var objfirst = {};
      var objSecond = {};
      val.forEach(function (el) {
        if (el.name) objfirst[el.name] = el.children;
      });
      for (var key in objfirst) {
        var newObj = {};
        objfirst[key].map(function (ev) {
          newObj[ev.name] = ev.value;
        });
        objSecond[key] = newObj;
      }
      return objSecond;
    },
  }
};
</script>

<style scoped lang="scss">
.loading-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  z-index: 200;
  font-size: 16px;
  color: #409eff;

  i {
    font-size: 32px;
    margin-bottom: 10px;
  }
}

.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.layout-top {
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid #e8eaec;
  padding: 10px 15px;
  z-index: 10;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);

  .query-conditions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 10px;

    .condition-item {
      display: flex;
      align-items: center;

      .condition-label {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        height: 32px;
        padding-right: 8px;
        white-space: nowrap;
        font-size: 14px;
        color: #606266;
      }
    }
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 20px;

    .el-button + .el-button {
      margin-left: 0;
    }
  }
}

.layout-middle {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.layout-bottom {
  flex-shrink: 0;
  background: #fff;
  border-top: 1px solid #e8eaec;
  padding: 8px 15px;
  text-align: right;
  z-index: 10;
}
</style>
