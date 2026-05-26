# Agent Node Contracts

本文档冻结 Python Supervisor Graph V1 节点契约。节点之间只通过 `AgentState` 传递信息；副作用必须通过工具层。

## 1. AgentState

V1 状态字段：

| Field | Meaning |
| --- | --- |
| `event` | 原始或标准化后的 AI 事件 |
| `normalizedEvent` | 标准化事件 |
| `ruleDecision` | 规则门禁结果 |
| `supervisorDecision` | Supervisor 分派结果 |
| `handlerResult` | 专项 Agent 输出 |
| `recommendation` | 推荐动作摘要 |
| `approvalDecision` | 审批门禁结果 |
| `taskDraft` | 待创建或更新的任务草稿 |
| `approvalDraft` | 待创建审批草稿 |
| `activityLogDrafts` | 活动日志草稿列表 |
| `output` | 对 API 层返回的稳定输出 |
| `errors` | 可恢复错误列表 |
| `lastStep` | 最近执行节点 |

## 2. Event Ingestor

输入：

- `event`

输出：

- `lastStep = "event_ingestor"`
- activity log draft: event accepted

约束：

- 不做业务判断。
- 不写数据库。

## 3. Normalize Event

输入：

- `event`

输出：

- `normalizedEvent`

约束：

- 只补默认值、统一字段、保证三类 V1 事件可识别。
- 无法识别时写入 `errors`，交给 Rule Gate 忽略。

## 4. Rule Gate

输入：

- `normalizedEvent`

输出：

- `ruleDecision`

字段：

- `isValidEvent`
- `route`
- `requiresApproval`
- `dedupeHit`
- `shouldCreateTask`
- `reason`

约束：

- 必须是纯代码。
- 判重、审批门禁、状态机相关判断不能交给 LLM。

## 5. Supervisor Router

输入：

- `normalizedEvent`
- `ruleDecision`

输出：

- `supervisorDecision`

字段：

- `handler`
- `queue`
- `reason`
- `escalationTarget`

约束：

- 不创建任务。
- 不创建审批。
- 不写数据库。

## 6. Specialized Agents

### Inventory Agent

处理：

- `low_stock`

输出：

- `handlerResult.handler = "inventory_agent"`
- `taskDraft.type = "restock"`

### Maintenance Agent

处理：

- `maintenance_overdue`

输出：

- `handlerResult.handler = "maintenance_agent"`
- `taskDraft.type = "maintenance"`

### Fault Agent

处理：

- `equipment_fault`

输出：

- `handlerResult.handler = "fault_agent"`
- `taskDraft.type = "anomaly_review"`

## 7. Recommendation Builder

输入：

- `handlerResult`
- `taskDraft`

输出：

- `recommendation`

约束：

- 可在后续版本接 LLM。
- V1 默认纯代码摘要。

## 8. Approval Gate

输入：

- `normalizedEvent`
- `ruleDecision`
- `taskDraft`

输出：

- `approvalDecision`
- `approvalDraft` when needed

约束：

- 必须纯代码。
- 高风险异常设备默认需要审批。

## 9. Create / Update Task

输入：

- `taskDraft`

输出：

- `output.taskId`

约束：

- Graph 骨架阶段只生成草稿。
- 接入正式工具层后，只能调用 `TaskTool`。

## 10. Write Activity Log

输入：

- 所有节点产生的 activity log drafts

输出：

- `output.activityLogCount`

约束：

- Graph 骨架阶段只保留草稿。
- 接入正式工具层后，只能调用 `AuditLogTool`。
