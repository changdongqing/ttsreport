<!--
 * Analysis Report Designer Page
 * Uses AntV S2 for table rendering instead of Luckysheet
 * Supports single dataset selection with detail/pivot table modes
 -->
<template>
  <div class="layout">
    <div class="layout-left">
      <div class="add-collection">
        数据集管理
        <el-button
          type="text"
          icon="el-icon-circle-plus-outline"
          @click="openDataSetDialog()"
        />
      </div>
      <div v-if="selectedDataSet" class="selected-dataset">
        <div class="dataset-header">
          <span class="dataset-name">{{ selectedDataSet.setName }}</span>
          <el-popconfirm
            :title="'确定移除数据集 ' + selectedDataSet.setName + ' 吗？'"
            @confirm="removeDataSet()"
          >
            <el-button slot="reference" type="text" icon="el-icon-close" class="remove-btn" />
          </el-popconfirm>
        </div>
        <div class="field-list">
          <div
            v-for="(field, index) in allFields"
            :key="index"
            class="field-item"
          >
            <span>{{ field }}</span>
          </div>
        </div>
      </div>
      <div v-else class="no-dataset">
        <p>请选择一个数据集</p>
      </div>
    </div>

    <div class="layout-middle">
      <div class="push_btn">
        <el-tooltip class="item" effect="dark" content="预览" placement="bottom-start">
          <el-button type="text" @click="previewReport()">
            <i class="iconfont iconfuzhi"></i>
          </el-button>
        </el-tooltip>
        <el-tooltip class="item" effect="dark" content="保存" placement="bottom-start">
          <el-button type="text" @click="save()">
            <i class="iconfont iconsave"></i>
          </el-button>
        </el-tooltip>
        <el-tooltip class="item" effect="dark" content="浏览" placement="bottom-start">
          <el-button type="text" @click="browse()">
            <i class="iconfont iconliulan"></i>
          </el-button>
        </el-tooltip>
      </div>

      <!-- Analysis Config Panel -->
      <div class="analysis-panel">
        <el-tabs v-model="activeConfigTab" type="card" size="mini" class="config-tabs">
          <!-- Tab 1: Analysis Config (existing) -->
          <el-tab-pane label="分析配置" name="analysis">
            <el-card class="config-card" shadow="never">
              <div slot="header" class="config-header">
                <span>模式</span>
                <el-radio-group v-model="analysisConfig.mode" size="mini" @change="onModeChange">
                  <el-radio-button label="detail">明细表</el-radio-button>
                  <el-radio-button label="pivot">透视表</el-radio-button>
                </el-radio-group>
              </div>
              <div v-if="analysisConfig.mode === 'pivot'" class="pivot-config">
                <div class="config-row">
                  <label>行维度：</label>
                  <el-select
                    v-model="analysisConfig.fields.rows"
                    multiple
                    filterable
                    size="mini"
                    placeholder="选择行维度字段"
                    @change="refreshS2"
                  >
                    <el-option
                      v-for="f in allFields"
                      :key="'row-' + f"
                      :label="f"
                      :value="f"
                    />
                  </el-select>
                </div>
                <div class="config-row">
                  <label>列维度：</label>
                  <el-select
                    v-model="analysisConfig.fields.columns"
                    multiple
                    filterable
                    size="mini"
                    placeholder="选择列维度字段"
                    @change="refreshS2"
                  >
                    <el-option
                      v-for="f in allFields"
                      :key="'col-' + f"
                      :label="f"
                      :value="f"
                    />
                  </el-select>
                </div>
                <div class="config-row">
                  <label>指标值：</label>
                  <el-select
                    v-model="analysisConfig.fields.values"
                    multiple
                    filterable
                    size="mini"
                    placeholder="选择指标字段"
                    @change="refreshS2"
                  >
                    <el-option
                      v-for="f in allFields"
                      :key="'val-' + f"
                      :label="f"
                      :value="f"
                    />
                  </el-select>
                </div>
                <div class="config-row">
                  <label>指标位置：</label>
                  <el-radio-group v-model="analysisConfig.fields.valueInCols" size="mini" @change="refreshS2">
                    <el-radio :label="true">列头</el-radio>
                    <el-radio :label="false">行头</el-radio>
                  </el-radio-group>
                </div>
              </div>
            </el-card>
          </el-tab-pane>

          <!-- Tab 2: Style Config (new) -->
          <el-tab-pane label="样式" name="style">
            <div class="style-config">
              <!-- 主题风格 -->
              <div class="style-section">
                <div class="style-section-title">主题风格</div>
                <div class="config-row">
                  <label>类型：</label>
                  <el-radio-group v-model="styleConfig.hierarchyType" size="mini" @change="refreshS2">
                    <el-radio-button label="grid">平铺</el-radio-button>
                    <el-radio-button label="tree">树状</el-radio-button>
                  </el-radio-group>
                </div>
                <div class="config-row">
                  <label>主题：</label>
                  <el-select v-model="styleConfig.themeName" size="mini" style="width:140px" @change="refreshS2">
                    <el-option label="默认" value="default" />
                    <el-option label="简约灰" value="gray" />
                    <el-option label="多彩蓝" value="colorful" />
                  </el-select>
                </div>
                <div class="config-row">
                  <label>主题色：</label>
                  <el-color-picker v-model="styleConfig.themeColor" size="mini" @change="refreshS2" />
                  <el-button v-if="styleConfig.themeColor" type="text" size="mini" style="margin-left:4px" @click="clearThemeColor">清除</el-button>
                </div>
              </div>

              <!-- 显示模式 -->
              <div class="style-section">
                <div class="style-section-title">显示模式</div>
                <div class="config-row">
                  <label>宽度调整：</label>
                  <el-radio-group v-model="styleConfig.colWidthType" size="mini" @change="refreshS2">
                    <el-radio-button label="adaptive">列等宽</el-radio-button>
                    <el-radio-button label="compact">列紧凑</el-radio-button>
                  </el-radio-group>
                </div>
                <div class="config-row">
                  <label>宽高自适应：</label>
                  <el-switch v-model="styleConfig.autoFit" size="mini" @change="refreshS2" />
                </div>
                <div v-if="!styleConfig.autoFit" class="config-row">
                  <label>表格宽度：</label>
                  <el-input-number v-model="styleConfig.tableWidth" size="mini" :min="200" :max="5000" :step="50" controls-position="right" style="width:120px" @change="refreshS2" />
                </div>
                <div v-if="!styleConfig.autoFit" class="config-row">
                  <label>表格高度：</label>
                  <el-input-number v-model="styleConfig.tableHeight" size="mini" :min="100" :max="5000" :step="50" controls-position="right" style="width:120px" @change="refreshS2" />
                </div>
                <div class="config-row">
                  <label>冻结行头：</label>
                  <el-switch v-model="styleConfig.frozenRowHeader" size="mini" @change="refreshS2" />
                </div>
              </div>

              <!-- 行序号和分页 -->
              <div class="style-section">
                <div class="style-section-title">行序号和分页</div>
                <div class="config-row">
                  <label>显示行序号：</label>
                  <el-switch v-model="styleConfig.showSeriesNumber" size="mini" @change="refreshS2" />
                </div>
                <div class="config-row">
                  <label>显示分页：</label>
                  <el-switch v-model="styleConfig.showPagination" size="mini" @change="onShowPaginationChange" />
                </div>
                <div v-if="styleConfig.showPagination" class="config-row">
                  <label>每页行数：</label>
                  <el-input-number v-model="styleConfig.pageSize" size="mini" :min="5" :max="500" :step="5" controls-position="right" style="width:100px" @change="onPageSizeChange" />
                </div>
              </div>

              <!-- 行小计/总计 -->
              <div class="style-section">
                <div class="style-section-title">行小计/总计</div>
                <div class="config-row">
                  <label>显示行小计：</label>
                  <el-switch v-model="styleConfig.showRowSubTotals" size="mini" @change="refreshS2" />
                </div>
                <div class="config-row">
                  <label>显示行总计：</label>
                  <el-switch v-model="styleConfig.showRowGrandTotals" size="mini" @change="refreshS2" />
                </div>
              </div>

              <!-- 列小计/总计 -->
              <div class="style-section">
                <div class="style-section-title">列小计/总计</div>
                <div class="config-row">
                  <label>显示列小计：</label>
                  <el-switch v-model="styleConfig.showColSubTotals" size="mini" @change="refreshS2" />
                </div>
                <div class="config-row">
                  <label>显示列总计：</label>
                  <el-switch v-model="styleConfig.showColGrandTotals" size="mini" @change="refreshS2" />
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>

      <!-- S2 Table Container -->
      <div class="s2-container">
        <div v-if="loading" class="loading-mask">
          <i class="el-icon-loading"></i>
          <span>正在加载...</span>
        </div>
        <div v-if="!selectedDataSet && !loading" class="empty-state">
          <i class="el-icon-document"></i>
          <p>请在左侧选择数据集以开始设计</p>
        </div>
        <div v-if="dataEmpty && selectedDataSet && !loading" class="empty-state">
          <i class="el-icon-warning-outline"></i>
          <p>数据集无数据</p>
        </div>
        <div id="s2-designer-container" ref="s2Container" />
        <div v-if="styleConfig.showPagination && totalRows > 0" class="pagination-bar">
          <el-pagination
            small
            background
            layout="prev, pager, next, jumper, total"
            :current-page="currentPage"
            :page-size="styleConfig.pageSize"
            :total="totalRows"
            @current-change="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- Dataset selection dialog -->
    <el-dialog title="选择数据集（仅支持单选）" :visible.sync="dataSetDialogVisible" width="60%">
      <el-table
        ref="dataSetTable"
        :data="dataSetList"
        tooltip-effect="dark"
        style="width: 100%; max-height: 60vh; overflow-y: auto"
        highlight-current-row
        @current-change="handleDataSetSelect"
      >
        <el-table-column label="数据集名称" width="180" prop="setName" />
        <el-table-column prop="setDesc" label="数据集描述" width="200" />
        <el-table-column prop="setCode" label="数据集编码" show-overflow-tooltip />
      </el-table>
      <div slot="footer" class="dialog-footer">
        <el-button @click="dataSetDialogVisible = false">取 消</el-button>
        <el-button type="primary" @click="confirmDataSet()">确定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { queryAllDataSet, detail, detailByReportCode, detailBysetCode } from "@/api/GaeaReport";
import { addReportExcel, editReportExcel, testTransformSet } from "@/api/report";

export default {
  name: "AnalysisDesigner",
  data() {
    return {
      loading: false,
      reportCode: "",
      reportId: null,
      accessKey: null,

      // Dataset
      dataSetList: [],
      dataSetDialogVisible: false,
      selectedDataSetTemp: null,
      selectedDataSet: null,
      allFields: [],
      rawData: [],
      dataEmpty: false,

      // Active config tab
      activeConfigTab: "analysis",

      // Analysis config (serialized for saving)
      analysisConfig: {
        mode: "detail",
        fields: {
          rows: [],
          columns: [],
          values: [],
          valueInCols: true
        },
        allFields: []
      },

      // Style config (serialized for saving alongside analysisConfig)
      styleConfig: {
        hierarchyType: "grid",
        themeName: "default",
        themeColor: "",
        colWidthType: "adaptive",
        tableWidth: 800,
        tableHeight: 500,
        frozenRowHeader: false,
        autoFit: true,
        showSeriesNumber: false,
        showPagination: false,
        pageSize: 10,
        showRowSubTotals: false,
        showRowGrandTotals: false,
        showColSubTotals: false,
        showColGrandTotals: false
      },

      // S2 instance
      s2Instance: null,

      // Pagination state
      currentPage: 1,
      totalRows: 0,

      // Report Excel DTO for saving
      reportExcelDto: {
        id: null,
        jsonStr: "",
        setCodes: "",
        setParam: "",
        reportCode: ""
      }
    };
  },
  created() {
    this.reportCode = this.$route.query.reportCode;
    this.accessKey = this.$route.query.accessKey;
    this.loadDataSetList();
    this.loadExistingConfig();
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

    async loadDataSetList() {
      try {
        var result = await queryAllDataSet();
        if (result.code == 200) {
          this.dataSetList = result.data || [];
        }
      } catch (e) {
        console.error("Failed to load datasets:", e);
      }
    },

    async loadExistingConfig() {
      try {
        var result = await detailByReportCode(this.reportCode);
        if (result.data != null) {
          this.reportId = result.data.id;
          var data = result.data;

          // Parse the saved configuration
          if (data.jsonStr) {
            try {
              var savedConfig = JSON.parse(data.jsonStr);
              if (savedConfig && savedConfig.analysisConfig) {
                this.analysisConfig = savedConfig.analysisConfig;
              }
              if (savedConfig && savedConfig.styleConfig) {
                this.styleConfig = Object.assign({}, this.styleConfig, savedConfig.styleConfig);
              }
            } catch (e) {
              console.warn("Failed to parse saved config:", e);
            }
          }

          // Load the dataset
          if (data.setCodes) {
            var setCode = data.setCodes.split("|")[0];
            // Wait for dataset list to load, then find and load the dataset
            await this.loadDataSetList();
            var matchedSet = null;
            for (var i = 0; i < this.dataSetList.length; i++) {
              if (this.dataSetList[i].setCode === setCode) {
                matchedSet = this.dataSetList[i];
                break;
              }
            }
            if (matchedSet) {
              await this.loadDataSetDetail(matchedSet.id);
            }
          }
        }
      } catch (e) {
        console.warn("No existing config found:", e);
      }
    },

    openDataSetDialog() {
      if (this.selectedDataSet) {
        this.$confirm("切换数据集将清除当前配置，是否继续？", "提示", {
          type: "warning"
        }).then(() => {
          this.selectedDataSetTemp = null;
          this.dataSetDialogVisible = true;
        }).catch(() => {});
        return;
      }
      this.selectedDataSetTemp = null;
      this.dataSetDialogVisible = true;
    },

    handleDataSetSelect(row) {
      this.selectedDataSetTemp = row;
    },

    confirmDataSet() {
      if (!this.selectedDataSetTemp) {
        this.$message.warning("请选择一个数据集");
        return;
      }
      this.dataSetDialogVisible = false;
      this.loadDataSetDetail(this.selectedDataSetTemp.id);
    },

    async loadDataSetDetail(dataSetId) {
      this.loading = true;
      try {
        var result = await detail(dataSetId);
        if (result.code != 200) {
          this.loading = false;
          return;
        }
        var data = result.data;
        this.selectedDataSet = data;

        // Extract fields and data
        var fields = data.setParamList || [];
        var sampleData = [];

        // The detail API returns the dataset with field list
        // We need to get actual data via preview
        this.allFields = fields;
        this.analysisConfig.allFields = fields;

        // Reset analysis config for new dataset (unless loading saved config)
        if (!this.reportId || this.analysisConfig.allFields.length === 0) {
          this.analysisConfig.mode = "detail";
          this.analysisConfig.fields = {
            rows: [],
            columns: [],
            values: [],
            valueInCols: true
          };
          this.analysisConfig.allFields = fields;
        }

        // Load data preview
        await this.loadDataPreview(data.setCode);
      } catch (e) {
        console.error("Failed to load dataset detail:", e);
        this.$message.error("加载数据集失败: " + e.message);
        this.loading = false;
      }
    },

    async loadDataPreview(setCode) {
      try {
        // Get the full dataset definition to execute it
        var dataSetDetailResult = await detailBysetCode(setCode);
        if (!dataSetDetailResult || dataSetDetailResult.code != 200 || !dataSetDetailResult.data) {
          this.rawData = [];
          this.dataEmpty = true;
          this.refreshS2();
          this.loading = false;
          return;
        }

        var dataSetDto = dataSetDetailResult.data;

        // Execute the dataset via testTransform to get actual data
        var testResult = await testTransformSet({
          sourceCode: dataSetDto.sourceCode,
          dynSentence: dataSetDto.dynSentence,
          setType: dataSetDto.setType,
          dataSetParamDtoList: dataSetDto.dataSetParamDtoList || [],
          dataSetTransformDtoList: dataSetDto.dataSetTransformDtoList || []
        });

        if (testResult && testResult.code == 200 && testResult.data && testResult.data.data) {
          var rows = testResult.data.data;
          this.rawData = rows;
          this.dataEmpty = rows.length === 0;

          // Update allFields from actual data column keys if available
          if (rows.length > 0) {
            var keys = Object.keys(rows[0]);
            this.allFields = keys;
            this.analysisConfig.allFields = keys;
          }
        } else {
          this.rawData = [];
          this.dataEmpty = true;
        }

        this.currentPage = 1;
        this.refreshS2();
        this.loading = false;
      } catch (e) {
        console.error("Failed to load data preview:", e);
        this.loading = false;
        this.rawData = [];
        this.dataEmpty = true;
        this.currentPage = 1;
        this.refreshS2();
      }
    },

    async refreshS2() {
      this.destroyS2();

      if (!this.allFields || this.allFields.length === 0) return;

      var container = this.$refs.s2Container;
      if (!container) return;

      // Clear container
      container.innerHTML = "";

      try {
        var S2 = await import("@antv/s2");
        var sc = this.styleConfig;

        var containerWidth = container.offsetWidth || 800;
        var containerHeight = container.offsetHeight || 500;

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

        // Totals configuration (only meaningful for pivot mode)
        var rows = this.analysisConfig.fields.rows || [];
        var columns = this.analysisConfig.fields.columns || [];
        s2Options.totals = {
          row: {
            showGrandTotals: sc.showRowGrandTotals || false,
            showSubTotals: sc.showRowSubTotals || false,
            subTotalsDimensions: rows.length > 0 ? [rows[rows.length - 1]] : []
          },
          col: {
            showGrandTotals: sc.showColGrandTotals || false,
            showSubTotals: sc.showColSubTotals || false,
            subTotalsDimensions: columns.length > 0 ? [columns[columns.length - 1]] : []
          }
        };

        // Pagination
        if (sc.showPagination) {
          s2Options.pagination = {
            pageSize: sc.pageSize || 10,
            current: this.currentPage
          };
        }

        if (this.analysisConfig.mode === "pivot") {
          // Pivot table mode - reuse rows/columns declared above for totals config
          var values = this.analysisConfig.fields.values || [];

          if (rows.length === 0 && columns.length === 0 && values.length === 0) {
            // No config yet, show empty hint
            container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#999;">请在分析配置中设置行维度、列维度和指标</div>';
            return;
          }

          s2DataConfig = {
            fields: {
              rows: rows,
              columns: columns,
              values: values,
              valueInCols: this.analysisConfig.fields.valueInCols !== false
            },
            data: this.rawData || []
          };

          this.s2Instance = new S2.PivotSheet(container, s2DataConfig, s2Options);
        } else {
          // Detail table mode - show all columns
          s2DataConfig = {
            fields: {
              columns: this.allFields
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
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#f56c6c;">S2 渲染失败: ' + e.message + '</div>';
      }
    },

    onModeChange() {
      this.currentPage = 1;
      this.refreshS2();
    },

    onShowPaginationChange() {
      this.resetPageAndRefresh();
    },

    onPageSizeChange() {
      this.resetPageAndRefresh();
    },

    resetPageAndRefresh() {
      this.currentPage = 1;
      this.refreshS2();
    },

    handlePageChange(page) {
      this.currentPage = page;
      this.refreshS2();
    },

    clearThemeColor() {
      this.styleConfig.themeColor = "";
      this.refreshS2();
    },

    async save() {
      try {
        // Build the config to save
        var configToSave = {
          analysisConfig: JSON.parse(JSON.stringify(this.analysisConfig)),
          styleConfig: JSON.parse(JSON.stringify(this.styleConfig))
        };

        this.reportExcelDto.jsonStr = JSON.stringify(configToSave);

        // Build setCodes from selected dataset
        if (this.selectedDataSet) {
          this.reportExcelDto.setCodes = this.selectedDataSet.setCode;

          // Build setParam from dataset params
          var setParams = {};
          if (this.selectedDataSet.dataSetParamDtoList && this.selectedDataSet.dataSetParamDtoList.length > 0) {
            var dataSetParam = {};
            this.selectedDataSet.dataSetParamDtoList.forEach(function (value) {
              dataSetParam[value.paramName] = value.sampleItem;
            });
            setParams[this.selectedDataSet.setCode] = dataSetParam;
          }
          this.reportExcelDto.setParam = JSON.stringify(setParams);
        } else {
          this.reportExcelDto.setCodes = "";
          this.reportExcelDto.setParam = "{}";
        }

        this.reportExcelDto.reportCode = this.reportCode;

        if (this.reportId == null) {
          var addResult = await addReportExcel(this.reportExcelDto);
          if (addResult.code != "200") return;
          this.$message.success("保存成功");
        } else {
          this.reportExcelDto.id = this.reportId;
          var editResult = await editReportExcel(this.reportExcelDto);
          if (editResult.code != "200") return;
          this.$message.success("更新成功");
        }
      } catch (e) {
        console.error("Save failed:", e);
        this.$message.error("保存失败: " + e.message);
      }
    },

    previewReport() {
      var routeUrl = this.$router.resolve({
        path: "/analysis/viewer",
        query: { reportCode: this.reportCode }
      });
      window.open(routeUrl.href, "_blank");
    },

    browse() {
      var routeUrl = this.$router.resolve({
        path: "/analysis/viewer",
        query: { reportCode: this.reportCode }
      });
      window.open(routeUrl.href, "_blank");
    },

    removeDataSet() {
      this.selectedDataSet = null;
      this.allFields = [];
      this.rawData = [];
      this.dataEmpty = false;
      this.analysisConfig = {
        mode: "detail",
        fields: {
          rows: [],
          columns: [],
          values: [],
          valueInCols: true
        },
        allFields: []
      };
      this.styleConfig = {
        hierarchyType: "grid",
        themeName: "default",
        themeColor: "",
        colWidthType: "adaptive",
        tableWidth: 800,
        tableHeight: 500,
        frozenRowHeader: false,
        autoFit: true,
        showSeriesNumber: false,
        showPagination: false,
        pageSize: 10,
        showRowSubTotals: false,
        showRowGrandTotals: false,
        showColSubTotals: false,
        showColGrandTotals: false
      };
      this.destroyS2();
      var container = this.$refs.s2Container;
      if (container) container.innerHTML = "";
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

.layout {
  display: block;
  position: relative;
  margin: 0;
  padding: 0;
  border: 1px solid #d7dde4;
}

.layout-left {
  display: block;
  position: absolute;
  padding: 20px;
  width: 230px;
  min-height: 99.98vh;
  border-right: 1px solid #eee;
  border-color: #e8eaec;
  background: #fff;
  border-radius: 4px;
  font-size: 14px;
  transition: all 0.2s ease-in-out;
  top: 0;
  left: 0;
  overflow-y: auto;

  .add-collection {
    line-height: 30px;

    .el-button {
      font-size: 16px !important;
      vertical-align: middle;
      margin-left: 20px;
    }
  }

  .selected-dataset {
    margin-top: 10px;

    .dataset-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 0;
      border-bottom: 1px solid #eee;

      .dataset-name {
        font-weight: bold;
        color: #409eff;
      }

      .remove-btn {
        color: #f56c6c;
      }
    }

    .field-list {
      margin-top: 5px;
    }

    .field-item {
      line-height: 28px;
      padding: 0 10px;
      cursor: default;

      &:hover {
        background: #f7fafd;
      }
    }
  }

  .no-dataset {
    text-align: center;
    color: #999;
    margin-top: 40px;
  }
}

.layout-middle {
  display: block;
  position: absolute;
  left: 230px;
  right: 0;
  width: calc(100% - 230px);
  margin: 0;
  padding: 0;
  min-height: 99.98vh;
}

.push_btn {
  position: relative;
  z-index: 100;
  padding: 5px 3px;
  background: #fff;
  border-bottom: 1px solid #eee;

  .iconfont {
    color: black;
  }
}

.analysis-panel {
  padding: 10px;
  background: #fafafa;
  border-bottom: 1px solid #eee;

  .config-tabs {
    .el-tabs__header {
      margin-bottom: 0;
    }

    .el-tabs__content {
      padding: 0;
    }
  }

  .config-card {
    .config-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .pivot-config {
      .config-row {
        margin-bottom: 10px;
        display: flex;
        align-items: center;

        label {
          width: 70px;
          text-align: right;
          margin-right: 8px;
          font-size: 13px;
          color: #606266;
          flex-shrink: 0;
        }

        .el-select {
          flex: 1;
        }
      }
    }
  }

  .style-config {
    padding: 8px 0;

    .style-section {
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid #f0f0f0;

      &:last-child {
        border-bottom: none;
        margin-bottom: 0;
      }

      .style-section-title {
        font-size: 12px;
        font-weight: bold;
        color: #409eff;
        margin-bottom: 8px;
        padding-left: 4px;
        border-left: 3px solid #409eff;
      }
    }

    .config-row {
      margin-bottom: 8px;
      display: flex;
      align-items: center;

      label {
        width: 80px;
        text-align: right;
        margin-right: 8px;
        font-size: 12px;
        color: #606266;
        flex-shrink: 0;
      }
    }
  }
}

.s2-container {
  position: relative;
  padding: 10px;
  height: calc(100vh - 200px);
  overflow: hidden;
  display: flex;
  flex-direction: column;

  #s2-designer-container {
    flex: 1;
    overflow: hidden;
    width: 100%;
    min-height: 0;
  }
}

.pagination-bar {
  flex-shrink: 0;
  padding: 8px 0 0;
  text-align: center;
}
</style>
