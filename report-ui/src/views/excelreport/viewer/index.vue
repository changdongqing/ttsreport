<!--
 * @Descripttion:
 * @Author: qianlishi
 * @Date: 2021-3-19 10:23:24
 * @Last Modified by:   Raod
 * @Last Modified time: 2022-1-26 11:04:24
 !-->
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
      <div
        id="luckysheet"
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

export default {
  name: "Login",
  components: {},
  computed: {
    hasQueryConditions() {
      return this.flatParams.length > 0;
    }
  },
  data() {
    return {
      options: {},
      sheet: {},
      reportId: null,
      reportCode: null,
      reportName: null,
      dataSet: null,
      tableData2: [],
      flatParams: [], // deduplicated flat param list for UI display
      excelData: {},
      allData: [], // 所有原始数据行
      currentPage: 1, // 当前页码
      pageSize: 20, // 每页条数
      total: 0, // 总条数
      headerRowCount: 1, // 表头行数（不参与分页）
      params: {
        reportCode: "",
        setParam: ""
      },
      paramMetaMap: {}, // { setCode: { paramName: { paramType, dictCode, extParam } } }
      dictOptionsCache: {} // { dictCode: [options] }
    };
  },
  mounted() {
    this.preview();
  },
  created() {
    this.reportCode = this.$route.query.reportCode;
  },
  beforeDestroy() {
    // 移除事件监听器，避免内存泄漏
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
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
    renderSheetData() {
      if (!this.sheetData || this.sheetData.length === 0) {
        this.total = 0;
        this.currentPage = 1;
        return;
      }
      const sheet = JSON.parse(JSON.stringify(this.sheetData[0]));
      const celldata = sheet.celldata || [];
      const headerRowCount = this.headerRowCount;

      // Get data rows (rows after headers)
      const dataRows = [];
      const headerCells = [];
      celldata.forEach(cell => {
        if (cell.r < headerRowCount) {
          headerCells.push(cell);
        } else {
          dataRows.push(cell);
        }
      });

      // Group data cells by row
      const rowMap = {};
      dataRows.forEach(cell => {
        if (!rowMap[cell.r]) rowMap[cell.r] = [];
        rowMap[cell.r].push(cell);
      });
      const sortedRowKeys = Object.keys(rowMap).map(Number).sort((a, b) => a - b);

      this.total = sortedRowKeys.length;

      // Slice for current page
      const start = (this.currentPage - 1) * this.pageSize;
      const end = start + this.pageSize;
      const pageRowKeys = sortedRowKeys.slice(start, end);

      // Rebuild celldata: header cells + paginated data cells with re-indexed rows
      const newCelldata = [...headerCells];
      pageRowKeys.forEach((origRow, idx) => {
        const newRow = headerRowCount + idx;
        rowMap[origRow].forEach(cell => {
          newCelldata.push({ ...cell, r: newRow });
        });
      });

      // Build a new sheet with paginated data
      const newSheet = JSON.parse(JSON.stringify(sheet));
      newSheet.celldata = newCelldata;
      // Add extra rows for Luckysheet rendering buffer
      newSheet.row = headerRowCount + pageRowKeys.length + 5;

      // Remap merge config for paginated rows
      if (sheet.config && sheet.config.merge) {
        const newMerge = {};
        for (const key in sheet.config.merge) {
          const m = sheet.config.merge[key];
          if (m.r < headerRowCount) {
            newMerge[key] = m;
          }
        }
        // Add merges for paginated data rows
        for (const key in sheet.config.merge) {
          const m = sheet.config.merge[key];
          if (m.r >= headerRowCount) {
            const origRow = m.r;
            const pageIdx = pageRowKeys.indexOf(origRow);
            if (pageIdx !== -1) {
              const newRow = headerRowCount + pageIdx;
              const newKey = newRow + '_' + m.c;
              newMerge[newKey] = { ...m, r: newRow };
            }
          }
        }
        newSheet.config = { ...newSheet.config, merge: newMerge };
      }

      // Remap rowlen config for paginated rows
      if (sheet.config && sheet.config.rowlen) {
        const newRowlen = {};
        for (const key in sheet.config.rowlen) {
          const rowIdx = Number(key);
          if (rowIdx < headerRowCount) {
            newRowlen[key] = sheet.config.rowlen[key];
          }
        }
        pageRowKeys.forEach((origRow, idx) => {
          const newRow = headerRowCount + idx;
          if (sheet.config.rowlen[origRow] !== undefined) {
            newRowlen[newRow] = sheet.config.rowlen[origRow];
          }
        });
        newSheet.config = { ...newSheet.config, rowlen: newRowlen };
      }

      this.createSheet([newSheet]);
    },
    async searchPreview() {
      const arr = this.buildSetParamObj();
      this.params.setParam = JSON.stringify(arr);
      //每次都重新加载需要改成刷新
      this.preview();
    },
    async preview() {
      this.excelData = {};
      this.params.reportCode = this.reportCode;
      const { code, data } = await preview(this.params);
      if (code != 200) return;
      this.reportName = data.reportName || '';
      // 渲染查询表单
      let setParamObj = null;
      try {
        setParamObj = data.setParam ? JSON.parse(data.setParam) : null;
      } catch (e) {
        console.error('Failed to parse setParam:', e);
        setParamObj = null;
      }
      this.params.setParam = data.setParam || '';
      const extendObj = setParamObj;

      // Fetch dataset param metadata (paramType, dictCode, extParam) for each setCode
      for (const setCode in (extendObj || {})) {
        if (!this.paramMetaMap[setCode]) {
          try {
            const result = await detailBysetCode(setCode);
            if (result.code == 200 && result.data && result.data.dataSetParamDtoList) {
              this.paramMetaMap[setCode] = {};
              for (const param of result.data.dataSetParamDtoList) {
                this.paramMetaMap[setCode][param.paramName] = {
                  paramType: param.paramType,
                  dictCode: param.dictCode,
                  extParam: param.extParam,
                  sampleItem: param.sampleItem,
                  defaultValue: param.defaultValue
                };
                // Pre-fetch dict options
                if (param.dictCode && !this.dictOptionsCache[param.dictCode]) {
                  try {
                    const dictResult = await getDictList(param.dictCode);
                    if (dictResult.code == 200) {
                      this.dictOptionsCache[param.dictCode] = dictResult.data || [];
                    }
                  } catch (e) {
                    console.error('Failed to fetch dict options for', param.dictCode, e);
                    this.dictOptionsCache[param.dictCode] = [];
                  }
                }
              }
            }
          } catch (e) {
            console.error('Failed to fetch dataset params for', setCode, e);
            this.paramMetaMap[setCode] = {};
          }
        }
      }

      // Build tableData2 with param metadata
      const extendArray = [];
      for (const i in (extendObj || {})) {
        const children = [];
        
        // Get all param names from both extendObj and paramMetaMap
        const paramNamesFromExtend = Object.keys(extendObj[i]);
        const paramNamesFromMeta = this.paramMetaMap[i] ? Object.keys(this.paramMetaMap[i]) : [];
        const allParamNames = [...new Set([...paramNamesFromExtend, ...paramNamesFromMeta])];
        
        for (const y of allParamNames) {
          const meta = (this.paramMetaMap[i] && this.paramMetaMap[i][y]) || {};
          const dictCode = meta.dictCode || '';
          const dictOptions = dictCode ? (this.dictOptionsCache[dictCode] || []) : [];
          let extParamOptions = [];
          if (!dictCode && meta.extParam) {
            try {
              extParamOptions = JSON.parse(meta.extParam) || [];
            } catch (e) {
              extParamOptions = [];
            }
          }
          
          // Determine value: use extendObj value if present, otherwise use sampleItem or defaultValue from meta
          let paramValue;
          if (extendObj[i] && extendObj[i][y] !== undefined) {
            paramValue = extendObj[i][y];
          } else {
            paramValue = meta.sampleItem || meta.defaultValue || '';
          }
          
          children.push({
            name: y,
            value: this.resolveParamValue(paramValue),
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

      // Determine header row count from the sheet data.
      // Default: first row is treated as header (row index 0).
      // This can be adjusted if the report template uses multiple header rows.
      if (this.sheetData && this.sheetData.length > 0) {
        const celldata = this.sheetData[0].celldata || [];
        this.headerRowCount = celldata.length > 0 ? 1 : 0;
      }

      this.currentPage = 1;
      this.renderSheetData();
    },
    async download(val) {
      // if (val == "gaea_template_pdf") {
      //   this.$message("暂不支持pdf");
      //   return;
      // }
      let extend = '.xlsx';
      const result = {};
      result["reportCode"] = this.reportCode;
      result["setParam"] = this.params.setParam || '';
      if (val != "") {
        result["exportType"] = val;
        if (val === "gaea_template_pdf") {
          extend = '.pdf';
        }
      }
      this.getCellStyleData(result);
      const fileName = this.reportCode + extend;
      exportExcel(result).then(res=>{
        const that = this;
        const type = res.type;
        if (type == "application/json") {
          let reader = new FileReader();
          reader.readAsText(res, "utf-8");
          reader.onload = function() {
            const data = JSON.parse(reader.result);
            that.$message.error(data.message);
          };
          return;
        }

        const blob = new Blob([res], {
          type: "application/octet-stream"
        });
        if (window.navigator.msSaveOrOpenBlob) {
          //msSaveOrOpenBlob方法返回bool值
          navigator.msSaveBlob(blob, fileName); //本地保存
        } else {
          const link = document.createElement("a"); //a标签下载
          link.href = window.URL.createObjectURL(blob);
          link.download = fileName;
          link.click();
          window.URL.revokeObjectURL(link.href);
        }
      })
    },
    // Build flat deduplicated param list for UI display
    buildFlatParams() {
      const seen = new Set();
      const flat = [];
      for (const item of this.tableData2) {
        for (const child of (item.children || [])) {
          if (!seen.has(child.name)) {
            seen.add(child.name);
            flat.push(child);
          }
        }
      }
      return flat;
    },
    // Build per-setCode setParam object using current flatParams values
    buildSetParamObj() {
      const valueMap = {};
      this.flatParams.forEach(p => { valueMap[p.name] = p.value; });
      const result = {};
      this.tableData2.forEach(item => {
        if (item.name) {
          const newObj = {};
          (item.children || []).forEach(child => {
            newObj[child.name] = Object.prototype.hasOwnProperty.call(valueMap, child.name)
              ? valueMap[child.name]
              : child.value;
          });
          result[item.name] = newObj;
        }
      });
      return result;
    },
    // Resolve @-prefixed dynamic default values
    resolveParamValue(value) {
      if (!value || typeof value !== 'string' || !value.startsWith('@')) return value;
      const now = new Date();
      const fmt = d => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };
      switch (value) {
        case '@当天': return fmt(now);
        case '@昨天': { const d = new Date(now); d.setDate(d.getDate() - 1); return fmt(d); }
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
    // 表单封装json (legacy, kept for compatibility)
    toObject(val) {
      const objfirst = {};
      const objSecond = {};
      val.forEach(el => {
        el.name ? (objfirst[el.name] = el.children) : "";
      });
      for (const key in objfirst) {
        const newObj = {};
        objfirst[key].map(ev => {
          Object.assign(newObj, { [ev.name]: ev.value });
        });
        objSecond[key] = newObj;
      }
      return objSecond;
    },
    //初始化表格
    createSheet(sheetDataOverride) {
      const options = {
        container: "luckysheet", // 设定DOM容器的id
        title: "", // 设定表格名称
        lang: "zh", // 设定表格语言
        plugins: ["chart"],
        showinfobar: false, // 隐藏顶部信息栏（"新打开 已恢复本地缓存"）
        showsheetbar: false, // 隐藏底部sheet标签栏
        data: [
          {
            name: "report", //工作表名称
            color: "", //工作表颜色
            index: 0, //工作表索引
            status: 1, //激活状态
            order: 0, //工作表的下标
            hide: 0, //是否隐藏
            row: 36, //行数
            column: 18, //列数
            defaultRowHeight: 19, //自定义行高
            defaultColWidth: 73, //自定义列宽
            celldata: [], //初始化使用的单元格数据
            config: {
              merge: {}, //合并单元格
              rowlen: {}, //表格行高
              columnlen: {}, //表格列宽
              rowhidden: {}, //隐藏行
              colhidden: {}, //隐藏列
              borderInfo: {}, //边框
              authority: {} //工作表保护
            },
            scrollLeft: 0, //左右滚动条位置
            scrollTop: 315, //上下滚动条位置
            luckysheet_select_save: [], //选中的区域
            calcChain: [], //公式链
            isPivotTable: false, //是否数据透视表
            pivotTable: {}, //数据透视表设置
            filter_select: {}, //筛选范围
            filter: null, //筛选配置
            luckysheet_alternateformat_save: [], //交替颜色
            luckysheet_alternateformat_save_modelCustom: [], //自定义交替颜色
            luckysheet_conditionformat_save: {}, //条件格式
            frozen: {}, //冻结行列配置
            chart: [], //图表配置
            zoomRatio: 1, // 缩放比例
            image: [], //图片
            showGridLines: 1, //是否显示网格线
            dataVerification: {} //数据验证配置
          }
        ]
      };
      options.data = sheetDataOverride || this.sheetData;
      // console.log(this.sheetData)
      $(function() {
        luckysheet.create(options);
      });

      // 添加窗口大小变化监听器，以便在窗口大小变化时重新调整表格大小
      this.resizeHandler = () => {
        if (typeof luckysheet !== 'undefined' && luckysheet.resize) {
          luckysheet.resize();
        }
      };
      window.addEventListener('resize', this.resizeHandler);
    },
    getCellStyleData(result) {
      const sheetData = luckysheet.getluckysheetfile(); // 获取整个表格的数据
      const rowDatas = {};

      for (let sheetIndex in sheetData) {
        const sheet = sheetData[sheetIndex];
        if (sheet && sheet.data) {
          for (let rowIndex in sheet.data) {
            const row = sheet.data[rowIndex];
            rowDatas[rowIndex]=row;
          }
        }
      }
      result["rowDatas"] = JSON.stringify(rowDatas);;
    },
  }
};
</script>

<style src="../../../../static/luckysheet/assets/iconfont/iconfont.css" />
<style scoped lang="scss">
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
        height: 32px; /* matches el-input size="small" height */
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
