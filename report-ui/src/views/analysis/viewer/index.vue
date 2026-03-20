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
        <el-button size="small" @click="showExportDialog">导出</el-button>
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

    <!-- Export Dialog -->
    <el-dialog
      title="导出数据"
      :visible.sync="exportDialogVisible"
      width="400px"
    >
      <div class="export-options">
        <el-button type="primary" plain size="medium" @click="handleCopyRawData" style="width:100%;margin-bottom:10px">
          <i class="el-icon-document-copy"></i> 复制原始数据
        </el-button>
        <el-button type="primary" plain size="medium" @click="handleCopyFormattedData" style="width:100%;margin-bottom:10px">
          <i class="el-icon-document-copy"></i> 复制格式化数据
        </el-button>
        <el-button type="success" plain size="medium" @click="handleDownloadRawData" style="width:100%;margin-bottom:10px">
          <i class="el-icon-download"></i> 下载原始数据
        </el-button>
        <el-button type="success" plain size="medium" @click="handleDownloadFormattedData" style="width:100%">
          <i class="el-icon-download"></i> 下载格式化数据
        </el-button>
      </div>
      <span slot="footer" class="dialog-footer">
        <el-button @click="exportDialogVisible = false">关闭</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { detailByReportCode, detailBysetCode } from "@/api/GaeaReport";
import { testTransformSet } from "@/api/report";
import { getDictList } from "@/api/dict-data";
import { getAccessUser } from "@/utils/auth";

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
      totalRows: 0,
      // Export dialog
      exportDialogVisible: false
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
        if (this.tableData2.length === 0) {
          var children = [];
          var paramMetaList = dataSetDto.dataSetParamDtoList || [];
          
          // If we have setParamObj, use it; otherwise, build from paramMetaList
          var paramNames = [];
          if (setParamObj && setParamObj[setCode]) {
            paramNames = Object.keys(setParamObj[setCode]);
          } else {
            paramNames = paramMetaList.map(p => p.paramName);
          }

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

            // Determine value: use setParam value if present, otherwise use sampleItem or defaultValue
            var paramValue;
            if (setParamObj && setParamObj[setCode] && setParamObj[setCode][paramName] !== undefined) {
              paramValue = setParamObj[setCode][paramName];
            } else {
              paramValue = meta.sampleItem || meta.defaultValue || "";
            }

            children.push({
              name: paramName,
              value: this.resolveParamValue(paramValue),
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

        // 计算总行数：根据表格类型使用不同的计算方式
        if (config && config.mode === "pivot") {
          // 透视表：使用 S2 渲染完成事件获取实际的行节点数
          var _this = this;
          var updateTotalRows = function() {
            try {
              if (_this.s2Instance && _this.s2Instance.facet) {
                var facet = _this.s2Instance.facet;
                var layoutResult = facet.layoutResult;
                if (layoutResult && layoutResult.rowLeafNodes) {
                  // 获取透视后的实际行数（叶子节点）
                  _this.totalRows = layoutResult.rowLeafNodes.length;
                } else if (layoutResult && layoutResult.rowNodes) {
                  // 备选方案：过滤出叶子节点
                  var leafNodes = layoutResult.rowNodes.filter(function(node) {
                    return node.isLeaf;
                  });
                  _this.totalRows = leafNodes.length;
                } else {
                  _this.totalRows = _this.rawData ? _this.rawData.length : 0;
                }
              } else {
                _this.totalRows = _this.rawData ? _this.rawData.length : 0;
              }
            } catch (e) {
              console.warn("获取透视表行数失败，使用原始数据行数:", e);
              _this.totalRows = _this.rawData ? _this.rawData.length : 0;
            }
          };
          // 监听渲染完成事件
          this.s2Instance.on(S2.S2Event.RENDER_COMPLETED, updateTotalRows);
          // 同时使用 nextTick 作为后备方案
          this.$nextTick(function() {
            updateTotalRows();
          });
        } else {
          // 明细表：使用原始数据行数
          this.totalRows = this.rawData ? this.rawData.length : 0;
        }

        this.s2Instance.render();
      } catch (e) {
        console.error("Failed to render S2:", e);
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#f56c6c;">S2 渲染失败：' + e.message + "</div>";
      }
    },

    handlePageChange(page) {
      this.currentPage = page;
      this.renderS2();
    },

    showExportDialog() {
      if (!this.s2Instance) {
        this.$message.warning('没有可导出的数据');
        return;
      }
      this.exportDialogVisible = true;
    },

    async handleCopyRawData() {
      try {
        const { copyData } = await import('@antv/s2');
        const copyContent = copyData(this.s2Instance, '\t', false);
        await navigator.clipboard.writeText(copyContent);
        this.$message.success('原始数据已复制到剪贴板');
        this.exportDialogVisible = false;
      } catch (e) {
        console.error('Copy raw data failed:', e);
        this.$message.error('复制失败：' + e.message);
      }
    },

    async handleCopyFormattedData() {
      try {
        const { copyData } = await import('@antv/s2');
        const copyContent = copyData(this.s2Instance, '\t', { isFormatHeader: true, isFormatData: true });
        await navigator.clipboard.writeText(copyContent);
        this.$message.success('格式化数据已复制到剪贴板');
        this.exportDialogVisible = false;
      } catch (e) {
        console.error('Copy formatted data failed:', e);
        this.$message.error('复制失败：' + e.message);
      }
    },

    async handleDownloadRawData() {
      try {
        const { copyData, download } = await import('@antv/s2');
        const csvContent = copyData(this.s2Instance, ',', false);
        download(csvContent, 'analysis_data_raw.csv');
        this.$message.success('原始数据下载成功');
        this.exportDialogVisible = false;
      } catch (e) {
        console.error('Download raw data failed:', e);
        this.$message.error('下载失败：' + e.message);
      }
    },

    async handleDownloadFormattedData() {
      try {
        const { copyData, download } = await import('@antv/s2');
        const csvContent = copyData(this.s2Instance, ',', { isFormatHeader: true, isFormatData: true });
        download(csvContent, 'analysis_data_formatted.csv');
        this.$message.success('格式化数据下载成功');
        this.exportDialogVisible = false;
      } catch (e) {
        console.error('Download formatted data failed:', e);
        this.$message.error('下载失败：' + e.message);
      }
    },

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
    gap: 10px;
  }
}

.export-options {
  display: flex;
  flex-direction: column;
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
