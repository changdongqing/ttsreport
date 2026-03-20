## 简介

&emsp; &emsp; 基于AJ-Report，针对excel报表逐步优化。<br>
&emsp; &emsp;
技术等文档请去aj-report项目查看，我不会写代码，我都是让ai帮我写的。欢迎体验。

## excel报表优化项

### 数据集

报表条件增加“数据类型”：选择器（也就是下拉）、日期、时间、日期时间、输入框、数字输入框；

报表条件默认值优化：支持更方便的默认值配置，包括当前日期、月初、月末、年初、年末、用户所属机构、用户所属部门、用户所属岗位等等，因为不需要登录了，与用户相关的都是由其他系统插入缓存的，从缓存取；
  
报表条件增加“字典、参数”两列，仅当数据类型为选择器时生效，优先按照字典（输入字典编码），没有字典则需要录入参数，参数的参考json为：  

```
[
  {
    "key": "张三",
    "value": "yh01"
  },
  {
    "key": "李四",
    "value": "yh02"
  },
  {
    "key": "王五",
    "value": "yh03"
  }
]
```

### excel报表预览

* 查询条件从左侧改到了上方，也就是从上到下为：查询条件、按钮、报表表格
* 增加分页，为前端分页，因此不影响导出
* 隐藏luckysheet的几个显示状态等的区域，界面利用率更高
* 查询条件根据数据集配置显示不同的组件，如下拉选择、input、日期选择器、数字输入框等

### 分析报表

* 新增分析报表，也就是交叉透视表，采用antv s2实现；


## 后续优化项todo--

* 鉴权（通过配置授权编码，无需登录）
* 查询条件，级联选择器实现；

-----------------------------------------------------------------------------

<img width="2643" height="939" alt="image" src="https://github.com/user-attachments/assets/6cdd28c1-dd8b-4fa9-9387-f719e12d552a" />

<img width="2106" height="1221" alt="image" src="https://github.com/user-attachments/assets/96dfa9e7-d1dd-4ff1-b7eb-0da434ea67d1" />

<img width="2670" height="1463" alt="image" src="https://github.com/user-attachments/assets/6ad3b0e3-2aca-494b-b8a4-6902cb236055" />

<img width="2631" height="1497" alt="image" src="https://github.com/user-attachments/assets/853bed17-ef1a-465c-8cd5-88db9136aac0" />



--------------------------
## 感谢aj-report

郑重感谢aj-report项目，其他参考文档可以去看aj-report项目。

