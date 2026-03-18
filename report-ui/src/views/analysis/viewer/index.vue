<!--
 * Analysis Report Viewer Page (viewerantv)
 * Uses AntV S2 for table rendering based on saved analysis configuration
 * No advanced analysis component - only displays the final table
 -->
<template>
  <div class="layout">
    <div class="layout-top">
      <div v-if="hasQueryConditions" class="query-conditions">
        <template v-for="(item, num) in tableData2">
          <div
            v-for="(son, y) in item.children"
            :key="num + '-' + y + 'analysis'"
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
        </template>
      </div>
      <div class="action-buttons">
        <el-button type="primary" size="small" @click="searchPreview">查询</el-button>
        <el-button size="small" @click="resetQuery">重置</el-button>
      </div>
    </div>
    <div class="layout-middle">
      <div v-if="loading" class="loading-mask">
        <i class="el-icon-loading"></i>
        <span>正在加载预览...</span>
      </div>
      <div v-if="errorMsg && !loading" class="error-state">
        <i class="el-icon-warning-outline"></i>
        <p>{{ errorMsg }}</p>
      </div>
      <div v-if="dataEmpty && !loading && !errorMsg" class="empty-state">
        <i class="el-icon-document"></i>
        <p>暂无数据</p>
      </div>
      <div id="s2-viewer-container" ref="s2Container" />
      <div v-if="styleConfig && styleConfig.showPagination && totalRows > 0" class="pagination-bar">
        <el-pagination
          small
          background
          layout="prev, pager, next, jumper, total"
          :current-page="currentPage"
          :page-size="styleConfig.pageSize || 10"
          :total="totalRows"
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { detailByReportCode, detailBysetCode } from "@/api/GaeaReport";
import { testTransformSet } from "@/api/report";
import { getDictList } from "@/api/dict-data";

export default {
  name: "AnalysisViewer",
  computed: {
    hasQueryConditions() {
      return this.tableData2.some(function (item) {
        return item.children && item.children.length > 0;
      });
    }
  },
  data() {
    return {
      loading: true,
      reportCode: null,
      tableData2: [],
      analysisConfig: null,
      styleConfig: null,
      rawData: [],
      allFields: [],
      dataEmpty: false,
      errorMsg: "",
      params: {
        reportCode: "",
        setParam: ""
      },
      paramMetaMap: {},
      dictOptionsCache: {},
      initialSetParam: "",
      // S2 instance
      s2Instance: null,
      // Pagination state
      currentPage: 1,
      totalRows: 0
    };
  },
  created() {
    this.reportCode = this.$route.query.reportCode;
  },
  mounted() {
    this.loadPreview();
  },
  beforeDestroy() {
    this.destroyS2();
  },
  methods: {
    destroyS2() {
      if (this.s2Instance) {
        this.s2Instance.destroy();
        this.s2Instance = null;
      }
    },

    async searchPreview() {
      var arr = this.toObject(this.tableData2);
      this.params.setParam = JSON.stringify(arr);
      this.loadPreview();
    },

    resetQuery() {
      // Reset params to initial values
      this.params.setParam = this.initialSetParam;
      // Also clear tableData2 so it gets rebuilt with initial values on next loadPreview
      this.tableData2 = [];
      this.loadPreview();
    },

    async loadPreview() {
      this.loading = true;
      this.errorMsg = "";
      this.dataEmpty = false;
      this.currentPage = 1;

      try {
        // 1. Load the report configuration
        var reportResult = await detailByReportCode(this.reportCode);
        if (!reportResult || reportResult.code != 200 || !reportResult.data) {
          this.errorMsg = "报表配置不存在";
          this.loading = false;
          return;
        }

        var data = reportResult.data;

        // 2. Parse analysis config from jsonStr
        if (!data.jsonStr) {
          this.errorMsg = "未配置数据源";
          this.loading = false;
          return;
        }

        var parsedJsonStr = null;
        try {
          parsedJsonStr = JSON.parse(data.jsonStr);
        } catch (e) {
          this.errorMsg = "配置数据损坏";
          this.loading = false;
          return;
        }

        if (!parsedJsonStr || !parsedJsonStr.analysisConfig) {
          this.errorMsg = "配置格式无法识别";
          this.loading = false;
          return;
        }

        this.analysisConfig = parsedJsonStr.analysisConfig;
        this.styleConfig = parsedJsonStr.styleConfig || null;
        this.allFields = this.analysisConfig.allFields || [];

        // 3. Set up initial setParam for query conditions UI
        var defaultSetParam = data.setParam || "";
        if (!this.initialSetParam) {
          this.initialSetParam = defaultSetParam;
          this.params.setParam = defaultSetParam;
        }

        // 4. Parse the current setParam (user query values or defaults)
        var setParamObj = null;
        var currentSetParam = this.params.setParam || defaultSetParam;
        try {
          setParamObj = currentSetParam ? JSON.parse(currentSetParam) : null;
        } catch (e) {
          setParamObj = null;
        }

        // 5. Get the dataset code
        var setCode = data.setCodes ? data.setCodes.split("|")[0] : "";
        if (!setCode) {
          this.errorMsg = "未配置数据集";
          this.loading = false;
          return;
        }

        // 6. Load dataset definition (for query conditions meta and data execution)
        var dataSetResult = await detailBysetCode(setCode);
        if (!dataSetResult || dataSetResult.code != 200 || !dataSetResult.data) {
          this.errorMsg = "数据集加载失败";
          this.loading = false;
          return;
        }

        var dataSetDto = dataSetResult.data;

        // 7. Build query conditions UI (on first load only)
        if (this.tableData2.length === 0 && setParamObj && setParamObj[setCode]) {
          var children = [];
          var paramValues = setParamObj[setCode];
          var paramMetaList = dataSetDto.dataSetParamDtoList || [];
          var paramNames = Object.keys(paramValues);

          for (var ni = 0; ni < paramNames.length; ni++) {
            var paramName = paramNames[ni];
            var meta = {};
            for (var pi = 0; pi < paramMetaList.length; pi++) {
              if (paramMetaList[pi].paramName === paramName) {
                meta = paramMetaList[pi];
                break;
              }
            }

            var dictCode = meta.dictCode || "";
            var dictOptions = [];
            if (dictCode) {
              if (!this.dictOptionsCache[dictCode]) {
                try {
                  var dictResult = await getDictList(dictCode);
                  if (dictResult.code == 200) {
                    this.dictOptionsCache[dictCode] = dictResult.data || [];
                  }
                } catch (e) {
                  this.dictOptionsCache[dictCode] = [];
                }
              }
              dictOptions = this.dictOptionsCache[dictCode];
            }

            var extParamOptions = [];
            if (!dictCode && meta.extParam) {
              try {
                extParamOptions = JSON.parse(meta.extParam) || [];
              } catch (e) {
                extParamOptions = [];
              }
            }

            children.push({
              name: paramName,
              value: paramValues[paramName],
              paramType: meta.paramType || "输入框",
              dictCode: dictCode,
              dictOptions: dictOptions,
              extParamOptions: extParamOptions
            });
          }

          if (children.length > 0) {
            this.tableData2 = [{ name: setCode, children: children }];
          }
        }

        // 8. Update dataSetParamDtoList with user's current query values
        var paramDtoList = (dataSetDto.dataSetParamDtoList || []).map(function(p) {
          return Object.assign({}, p);
        });

        if (setParamObj && setParamObj[setCode]) {
          var userValues = setParamObj[setCode];
          paramDtoList.forEach(function(param) {
            if (userValues[param.paramName] !== undefined && userValues[param.paramName] !== "") {
              param.sampleItem = String(userValues[param.paramName]);
            }
          });
        }

        // 9. Execute dataset via testTransform to get actual data
        var testResult = await testTransformSet({
          sourceCode: dataSetDto.sourceCode,
          dynSentence: dataSetDto.dynSentence,
          setType: dataSetDto.setType,
          dataSetParamDtoList: paramDtoList,
          dataSetTransformDtoList: dataSetDto.dataSetTransformDtoList || []
        });

        if (testResult && testResult.code == 200 && testResult.data && testResult.data.data) {
          var rows = testResult.data.data;
          this.rawData = rows;
          this.dataEmpty = rows.length === 0;

          // Update allFields from actual data keys if fields not already configured
          if (rows.length > 0 && (!this.allFields || this.allFields.length === 0)) {
            this.allFields = Object.keys(rows[0]);
          }
        } else {
          this.rawData = [];
          this.dataEmpty = true;
        }

        this.loading = false;
        this.renderS2();
      } catch (e) {
        console.error("Failed to load preview:", e);
        this.errorMsg = "加载失败: " + e.message;
        this.loading = false;
      }
    },

    async renderS2() {
      this.destroyS2();

      var container = this.$refs.s2Container;
      if (!container) return;
      container.innerHTML = "";

      if (this.dataEmpty && (!this.rawData || this.rawData.length === 0)) {
        return;
      }

      try {
        var S2 = await import("@antv/s2");
        var config = this.analysisConfig;
        var sc = this.styleConfig || {};

        var containerWidth = container.offsetWidth || 800;
        var containerHeight = container.offsetHeight || 600;

        var s2DataConfig;
        var s2Options = {
          width: sc.autoFit !== false ? containerWidth : (sc.tableWidth || containerWidth),
          height: sc.autoFit !== false ? containerHeight : (sc.tableHeight || containerHeight),
          hierarchyType: sc.hierarchyType || "grid",
          showDefaultHeaderActionIcon: false,
          showSeriesNumber: sc.showSeriesNumber || false,
          frozenRowHeader: sc.frozenRowHeader || false,
          interaction: {
            enableCopy: true,
            hoverHighlight: true
          }
        };

        // Column width style
        if (sc.colWidthType === "compact") {
          s2Options.style = { colCfg: { width: 80 } };
        }

        // Totals configuration
        var pivotRows = (config && config.fields && config.fields.rows) || [];
        var pivotCols = (config && config.fields && config.fields.columns) || [];
        s2Options.totals = {
          row: {
            showGrandTotals: sc.showRowGrandTotals || false,
            showSubTotals: sc.showRowSubTotals || false,
            subTotalsDimensions: pivotRows.length > 0 ? [pivotRows[pivotRows.length - 1]] : []
          },
          col: {
            showGrandTotals: sc.showColGrandTotals || false,
            showSubTotals: sc.showColSubTotals || false,
            subTotalsDimensions: pivotCols.length > 0 ? [pivotCols[pivotCols.length - 1]] : []
          }
        };

        // Pagination
        if (sc.showPagination) {
          s2Options.pagination = {
            pageSize: sc.pageSize || 10,
            current: this.currentPage
          };
        }

        if (config && config.mode === "pivot") {
          var rows = config.fields.rows || [];
          var columns = config.fields.columns || [];
          var values = config.fields.values || [];

          s2DataConfig = {
            fields: {
              rows: rows,
              columns: columns,
              values: values,
              valueInCols: config.fields.valueInCols !== false
            },
            data: this.rawData || []
          };

          this.s2Instance = new S2.PivotSheet(container, s2DataConfig, s2Options);
        } else {
          // Default to detail table
          var fields = (config && config.allFields && config.allFields.length > 0)
            ? config.allFields
            : this.allFields;

          s2DataConfig = {
            fields: {
              columns: fields
            },
            data: this.rawData || []
          };

          this.s2Instance = new S2.TableSheet(container, s2DataConfig, s2Options);
        }

        // Apply theme
        var themeCfg = { name: sc.themeName || "default" };
        if (sc.themeColor) {
          themeCfg.theme = {
            cornerCell: { cell: { backgroundColor: sc.themeColor } },
            colCell: { cell: { backgroundColor: sc.themeColor } }
          };
        }
        this.s2Instance.setThemeCfg(themeCfg);

        this.s2Instance.render();
        this.totalRows = this.rawData ? this.rawData.length : 0;
      } catch (e) {
        console.error("Failed to render S2:", e);
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#f56c6c;">S2 渲染失败: ' + e.message + "</div>";
      }
    },

    handlePageChange(page) {
      this.currentPage = page;
      this.renderS2();
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
    }
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

.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #999;

  i {
    font-size: 48px;
    margin-bottom: 10px;
  }
}

.error-state {
  color: #f56c6c;
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
  display: flex;
  flex-direction: column;

  #s2-viewer-container {
    flex: 1;
    overflow: hidden;
    width: 100%;
    min-height: 0;
  }
}

.pagination-bar {
  flex-shrink: 0;
  padding: 8px 0;
  text-align: center;
  background: #fff;
  border-top: 1px solid #e8eaec;
}
</style>
