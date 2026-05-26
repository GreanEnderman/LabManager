# Agent Tool Boundaries

本文档定义 Agent 与工具层的边界。核心原则：Agent 负责判断和生成草稿，工具层负责执行副作用。

## 1. Boundary Rules

- Agent 不直接写数据库。
- Agent 不直接发送邮件。
- Agent 不直接改任务状态。
- Agent 不直接创建审批。
- 所有副作用必须通过 Tool 或 Service。
- Tool 必须写审计信息或返回可审计结果。

## 2. Required Tools

### TaskTool

职责：

- `find_existing_open_task(event_id, source_id, task_type)`
- `create_task(task_draft, actor)`
- `update_task_status(task_id, transition, actor)`
- `assign_task(task_id, assignee, actor)`

约束：

- 必须执行任务状态机。
- 必须写 task action。
- 必须返回前端兼容 DTO 或可映射领域对象。

### ApprovalTool

职责：

- `create_approval(approval_draft, actor)`
- `process_approval(approval_id, decision, actor)`

约束：

- 审批状态机必须纯代码。
- 审批处理必须写活动日志。

### AuditLogTool

职责：

- `write_activity_log(log_draft)`
- `write_many(log_drafts)`

约束：

- 必须记录 actor、reason、rule/node/tool、result、timestamp。
- 失败时必须让调用方可见，不能静默吞掉。

### InventoryTool

职责：

- `list_chemicals()`
- `get_chemical(id)`
- `get_stock_snapshot(id)`

约束：

- V1 只读。
- 自动采购不在 V1 范围。

### EquipmentTool

职责：

- `list_equipment()`
- `get_equipment(id)`
- `get_maintenance_snapshot(id)`

约束：

- V1 只读。
- 自动停用设备不在 V1 范围。

### ReportTool

职责：

- `generate_report(type, time_window, actor)`
- `export_pdf(report_id)`

约束：

- 事实统计必须来自数据库或受控 mock。
- LLM 只能生成摘要，不得改写统计数据。

### NotificationTool

职责：

- `send_report(report_id, recipients, actor)`
- `send_reminder(task_id, recipient, actor)`

约束：

- 成功和失败都必须写 delivery record。
- SMTP 失败不能丢失审计记录。

## 3. Graph Integration Rule

Supervisor Graph 中的节点分两类：

- Pure nodes：只更新 `AgentState`，不调用外部工具。
- Effect nodes：只通过 Tool 执行副作用。

V1 骨架先实现 pure nodes 和草稿输出。接入数据库时，优先新增 Tool，不把 repository 调用散落到节点函数里。

## 4. Forbidden Patterns

- 在 Agent 节点里直接执行 SQL。
- 在 Agent 节点里直接发送 SMTP。
- 让 LLM 决定权限、审批门禁、判重、状态流转。
- 为某个页面临时增加一套旁路 DTO。
- 在前端绕过 `/api/ai` 直接调用内部 Agent API。
