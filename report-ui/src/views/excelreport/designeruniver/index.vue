<!--
 * Univer Designer Page
 * Migrated from the Luckysheet-based designer (excelreport/designer)
 * Uses Univer for spreadsheet editing instead of Luckysheet
 -->
<template>
  <div class="layout">
    <div class="layout-left">
      <div class="add-collection">
        数据集管理
        <el-button
          type="text"
          icon="el-icon-circle-plus-outline"
          @click="queryAllDataSet()"
        />
      </div>
      <div>
        <el-collapse
          v-for="(item, indexs) in dataSet"
          :key="indexs"
          v-model="activeNames"
          @change="handleChange"
        >
          <el-collapse-item :title="item.setName" :name="item.id">
            <el-popconfirm
              :title="'确定删除' + item.setName + '吗？'"
              @confirm="del(item)"
            >
              <el-button
                slot="reference"
                type="text"
                icon="el-icon-close"
                class="delect-all"
              />
            </el-popconfirm>
            <div
              v-for="(i, index) in item.setParamList"
              :key="index"
              class="field-container"
              draggable="true"
              @dragstart="onDragStart(item.setCode, i, $event)"
            >
              <div class="aRow">
                <span>{{ i }}</span>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>
    <div class="layout-middle">
      <div class="push_btn">
        <el-tooltip class="item" effect="dark" content="预览" placement="bottom-start">
          <el-button type="text" @click="preview()">
            <i class="iconfont iconfuzhi"></i>
          </el-button>
        </el-tooltip>
        <el-tooltip class="item" effect="dark" content="保存" placement="bottom-start">
          <el-button type="text" @click="save()">
            <i class="iconfont iconsave"></i>
          </el-button>
        </el-tooltip>
      </div>
      <div v-if="loading" class="loading-mask">
        <i class="el-icon-loading"></i>
        <span>正在加载 Univer...</span>
      </div>
      <div
        id="univer-container"
        style="
          margin: 0px;
          padding: 0px;
          position: absolute;
          width: 100%;
          height: 95vh;
          left: 0px;
          top: 45px;
          bottom: 0px;
        "
      />
    </div>

    <div class="layout-right">
      <el-tabs v-model="activeName" @tab-click="handleClick">
        <el-tab-pane label="基础配置" name="first">
          <el-form ref="rightForm" :model="rightForm" label-width="70px">
            <el-form-item label="坐标">
              <el-input v-model="rightForm.coordinate" disabled />
            </el-form-item>
            <el-form-item label="值">
              <el-input v-model="rightForm.value" disabled />
            </el-form-item>
          </el-form>
          <div class="info-section">
            <h4>Univer 设计器</h4>
            <p class="info-text">使用 Univer 引擎替代 Luckysheet</p>
            <p class="info-text">数据格式自动兼容</p>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-dialog title="数据集管理" :visible.sync="outerVisible">
      <el-table
        ref="multipleTable"
        :data="dataSetData"
        tooltip-effect="dark"
        style="width: 100%; height: 60vh; overflow-y: scroll"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column label="数据集名称" width="120" prop="setName" />
        <el-table-column prop="setDesc" label="数据集描述" width="180" />
        <el-table-column prop="setCode" label="数据集编码" show-overflow-tooltip />
      </el-table>

      <div slot="footer" class="dialog-footer">
        <el-button @click="outerVisible = false">取 消</el-button>
        <el-button type="primary" @click="checkDataSet()">确定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { queryAllDataSet, detail, detailByReportCode } from "@/api/GaeaReport";
import { addReportExcel, editReportExcel } from "@/api/report";
import { luckysheetToUniver, univerToLuckysheet } from "../univer/luckysheetAdapter";
import { createUniverSheet, getWorkbookSnapshot, destroyUniver } from "../univer/univerService";

export default {
  name: "DesignerUniver",
  data() {
    return {
      loading: true,
      activeName: "first",
      activeNames: ["1"],
      reportId: null,
      accessKey: null,
      reportCode: "",
      sheetData: [],
      dataSetData: [],
      dataSet: [],
      reportExcelDto: {
        id: null,
        jsonStr: "",
        setCodes: "",
        setParam: "",
        reportCode: "",
      },
      multipleSelection: [],
      rightForm: {
        coordinate: "",
        value: "",
      },
      outerVisible: false,
      // Univer instances
      univerInstance: null,
      univerAPI: null,
      workbook: null,
    };
  },
  created() {
    this.reportCode = this.$route.query.reportCode;
    this.accessKey = this.$route.query.accessKey;
    this.loadDataSet();
    this.design();
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
    handleChange() {},
    handleClick() {},

    /**
     * Load report data and initialize Univer
     */
    async design() {
      try {
        const { code, data } = await detailByReportCode(this.reportCode);
        if (data != null) {
          this.reportId = data.id;
        }
        this.sheetData = data == null ? [{}] : JSON.parse(data.jsonStr);

        // Convert Luckysheet data to Univer format
        var workbookData = luckysheetToUniver(this.sheetData);

        // Initialize Univer
        var result = await createUniverSheet({
          container: "univer-container",
          workbookData: workbookData,
          editable: true,
        });

        this.univerInstance = result.univer;
        this.univerAPI = result.univerAPI;
        this.workbook = result.workbook;
        this.loading = false;

        // Set up cell selection listener
        this.setupSelectionListener();

        // Load associated datasets
        if (data != null && data.setCodes != null && data.setCodes !== "") {
          var dataSetList = data.setCodes.split("|");
          dataSetList.forEach((code) => {
            this.dataSetData.forEach((setData) => {
              if (code === setData.setCode) {
                this.detail(setData.id);
              }
            });
          });
        }
      } catch (e) {
        console.error("Failed to initialize Univer designer:", e);
        this.loading = false;
        this.$message.error("初始化 Univer 失败: " + e.message);
      }
    },

    /**
     * Set up listener for cell selection changes
     */
    setupSelectionListener() {
      try {
        var self = this;
        if (this.univerAPI) {
          this.univerAPI.onCommandExecuted(function (command) {
            // Update right panel when selection changes
            if (command.id && command.id.indexOf('SetSelectionsOperation') !== -1) {
              self.updateRightPanel();
            }
          });
        }
      } catch (e) {
        console.warn('Failed to set up selection listener:', e);
      }
    },

    /**
     * Update right panel info based on current selection
     */
    updateRightPanel() {
      try {
        var wb = this.univerAPI && this.univerAPI.getActiveWorkbook();
        if (!wb) return;
        var sheet = wb.getActiveSheet();
        if (!sheet) return;
        var selection = sheet.getSelection();
        if (!selection) return;
        var range = selection.getActiveRange();
        if (!range) return;
        var row = range.getRow();
        var col = range.getColumn();
        this.rightForm.coordinate = row + "," + col;
        var cell = sheet.getRange(row, col);
        if (cell) {
          this.rightForm.value = cell.getValue() || "";
        }
      } catch (e) {
        // Silently ignore - not critical
      }
    },

    /**
     * Save the report
     */
    async save() {
      try {
        // Get snapshot from Univer and convert back to Luckysheet format
        var snapshot = getWorkbookSnapshot(this.univerAPI);
        if (!snapshot) {
          this.$message.error("获取工作簿数据失败");
          return;
        }

        var luckyData = univerToLuckysheet(snapshot);

        // Clear data arrays to match the old designer behavior (use celldata as primary)
        for (var i = 0; i < luckyData.length; i++) {
          luckyData[i]["data"] = [];
        }

        this.reportExcelDto.jsonStr = JSON.stringify(luckyData);

        var setCodeList = [];
        var setParams = {};
        this.dataSet.forEach((code) => {
          setCodeList.push(code.setCode);
          if (code.dataSetParamDtoList != null && code.dataSetParamDtoList.length > 0) {
            var dataSetParam = {};
            code.dataSetParamDtoList.forEach((value) => {
              dataSetParam[value.paramName] = value.sampleItem;
            });
            setParams[code.setCode] = dataSetParam;
          }
        });

        this.reportExcelDto.setParam = JSON.stringify(setParams);
        this.reportExcelDto.setCodes = setCodeList.join("|");
        this.reportExcelDto.reportCode = this.reportCode;

        if (this.reportId == null) {
          const { code } = await addReportExcel(this.reportExcelDto);
          if (code != "200") return;
          this.$message.success("保存成功");
        } else {
          this.reportExcelDto.id = this.reportId;
          const { code } = await editReportExcel(this.reportExcelDto);
          if (code != "200") return;
          this.$message.success("更新成功");
        }
      } catch (e) {
        console.error("Save failed:", e);
        this.$message.error("保存失败: " + e.message);
      }
    },

    /**
     * Open preview page
     */
    preview() {
      var routeUrl = this.$router.resolve({
        path: "/excelreport/vieweruniver",
        query: { reportCode: this.reportCode },
      });
      window.open(routeUrl.href, "_blank");
    },

    /**
     * Drag field from dataset panel
     */
    onDragStart(setCode, fieldLabel, evt) {
      var placeholder = "#{" + setCode + "." + fieldLabel + "}";
      evt.dataTransfer.setData("text/plain", placeholder);
    },

    // === Dataset management methods (reused from old designer) ===

    async loadDataSet() {
      const { code, data } = await queryAllDataSet();
      this.dataSetData = data;
      if (code != "200") return;
    },
    async queryAllDataSet() {
      this.outerVisible = true;
    },
    handleSelectionChange(val) {
      this.multipleSelection = val;
    },
    checkDataSet() {
      this.outerVisible = false;
      this.multipleSelection.forEach((value) => {
        this.detail(value.id);
      });
    },
    async detail(id) {
      const { code, data } = await detail(id);
      if (code != 200) return;
      var flag = true;
      this.dataSet.forEach((value) => {
        if (value.setCode === data.setCode) {
          flag = false;
        }
      });
      if (flag) {
        this.dataSet.push(data);
      }
    },
    del(val) {
      for (var i = 0; i < this.dataSet.length; i++) {
        if (this.dataSet[i].setCode === val.setCode) {
          this.dataSet.splice(i, 1);
        }
      }
    },
  },
};
</script>

<style scoped lang="scss">
.loading-mask {
  position: absolute;
  top: 45px;
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

.info-section {
  padding: 10px 0;
  h4 {
    margin: 10px 0 5px;
    color: #333;
  }
  .info-text {
    font-size: 12px;
    color: #999;
    margin: 3px 0;
  }
}

.el-collapse {
  position: relative;
  border-top: 0 solid #e6ebf5;
  border-bottom: 0 solid #e6ebf5;
}

.el-collapse-item__header {
  border-bottom: 0 solid #e6ebf5 !important;
}

.delect-all {
  position: absolute;
  top: 10px;
  right: 30px;
  color: #333;
}

.push_btn {
  position: absolute;
  z-index: 100;
  top: 5px;
  left: 3px;

  .iconfont {
    color: black;
  }
}

.add-collection {
  line-height: 30px;

  .el-button {
    font-size: 16px !important;
    vertical-align: middle;
    margin-left: 20px;
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

  .field-container {
    display: block;
    position: relative;
    width: 100%;
    margin: 0;
    cursor: grab;
    line-height: 30px;

    .aRow {
      padding: 0 10px;

      &:hover {
        background: #f7fafd;
      }
    }
  }
}

.layout-middle {
  display: block;
  position: absolute;
  left: 230px;
  right: 230px;
  width: calc(100% - 460px);
  margin: 0;
  padding: 0;
}

.layout-right {
  display: block;
  position: absolute;
  top: 0;
  right: 0;
  padding: 20px;
  width: 230px;
  min-height: 99.98vh;
  border-left: 1px solid #dcdee2;
  border-color: #e8eaec;
  background: #fff;
  border-radius: 4px;
  font-size: 14px;
  transition: all 0.2s ease-in-out;
}
</style>
