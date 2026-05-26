# LabManager Python 首批能力迁移计划

## 1. 文档目的

本文档把 Python 首批承接能力的实施边界收敛成一份可直接执行的迁移说明，覆盖：

- 首批能力范围
- 共享 DTO / 输入输出契约清单
- 现有 TypeScript 参考实现映射
- 分能力切流与回退边界
- parity 验证标准
- 面向 Python 的首批实施 backlog

本文档不改变 `backend/src/contracts/shared.ts` 的单一 DTO 真相地位，也不在这里定义第二套协议。

## 2. 首批迁移能力范围

首批由 Python 承接的能力固定为以下 6 项：

1. 异步任务执行基础能力
2. 规则服务
3. 导入服务
4. 报告生成
5. PDF 导出
6. 邮件投递

范围约束：

- 本批次只定义边界、映射、切流与验证标准。
- 本批次不要求同时替换全部 TS HTTP API。
- 新增重型生产后端能力默认进入 Python 边界，不再继续扩张 TS 原型后端。

## 3. Canonical DTO / 输入输出契约清单

以下契约全部以 `backend/src/contracts/shared.ts` 为准，Python 侧只能消费、适配、复用，不能平行复制语义。

### 3.1 规则服务

- 输入：
  - `InspectRulesRequest`
  - `ExecuteRuleEventRequest`
  - `RuleEvaluationRequest`
- 输出：
  - `InspectRulesResponse`
  - `ExecuteRuleEventResponse`
  - `RuleEvaluationResponse`
- 说明：
  - 事件生成输入目前还包含 TS 内部组合类型 `EventGenerationInput` / `EventGenerationConfig`，Python 实施时应通过适配层收口到共享 DTO 或固定服务边界，不得在页面层扩散新协议。

### 3.2 导入服务

- 输入：
  - `ImportChemicalsRequest`
  - `ImportEquipmentRequest`
  - `ListImportBatchesQuery`
- 输出：
  - `ImportChemicalsResponse`
  - `ImportEquipmentResponse`
  - `ImportBatchDetailDTO`
  - `ImportBatchDTO`
  - `ImportErrorDTO`
- 说明：
  - 导入后是否触发规则巡检由请求中的 `runRuleInspection` 和返回批次中的巡检结果字段共同体现。

### 3.3 报告生成

- 输入：
  - `GenerateReportRequest`
  - `ListReportsQuery`
- 输出：
  - `GenerateReportResponse`
  - `AIReportDTO`
- 说明：
  - 报告摘要、亮点、metadata.sections 属于结果的一部分，Python 侧需要保持字段语义稳定。

### 3.4 PDF 导出

- 输入：
  - 报告标识 `reportId`，当前通过 `/api/ai/reports/:id/pdf` 路由进入
- 输出：
  - `ExportReportPdfResponse`
- 说明：
  - 结果包含 `fileName`、`mimeType`、`contentBase64`，Python 实施必须保持交付协议不变。

### 3.5 邮件投递

- 输入：
  - `SendReportRequest`
  - `UpsertSupervisorEmailMappingRequest`
  - `UpsertReportDeliveryConfigRequest`
  - `ListSupervisorEmailMappingsQuery`
  - `ListReportDeliveryConfigsQuery`
  - `ListReportDeliveryRecordsQuery`
- 输出：
  - `SendReportResponse`
  - `SupervisorEmailMappingDTO`
  - `ReportDeliveryConfigDTO`
  - `ReportDeliveryRecordDTO`
- 说明：
  - 邮件投递除了响应 DTO，还必须保留失败记录、投递记录和活动日志副作用。

### 3.6 异步任务执行

- 当前共享 DTO 中没有单独冻结一套“任务队列管理 DTO”。
- Python 首批实施边界定义为：
  - 接收上游服务提交的后台执行请求
  - 返回可追踪的任务提交结果或同步回执
  - 承担规则巡检、报告生成、PDF 导出、邮件发送等长耗时任务的生产级执行底座
- 约束：
  - 在没有新增共享 DTO 之前，异步执行能力的外部协议应先通过应用服务边界和任务审计字段收口，不得在前端直接暴露临时队列协议。

## 4. TypeScript 参考实现映射

Python 迁移期间，以下 TS 文件是行为对照基线：

### 4.1 规则服务

- 主服务：
  - `backend/src/services/rule-engine-service.ts`
- 关键行为模块：
  - `backend/src/ai/event-generator.ts`
  - `backend/src/ai/rule-gate.ts`
  - `backend/src/ai/graph-runner.ts`
  - `backend/src/ai/supervisor-router.ts`
  - `backend/src/ai/inventory-handler.ts`
  - `backend/src/ai/maintenance-handler.ts`
  - `backend/src/ai/fault-handler.ts`

### 4.2 导入服务

- 主服务：
  - `backend/src/services/import-service.ts`
- 关键映射：
  - `backend/src/domain/mappers.ts`
  - `backend/src/domain/models.ts`

### 4.3 报告生成

- 主服务：
  - `backend/src/services/report-service.ts`
- 关键依赖：
  - `backend/src/services/llm-service.ts`
  - `backend/src/domain/mappers.ts`

### 4.4 PDF 导出

- 主服务：
  - `backend/src/services/report-export-service.ts`
- 关键运行时约束：
  - `pdf-lib`
  - `@pdf-lib/fontkit`
  - Windows CJK 字体路径候选

### 4.5 邮件投递

- 主服务：
  - `backend/src/services/report-delivery-service.ts`
- 关键依赖：
  - `backend/src/services/email-sender.ts`
  - `backend/src/services/smtp-email-sender.ts`
  - `backend/src/domain/activity-log.ts`

### 4.6 异步任务执行

- 当前 TS 中没有单独的生产级异步队列子系统。
- 参考责任来自：
  - 规则执行链路中的 background / routine / priority queue 语义
  - 报告生成与报告投递的长耗时责任分层
  - `python_backend/app/tasks/celery_app.py` 已搭好的 Python 目标执行底座

## 5. Python 目标所有权边界

### 5.1 所有权原则

- Python 是首批 6 项能力的目标默认 owner。
- TS 在迁移期仍是 active runtime reference。
- 同一时间可以只迁一个能力的 active runtime，不要求整栈切换。

### 5.2 分能力 owner 定义

| 能力 | 当前 active runtime | 目标 owner | 备注 |
| --- | --- | --- | --- |
| 异步任务执行 | TS 中无正式底座 | Python | 先建设底座，再承接下游长任务 |
| 规则服务 | TypeScript | Python | 迁移后成为事件判断与执行主入口 |
| 导入服务 | TypeScript | Python | 保留导入后巡检联动 |
| 报告生成 | TypeScript | Python | 保持报表 DTO 语义不变 |
| PDF 导出 | TypeScript | Python | 保持下载协议稳定 |
| 邮件投递 | TypeScript | Python | 保持投递记录与审计副作用 |

## 6. 切流边界设计

为了避免“全量切栈”，每个能力都要有独立切流边界。推荐按 capability flag 或 gateway 路由绑定表达，而不是一个全局 `python_enabled` 开关。

### 6.1 推荐 capability flags

- `PY_BACKEND_ASYNC_ENABLED`
- `PY_BACKEND_RULES_ENABLED`
- `PY_BACKEND_IMPORT_ENABLED`
- `PY_BACKEND_REPORT_ENABLED`
- `PY_BACKEND_REPORT_PDF_ENABLED`
- `PY_BACKEND_REPORT_DELIVERY_ENABLED`

### 6.2 切流规则

- 每个 flag 只控制一个能力的 active runtime。
- 未开启时默认仍走 TS。
- 开启前必须通过该能力自己的 parity 验证。
- 某个能力回退时，不应连带回退其他已稳定能力。

### 6.3 推荐切流落点

- HTTP / gateway 层：
  - 适合规则、导入、报告、PDF、邮件投递这类已有入口的能力
- 应用服务编排层：
  - 适合异步任务提交、内部 handler 分发
- 后台 worker 层：
  - 适合仅在后台消费、不直接暴露给前端的长任务

## 7. 依赖感知迁移顺序

推荐顺序固定为：

1. 异步任务执行基础能力
2. 规则服务
3. 导入服务
4. 报告生成
5. PDF 导出
6. 邮件投递

原因：

- 报告 / PDF / 邮件需要稳定的后台执行基座。
- 导入依赖规则巡检语义。
- 邮件投递依赖报告产物和 PDF 附件。

## 8. 分能力回退策略

### 8.1 通用回退原则

- 只回退发生问题的单个能力。
- 回退后 DTO 语义、审计字段、活动日志口径不能漂移。
- 回退不要求删除 Python 实现，只要求恢复 active runtime 到 TS。

### 8.2 规则服务回退

- 触发条件：
  - 规则判定结果不一致
  - duplicate task / approval gate / SLA 行为不一致
- 回退动作：
  - 将 rules runtime 切回 `backend/src/services/rule-engine-service.ts`
  - 保留 Python 代码用于修复，不影响其他能力

### 8.3 导入服务回退

- 触发条件：
  - 批次成功失败统计不一致
  - 导入错误明细或巡检联动不一致
- 回退动作：
  - 导入入口切回 TS `ImportService`

### 8.4 报告生成回退

- 触发条件：
  - 摘要、亮点、metadata 结构不一致
  - 时间窗口统计或 LLM fallback 行为不一致
- 回退动作：
  - 报告生成请求切回 TS `ReportService`

### 8.5 PDF 导出回退

- 触发条件：
  - 生成失败
  - 字体、排版、中文渲染或附件协议不满足要求
- 回退动作：
  - PDF 导出请求切回 TS `ReportExportService`

### 8.6 邮件投递回退

- 触发条件：
  - 收件人解析错误
  - 附件投递错误
  - 投递记录或活动日志缺失
- 回退动作：
  - 邮件发送与投递记录流程切回 TS `ReportDeliveryService`

### 8.7 异步执行回退

- 触发条件：
  - 队列堆积
  - 重试策略失效
  - 后台任务状态不可追踪
- 回退动作：
  - 恢复由现有 TS runtime / 同步路径承担 active execution
  - 暂停 Python worker 作为生产执行入口

## 9. Parity 验证标准

### 9.1 通用标准

每个能力切流前至少验证以下 5 类一致性：

1. 输入契约一致
2. 输出 DTO 语义一致
3. 失败分支一致
4. 审计 / 活动日志副作用一致
5. 回退后可恢复到 TS 基线

### 9.2 分能力 parity 检查

#### 规则服务

- 相同输入下事件生成数量、类型、优先级、风险级别一致
- rule gate 判定一致
- duplicate open task 判重行为一致
- execute 流程中的 task / approval / report 副作用一致

#### 导入服务

- 化学品 / 设备导入成功数、失败数一致
- `ImportErrorDTO` 内容一致
- `ImportBatchDTO` 状态与统计字段一致
- 导入后 rule inspection 触发行为一致

#### 报告生成

- 统计窗口一致
- `AIReportDTO` 结构一致
- summary / highlights / metadata.sections 语义一致
- LLM 不可用时 fallback 行为一致

#### PDF 导出

- `ExportReportPdfResponse` 字段一致
- 文件可打开、内容完整
- 中文文本和重点条目不丢失
- 文件名与 MIME 类型一致

#### 邮件投递

- 收件人映射和 config 过滤规则一致
- 附件包含 PDF
- `SendReportResponse.records` 结果一致
- 成功 / 失败都能留下 delivery record 和 activity log

#### 异步执行

- 任务提交后可追踪
- 失败时可重试或有明确失败记录
- 长任务不阻塞前台请求
- 与审计、日志、下游服务联动边界清晰

## 10. 运行时特定 parity 风险

### 10.1 PDF 渲染

- TS 当前依赖 Windows 字体候选路径，Python 不应默认假设字体环境相同
- parity 不只看 DTO，还要看：
  - 中文是否乱码
  - 段落是否截断
  - bullet / section 是否缺失
  - 文件大小和可读性是否异常

### 10.2 邮件副作用

- parity 不只看发送成功响应，还要看：
  - 收件人是否正确展开
  - 附件是否存在
  - SMTP 失败时错误是否回写
  - activity log 是否完整

### 10.3 审计连续性

- Python 切流后必须保持：
  - 触发人
  - 触发原因
  - 结果
  - 时间
  - runId / deliveryRecordId / reportId 等关联字段

### 10.4 后台执行行为

- parity 不能只验证“最终成功”，还要验证：
  - 排队
  - 重试
  - 幂等
  - 失败可见性
  - 与切流开关的一致性

## 11. 首批 Python 服务切片 backlog

### Slice 1: Async Foundation

- 建立后台任务提交/追踪边界
- 固化 worker 执行日志和失败记录
- 为规则、报告、PDF、邮件准备统一后台执行入口

### Slice 2: Rules Service

- 在 Python 中复刻 rules inspection / execution capability
- 对照 TS 基线补 parity fixtures
- 接入 capability flag

### Slice 3: Import Service

- 承接 chemicals / equipment import
- 保留 batch / error / inspection 联动
- 接入 capability flag

### Slice 4: Report Generation

- 承接 report aggregation 和 narrative generation
- 固化 fallback 行为
- 接入 capability flag

### Slice 5: PDF Export

- 承接 PDF 生成与附件协议
- 解决字体/渲染部署问题
- 接入 capability flag

### Slice 6: Report Delivery

- 承接 recipient mapping、delivery config、SMTP 投递、delivery records、activity logs
- 接入 capability flag

## 12. 实施前准入条件

进入每个 slice 之前，至少要满足：

- 共享 DTO 已明确复用点
- TS reference surface 已标注
- capability flag / routing boundary 已确定
- rollback 动作已写明
- parity 验收项可人工或脚本验证
