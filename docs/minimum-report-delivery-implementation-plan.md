# LabManager 最小可用报告导出与发送实施方案

## 1. 目标

本文档用于收敛 LabManager 当前 P2 阶段中“报告导出与发送”相关能力，目标不是一次性做到生产完备，而是先实现一条可演示、可联调、可验证的最小可用闭环：

- 生成报告
- 导出报告
- 配置接收人
- 手动发送报告
- 查看发送记录

本阶段优先满足“功能基本可用”，暂不追求自动调度、正式邮件网关、失败重试编排等生产增强项。

---

## 2. 本阶段范围

## 2.1 交付范围

- 报告详情页支持打印视图 / 浏览器导出
- 支持维护主管邮箱映射
- 支持维护报告发送配置
- 支持手动发送单份报告
- 支持查看发送记录和失败原因

## 2.2 暂不纳入

- 自动定时发送
- 正式 PDF 引擎生成
- 真实邮件服务商接入
- 失败自动重试
- 月报自动投递编排

---

## 3. 最小业务闭环

本阶段主链路为：

`生成报告 -> 打开报告详情 -> 导出 / 打印 -> 配置接收人 -> 点击立即发送 -> 查看发送记录`

建议采用以下实现策略：

- 导出能力先使用打印页 + 浏览器另存为 PDF
- 发送能力先使用后端 stub sender
- 发送方式先支持手动触发
- 所有发送动作必须保留活动日志和发送记录

---

## 4. 数据对象设计

## 4.1 SupervisorEmailMapping

用途：
维护实验室 / 部门 / 全局范围到接收人的邮箱映射。

建议字段：

- `id`
- `scopeType`
- `scopeId`
- `scopeName`
- `recipientName`
- `recipientEmail`
- `enabled`
- `createdAt`
- `updatedAt`

建议取值：

- `scopeType`: `lab | department | global`

## 4.2 ReportDeliveryConfig

用途：
定义哪类报告可发送、发送到哪个范围、是否启用。

建议字段：

- `id`
- `reportType`
- `scopeType`
- `scopeId`
- `scopeName`
- `channel`
- `enabled`
- `createdAt`
- `updatedAt`

建议取值：

- `reportType`: `daily | weekly | risk_summary`
- `channel`: `email`

## 4.3 ReportDeliveryRecord

用途：
记录每次发送行为和结果。

建议字段：

- `id`
- `reportId`
- `reportTitle`
- `reportType`
- `recipientName`
- `recipientEmail`
- `channel`
- `status`
- `errorMessage`
- `triggeredBy`
- `triggerMode`
- `sentAt`
- `createdAt`

建议取值：

- `status`: `success | failed`
- `triggerMode`: `manual`

---

## 5. 后端实施方案

## 5.1 合同层

优先修改：

- `backend/src/contracts/shared.ts`

新增 DTO：

- `SupervisorEmailMappingDTO`
- `ReportDeliveryConfigDTO`
- `ReportDeliveryRecordDTO`

新增请求 / 响应：

- `ListSupervisorEmailMappingsQuery`
- `UpsertSupervisorEmailMappingRequest`
- `ListReportDeliveryConfigsQuery`
- `UpsertReportDeliveryConfigRequest`
- `ListReportDeliveryRecordsQuery`
- `SendReportRequest`
- `SendReportResponse`

## 5.2 领域层

优先修改：

- `backend/src/domain/models.ts`
- `backend/src/domain/types.ts`
- `backend/src/domain/mappers.ts`

新增 record / type：

- `SupervisorEmailMappingRecord`
- `ReportDeliveryConfigRecord`
- `ReportDeliveryRecord`
- `ReportDeliveryChannel`
- `ReportDeliveryStatus`
- `DeliveryScopeType`
- `DeliveryTriggerMode`

## 5.3 存储层

优先修改：

- `backend/src/services/store.ts`

在 `AIDataStore` 中新增：

- `reportDeliveryMappings`
- `reportDeliveryConfigs`
- `reportDeliveryRecords`

## 5.4 服务层

新增文件：

- `backend/src/services/report-delivery-service.ts`

服务职责：

- 查询邮箱映射
- 保存邮箱映射
- 查询发送配置
- 保存发送配置
- 查询发送记录
- 执行手动发送

`sendReport` 最小流程建议：

1. 根据 `reportId` 查报告
2. 查启用的发送配置
3. 查命中的邮箱映射
4. 无接收人时写失败记录
5. 调用 stub sender
6. 写发送记录
7. 写活动日志

## 5.5 应用层聚合

优先修改：

- `backend/src/services/api-factory.ts`

新增应用服务接口：

- `listSupervisorEmailMappings`
- `saveSupervisorEmailMapping`
- `listReportDeliveryConfigs`
- `saveReportDeliveryConfig`
- `listReportDeliveryRecords`
- `sendReport`

## 5.6 HTTP 路由层

优先修改：

- `backend/src/http/router.ts`

新增最小接口：

- `GET /api/ai/report-delivery/mappings`
- `POST /api/ai/report-delivery/mappings`
- `PATCH /api/ai/report-delivery/mappings/:mappingId`
- `GET /api/ai/report-delivery/configs`
- `POST /api/ai/report-delivery/configs`
- `PATCH /api/ai/report-delivery/configs/:configId`
- `GET /api/ai/report-delivery/records`
- `POST /api/ai/report-delivery/send`

---

## 6. 前端实施方案

## 6.1 网关与运行时

优先修改：

- `frontend/src/runtime/aiGateway.ts`
- `frontend/src/runtime/httpAiGateway.ts`
- `frontend/src/runtime/aiAppFacade.ts`
- `frontend/src/runtime/aiAppFacadeAsync.ts`
- `frontend/src/runtime/aiAppClient.ts`

新增前端能力：

- 拉取发送配置
- 拉取发送记录
- 保存邮箱映射
- 保存发送配置
- 手动发送报告

## 6.2 前端状态层

优先修改：

- `frontend/src/ai/types.ts`
- `frontend/src/ai/AIStateLive.tsx`

建议新增状态：

- `reportDeliveryMappings`
- `reportDeliveryConfigs`
- `reportDeliveryRecords`

建议新增动作：

- `saveReportDeliveryMapping`
- `saveReportDeliveryConfig`
- `sendReport`

## 6.3 报告导出能力

优先修改：

- `frontend/src/pages/AIWorkbench.tsx`
- `frontend/src/App.tsx`

新增文件：

- `frontend/src/pages/AIReportPrint.tsx`

建议方案：

- 在报告详情中增加“打印 / 导出”按钮
- 新增打印页路由
- 打印页只保留报告正文、摘要、重点内容和生成时间
- 用户通过浏览器打印能力导出为 PDF

## 6.4 报告发送配置页

新增文件：

- `frontend/src/pages/ReportDeliverySettings.tsx`

建议页面结构：

- 主管邮箱映射列表与表单
- 报告发送配置列表与表单
- 最近发送记录列表

优先修改：

- `frontend/src/App.tsx`
- `frontend/src/layouts/MainLayout.tsx`

新增路由建议：

- `/report-delivery`

## 6.5 报告详情发送入口

优先修改：

- `frontend/src/pages/AIWorkbench.tsx`

建议新增：

- `立即发送` 按钮
- 发送中状态
- 发送成功 / 失败提示
- 最近一次发送状态摘要

---

## 7. 验证方案

## 7.1 后端验证

新增文件：

- `backend/src/qa/p2-validation.ts`

至少覆盖以下场景：

- 有启用配置且有邮箱映射时发送成功
- 无邮箱映射时发送失败
- 禁用配置时不发送
- 发送记录可查询
- 发送动作可追溯到活动日志

## 7.2 前端 / 联调验证

新增文档：

- `docs/qa-p2-minimum-report-delivery.md`

最小验收路径建议：

1. 生成一份日报
2. 打开报告详情
3. 进入打印页
4. 新增邮箱映射
5. 新增发送配置
6. 点击立即发送
7. 在记录页看到成功记录
8. 禁用映射或清空邮箱后再次发送
9. 在记录页看到失败原因

---

## 8. 推荐开发顺序

建议严格按以下顺序推进：

1. `backend/src/contracts/shared.ts`
2. `backend/src/domain/models.ts`
3. `backend/src/domain/types.ts`
4. `backend/src/domain/mappers.ts`
5. `backend/src/services/store.ts`
6. `backend/src/services/report-delivery-service.ts`
7. `backend/src/services/api-factory.ts`
8. `backend/src/http/router.ts`
9. `backend/src/qa/p2-validation.ts`
10. `frontend/src/runtime/aiGateway.ts`
11. `frontend/src/runtime/httpAiGateway.ts`
12. `frontend/src/runtime/aiAppFacade.ts`
13. `frontend/src/runtime/aiAppFacadeAsync.ts`
14. `frontend/src/runtime/aiAppClient.ts`
15. `frontend/src/ai/types.ts`
16. `frontend/src/ai/AIStateLive.tsx`
17. `frontend/src/pages/AIReportPrint.tsx`
18. `frontend/src/pages/ReportDeliverySettings.tsx`
19. `frontend/src/pages/AIWorkbench.tsx`
20. `frontend/src/App.tsx`
21. `frontend/src/layouts/MainLayout.tsx`
22. `docs/qa-p2-minimum-report-delivery.md`
23. `docs/project-sync-status.md`
24. `docs/ai-executable-backlog.md`

---

## 9. 建议拆分为两个小 Sprint

## Sprint A：后端打底 + 导出最小版

- 冻结发送相关 DTO 与 record
- 完成发送服务和接口
- 完成 stub sender
- 完成后端最小验证
- 完成报告打印页

验收结果：

- 能生成报告
- 能打开打印页
- 能通过接口完成一次手动发送

## Sprint B：配置页 + 记录页 + 联调

- 完成邮箱映射页
- 完成发送配置页
- 完成发送记录页
- 在报告详情中串联立即发送
- 完成最小验收文档和同步文档

验收结果：

- 前端可独立完成发送闭环演示
- 失败场景有可见反馈

---

## 10. Definition of Done

本阶段“最小可用版”完成至少满足：

- 报告支持打印 / 导出入口
- 前端可维护最少一条邮箱映射
- 前端可维护最少一条发送配置
- 用户可手动发送一份报告
- 发送成功与失败都能在记录中查看
- 发送动作带有活动日志
- 至少有一份 P2 最小验收清单
- 不破坏现有 AI 工作台、报告中心和前端演示闭环
