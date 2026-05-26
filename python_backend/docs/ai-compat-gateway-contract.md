# Python /api/ai Compatibility Gateway Contract

本文档冻结前端现有 `/api/ai` HTTP 契约。Python 兼容层必须保持这些路径、响应 envelope 和字段语义稳定，后续只能替换内部实现，不能要求前端改调用面。

## 1. 通用规则

- 入口前缀固定为 `/api/ai`。
- 成功响应固定为：

```json
{
  "data": {},
  "error": null
}
```

- 失败响应应保持同一 envelope 语义：

```json
{
  "data": null,
  "error": {
    "code": "error_code",
    "message": "Human readable message"
  }
}
```

- 对前端暴露的字段使用 camelCase。
- Python 内部可以使用 snake_case，但必须在 gateway 层转换。
- 兼容层是唯一前端入口。能力迁移通过 capability flags 控制内部 active runtime，不改变 URL。

## 2. Capability Flags

默认所有能力走 `compat_fallback`。打开对应环境变量后，gateway 可以把该能力切到正式 Python 服务。

支持两种环境变量命名：

- `PY_BACKEND_<CAPABILITY>_ENABLED`
- `LABMANAGER_PY_PY_BACKEND_<CAPABILITY>_ENABLED`

当前能力名：

- `SETTINGS`
- `INVENTORY`
- `IMPORT`
- `RULES`
- `TASKS`
- `APPROVALS`
- `REPORT`
- `REPORT_PDF`
- `REPORT_DELIVERY`
- `ASYNC`

`GET /api/ai/health` 必须返回 `data.capabilities`，用于观察每个能力当前 target：

```json
{
  "settings": "compat_fallback",
  "rules": "python"
}
```

## 3. Required Endpoints

### Health and Auth

| Method | Path | Data |
| --- | --- | --- |
| `GET` | `/api/ai/health` | `{ tasks, approvals, reports, chemicals, equipment, importBatches, capabilities }` |
| `POST` | `/api/ai/auth/login` | `{ token, user }` |
| `GET` | `/api/ai/auth/me` | current user |

### Settings and Inventory

| Method | Path | Data |
| --- | --- | --- |
| `GET` | `/api/ai/settings` | `AISettings` |
| `PATCH` | `/api/ai/settings` | `{ settings }` |
| `GET` | `/api/ai/chemicals` | `ChemicalInventoryDTO[]` |
| `GET` | `/api/ai/equipment` | `EquipmentAssetDTO[]` |

### Imports

| Method | Path | Data |
| --- | --- | --- |
| `GET` | `/api/ai/import-batches` | `ImportBatchDTO[]` |
| `POST` | `/api/ai/imports/chemicals` | `{ batch, records }` |
| `POST` | `/api/ai/imports/equipment` | `{ batch, records }` |

### Rules

| Method | Path | Data |
| --- | --- | --- |
| `POST` | `/api/ai/rules/inspect` | `{ items: [{ event, decision }] }` |
| `POST` | `/api/ai/rules/execute` | `{ state }` |

`rules/execute` 必须返回以下二选一：

```json
{
  "state": {
    "output": { "taskId": "task-id" },
    "context": { "existingOpenTask": null }
  }
}
```

```json
{
  "state": {
    "output": {},
    "context": { "existingOpenTask": { "id": "task-id" } }
  }
}
```

### Tasks and Approvals

| Method | Path | Data |
| --- | --- | --- |
| `GET` | `/api/ai/tasks` | `AITaskDTO[]` |
| `GET` | `/api/ai/tasks/{taskId}` | `{ task, approval, actions }` |
| `PATCH` | `/api/ai/tasks/{taskId}/status` | `{ task }` |
| `PATCH` | `/api/ai/tasks/{taskId}/assignee` | `{ task }` |
| `GET` | `/api/ai/approvals` | `AIApprovalDTO[]` |
| `POST` | `/api/ai/approvals` | `{ approval }` |
| `PATCH` | `/api/ai/approvals/{approvalId}/process` | `{ approval }` |

前端任务状态语义必须保持：

- `open`
- `in_progress`
- `pending_approval`
- `done`
- `closed`

如正式 Python task service 使用其他内部状态，必须在 gateway 层转换。

### Reports and Delivery

| Method | Path | Data |
| --- | --- | --- |
| `GET` | `/api/ai/reports` | `AIReportDTO[]` |
| `POST` | `/api/ai/reports/generate` | `{ report }` |
| `DELETE` | `/api/ai/reports/{reportId}` | `{ deletedReportId }` |
| `GET` | `/api/ai/reports/{reportId}/pdf` | `{ fileName, mimeType, contentBase64 }` |
| `GET` | `/api/ai/report-delivery/mappings` | `SupervisorEmailMappingDTO[]` |
| `POST` | `/api/ai/report-delivery/mappings` | `SupervisorEmailMappingDTO` |
| `PATCH` | `/api/ai/report-delivery/mappings/{mappingId}` | `SupervisorEmailMappingDTO` |
| `GET` | `/api/ai/report-delivery/configs` | `ReportDeliveryConfigDTO[]` |
| `POST` | `/api/ai/report-delivery/configs` | `ReportDeliveryConfigDTO` |
| `PATCH` | `/api/ai/report-delivery/configs/{configId}` | `ReportDeliveryConfigDTO` |
| `GET` | `/api/ai/report-delivery/records` | `ReportDeliveryRecordDTO[]` |
| `POST` | `/api/ai/report-delivery/send` | `{ records }` |

PDF response 的 `mimeType` 固定为 `application/pdf`，`contentBase64` 必须是 base64 编码后的 PDF bytes。

### Agent Execute

| Method | Path | Data |
| --- | --- | --- |
| `POST` | `/api/ai/agents/task-tracking/execute` | `{ state }` |
| `POST` | `/api/ai/agents/reporting/execute` | `{ state }` |

## 4. Migration Acceptance

每迁移一个能力到正式 Python 服务，必须满足：

- URL 不变。
- 成功和失败 envelope 不变。
- 前端 DTO 字段名不变。
- 主链路副作用不丢失：task action、approval、report、delivery record、activity/audit log。
- 该能力专项 contract test 通过。
- 关闭该能力 flag 后，可以回到 `compat_fallback`。
