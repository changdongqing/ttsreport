-- 为 gaea_report_data_set_param 表新增字段
ALTER TABLE `gaea_report_data_set_param`
    ADD COLUMN `multiple_select` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否多选 0--否 1--是' AFTER `order_num`,
    ADD COLUMN `dict_code` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '字典' AFTER `multiple_select`,
    ADD COLUMN `ext_param` mediumtext CHARACTER SET utf8 COLLATE utf8_general_ci NULL COMMENT '参数（支持JSON，数据长度不限）' AFTER `dict_code`,
    ADD COLUMN `default_value` varchar(1024) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL COMMENT '默认值' AFTER `ext_param`,
    ADD COLUMN `sort_order` int(11) NOT NULL DEFAULT 1 COMMENT '显示顺序' AFTER `default_value`;
