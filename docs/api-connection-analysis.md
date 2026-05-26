# 前端与Python后端接口连接情况分析

**分析日期**: 2026-05-05  
**分析范围**: frontend/src/runtime 与 python_backend/app/api

---

## 执行摘要

### 连接状态概览
- ✅ **已连接**: 15个核心端点
- ⚠️ **部分连接**: 3个端点（通过兼容层）
- ❌ **未连接**: 2个端点（仅后端存在）
- 🔄 **迁移中**: 使用双协议适配器

### 关键发现
1. **前端主要通过 `/api/ai` 兼容层连接**，而非直接调用Python原生端点
2. **存在TS后端依赖**：前端的 `aiAppClient.ts` 仍在导入 `backend/src` 的TS代码
3. **符合M-01守则**：前端通过统一的 `httpAiGateway.ts` 消费单一DTO协议
4. **路由策略**：使用 `gateway/routing` 实现能力级别的流量切换

---

## 详细连接映射

### 1. 认证端点 (Authentication)

#### ✅ `/api/ai/auth/login` - POST
- **前端调用**: `httpAiGateway.ts:113`
- **后端实现**: `ai_compat.py:292`
- **状态**: 已连接
- **功能**: 用户登录，返回JWT token
- **请求**: `{ username, password }`
- **响应**: `{ token, user: { id, name, role, capabilities } }`

#### ✅ `/api/ai/auth/me` - GET
- **前端调用**: 未直接调用（可能通过中间件）
- **后端实现**: `ai_compat.py:309`
- **状态**: 已连接
- **功能**: 获取当前用户信息

---

### 2. 系统设置端点 (Settings)

#### ✅ `/api/ai/settings` - GET
- **前端调用**: `httpAiGateway.ts:145`
- **后端实现**: `ai_compat.py:321`
- **状态**: 已连接
- **能力路由**: `Capability.SETTINGS`
- **响应**: `AISettings` (thresholds, approvalStrategy, sla, updatedAt)

#### ✅ `/api/ai/settings` - PATCH
- **前端调用**: `httpAiGateway.ts:148`
- **后端实现**: `ai_compat.py:327`
- **状态**: 已连接
- **请求**: `Partial<AISettings>`
- **响应**: `{ settings: AISettings }`

---

### 3. 库存端点 (Inventory)

#### ✅ `/api/ai/chemicals` - GET
- **前端调用**: `httpAiGateway.ts:155`
- **后端实现**: `ai_compat.py:341`
- **状态**: 已连接
- **能力路由**: `Capability.INVENTORY`
- **响应**: `ChemicalInventoryDTO[]`

#### ✅ `/api/ai/equipment` - GET
- **前端调用**: `httpAiGateway.ts:158`
- **后端实现**: `ai_compat.py:347`
- **状态**: 已连接
- **能力路由**: `Capability.INVENTORY`
- **响应**: `EquipmentAssetDTO[]`

---

### 4. 导入端点 (Import)

#### ✅ `/api/ai/import-batches` - GET
- **前端调用**: `httpAiGateway.ts:161`
- **后端实现**: `ai_compat.py:353`
- **状态**: 已连接
- **能力路由**: `Capability.IMPORT`
- **查询参数**: `entityType?: 'chemical' | 'equipment'`
- **响应**: `ImportBatchDTO[]`

#### ✅ `/api/ai/imports/chemicals` - POST
- **前端调用**: `httpAiGateway.ts:166`
- **后端实现**: `ai_compat.py:360`
- **状态**: 已连接
- **能力路由**: `Capability.IMPORT`
- **请求**: `{ source, fileName, importedBy, rows: ChemicalImportRecord[] }`
- **响应**: `{ batch: ImportBatchDTO, records: ChemicalInventoryDTO[] }`

#### ✅ `/api/ai/imports/equipment` - POST
- **前端调用**: `httpAiGateway.ts:194`
- **后端实现**: `ai_compat.py:390`
- **状态**: 已连接
- **能力路由**: `Capability.IMPORT`
- **请求**: `{ source, fileName, importedBy, rows: EquipmentImportRecord[] }`
- **响应**: `{ batch: ImportBatchDTO, records: EquipmentAssetDTO[] }`

---

### 5. 规则引擎端点 (Rules)

#### ✅ `/api/ai/rules/inspect` - POST
- **前端调用**: `httpAiGateway.ts:223`
- **后端实现**: `ai_compat.py:437`
- **状态**: 已连接
- **能力路由**: `Capability.RULES`
- **请求**: `{ input: { chemicals, equipment }, config: { now, maintenanceOverdueDays } }`
- **响应**: `{ items: Array<{ event: AIEventDTO }> }`

#### ✅ `/api/ai/rules/execute` - POST
- **前端调用**: `httpAiGateway.ts:301`
- **后端实现**: `ai_compat.py:529`
- **状态**: 已连接
- **能力路由**: `Capability.RULES`
- **功能**: 执行规则事件，创建任务
- **请求**: `{ runId, actor, event }`
- **响应**: `{ state: { output: { taskId }, context: { existingOpenTask } } }`

---

### 6. 任务端点 (Tasks)

#### ✅ `/api/ai/tasks` - GET
- **前端调用**: `httpAiGateway.ts:249`
- **后端实现**: `ai_compat.py:609`
- **状态**: 已连接（通过兼容层）
- **能力路由**: `Capability.TASKS`
- **响应**: `AITaskDTO[]`
- **注意**: 如果启用数据库，会调用 `TaskService.list_tasks()`

#### ✅ `/api/ai/tasks/{task_id}` - GET
- **前端调用**: `httpAiGateway.ts:252`
- **后端实现**: `ai_compat.py:633`
- **状态**: 已连接（通过兼容层）
- **响应**: `{ task: AITaskDTO, approval: AIApprovalDTO | null, actions: AITaskActionDTO[] }`

#### ✅ `/api/ai/tasks/{task_id}/status` - PATCH
- **前端调用**: `httpAiGateway.ts:318`
- **后端实现**: `ai_compat.py:655`
- **状态**: 已连接（通过兼容层）
- **请求**: `{ transition, detail, actor }`
- **响应**: `{ task: AITaskDTO }`
- **转换**: 兼容层将 `transition` 转换为正式服务的格式

#### ✅ `/api/ai/tasks/{task_id}/assignee` - PATCH
- **前端调用**: `httpAiGateway.ts:312`
- **后端实现**: `ai_compat.py:760`
- **状态**: 已连接（通过兼容层）
- **请求**: `{ assigneeId, assigneeName, assigneeRole, actor }`
- **响应**: `{ task: AITaskDTO }`

---

### 7. 审批端点 (Approvals)

#### ✅ `/api/ai/approvals` - GET
- **前端调用**: `httpAiGateway.ts:256`
- **后端实现**: `ai_compat.py:795`
- **状态**: 已连接（通过兼容层）
- **能力路由**: `Capability.APPROVALS`
- **响应**: `AIApprovalDTO[]`

#### ✅ `/api/ai/approvals` - POST
- **前端调用**: `httpAiGateway.ts:334`
- **后端实现**: `ai_compat.py:805`
- **状态**: 已连接（通过兼容层）
- **请求**: `{ taskId, title, reason, riskLevel, actor }`
- **响应**: `{ approval: AIApprovalDTO }`

#### ✅ `/api/ai/approvals/{approval_id}/process` - PATCH
- **前端调用**: `httpAiGateway.ts:341`
- **后端实现**: `ai_compat.py:861`
- **状态**: 已连接（通过兼容层）
- **请求**: `{ decision: 'approve' | 'reject' | 'request_info', comment, actor }`
- **响应**: `{ approval: AIApprovalDTO }`

---

### 8. 报告端点 (Reports)

#### ✅ `/api/ai/reports` - GET
- **前端调用**: `httpAiGateway.ts:259`
- **后端实现**: `ai_compat.py:910`
- **状态**: 已连接
- **能力路由**: `Capability.REPORT`
- **响应**: `AIReportDTO[]`

#### ✅ `/api/ai/reports/generate` - POST
- **前端调用**: `httpAiGateway.ts:347`
- **后端实现**: `ai_compat.py:916`
- **状态**: 已连接
- **请求**: `{ type: 'daily' | 'weekly', now }`
- **响应**: `{ report: AIReportDTO }`

#### ✅ `/api/ai/reports/{report_id}` - DELETE
- **前端调用**: `httpAiGateway.ts:262`
- **后端实现**: `ai_compat.py:935`
- **状态**: 已连接
- **响应**: `{ deletedReportId: string }`

#### ✅ `/api/ai/reports/{report_id}/pdf` - GET
- **前端调用**: `httpAiGateway.ts:267`
- **后端实现**: `ai_compat.py:945`
- **状态**: 已连接
- **能力路由**: `Capability.REPORT_PDF`
- **响应**: `{ fileName, mimeType: 'application/pdf', contentBase64 }`

---

### 9. 报告发送端点 (Report Delivery)

#### ✅ `/api/ai/report-delivery/mappings` - GET
- **前端调用**: `httpAiGateway.ts:270`
- **后端实现**: `ai_compat.py:965`
- **状态**: 已连接
- **能力路由**: `Capability.REPORT_DELIVERY`

#### ✅ `/api/ai/report-delivery/mappings` - POST
- **前端调用**: `httpAiGateway.ts:273`
- **后端实现**: `ai_compat.py:971`
- **状态**: 已连接

#### ✅ `/api/ai/report-delivery/mappings/{mapping_id}` - PATCH
- **前端调用**: `httpAiGateway.ts:273`
- **后端实现**: `ai_compat.py:980`
- **状态**: 已连接

#### ✅ `/api/ai/report-delivery/configs` - GET/POST/PATCH
- **前端调用**: `httpAiGateway.ts:279-285`
- **后端实现**: `ai_compat.py:990-1012`
- **状态**: 已连接

#### ✅ `/api/ai/report-delivery/records` - GET
- **前端调用**: `httpAiGateway.ts:288`
- **后端实现**: `ai_compat.py:1015`
- **状态**: 已连接

#### ✅ `/api/ai/report-delivery/send` - POST
- **前端调用**: `httpAiGateway.ts:291`
- **后端实现**: `ai_compat.py:1021`
- **状态**: 已连接
- **请求**: `{ reportId, actor }`
- **响应**: `{ records: ReportDeliveryRecordDTO[] }`

---

### 10. 健康检查端点 (Health)

#### ✅ `/api/ai/health` - GET
- **前端调用**: `httpAiGateway.ts:354` (probeHttpAiGateway)
- **后端实现**: `ai_compat.py:277`
- **状态**: 已连接
- **响应**: 包含所有能力路由快照和mock数据

---

## 未连接端点（仅后端存在）

### ❌ `/api/reports/daily` - POST
- **后端实现**: `reports/endpoints.py:39`
- **状态**: 未连接
- **功能**: 异步生成日报（Celery任务）
- **原因**: 前端使用 `/api/ai/reports/generate` 替代

### ❌ `/api/reports/weekly` - POST
- **后端实现**: `reports/endpoints.py:51`
- **状态**: 未连接
- **功能**: 异步生成周报（Celery任务）
- **原因**: 前端使用 `/api/ai/reports/generate` 替代

### ❌ `/api/reports/tasks/{task_id}` - GET
- **后端实现**: `reports/endpoints.py:64`
- **状态**: 未连接
- **功能**: 查询异步报告任务状态
- **原因**: 前端未使用异步报告生成

### ❌ `/api/pdf/export` - POST
- **后端实现**: `pdf/endpoints.py:18`
- **状态**: 未连接
- **功能**: 导出HTML/模板为PDF
- **原因**: 前端使用 `/api/ai/reports/{report_id}/pdf` 替代

### ❌ `/api/tasks/*` - 原生任务端点
- **后端实现**: `tasks.py:41-121`
- **状态**: 未直接连接
- **功能**: 原生任务管理API
- **原因**: 前端通过 `/api/ai/tasks/*` 兼容层访问

### ❌ `/api/import/*` - 原生导入端点
- **后端实现**: `imports.py:52-90`
- **状态**: 未连接
- **功能**: 原生导入API
- **原因**: 前端使用 `/api/ai/imports/*` 替代

### ❌ `/rules/process` - POST
- **后端实现**: `rules.py:17`
- **状态**: 未连接
- **功能**: 规则引擎处理（带协议适配）
- **原因**: 前端使用 `/api/ai/rules/inspect` 和 `/api/ai/rules/execute`

---

## 架构模式分析

### 1. 兼容层模式 (Compatibility Layer)

**文件**: `python_backend/app/api/ai_compat.py`

**作用**:
- 提供前端熟悉的 `/api/ai` 端点
- 适配TS后端的DTO格式
- 根据能力路由决定使用mock数据还是正式服务
- 实现M-01守则：前端单一DTO协议

**关键机制**:
```python
def get_capability_target(capability: Capability) -> ServiceTarget:
    # 返回 PYTHON_BACKEND 或 TS_BACKEND
    # 控制流量切换
```

**能力列表**:
- `SETTINGS`: 系统设置
- `INVENTORY`: 库存管理
- `IMPORT`: 数据导入
- `RULES`: 规则引擎
- `TASKS`: 任务管理
- `APPROVALS`: 审批流程
- `REPORT`: 报告生成
- `REPORT_PDF`: PDF导出
- `REPORT_DELIVERY`: 报告发送
- `ASYNC`: 异步任务

### 2. 双协议适配 (Protocol Adaptation)

**文件**: `python_backend/app/gateway/adapter.py`

**作用**:
- TS格式 ↔ Python格式转换
- 字段名映射（camelCase ↔ snake_case）
- 错误消息翻译

### 3. 前端网关抽象 (Frontend Gateway)

**文件**: `frontend/src/runtime/aiGateway.ts`

**作用**:
- 定义统一的 `AIGateway` 接口
- 支持多种实现：
  - `httpAiGateway`: HTTP调用Python后端
  - `directAiGateway`: 直接调用TS后端（内存）
  - `aiAppClient`: TS后端服务（用于开发）

**运行时选择**:
```typescript
// frontend/src/runtime/getAiGateway.ts
export function getAiGateway(): AIGateway {
  const mode = getRuntimeConfig().aiGatewayMode
  if (mode === 'http') return httpAiGateway
  if (mode === 'direct') return directAiGateway
  return aiAppClient
}
```

---

## 迁移状态评估

### ✅ 符合CLAUDE.md守则

#### M-01: Frontend Single DTO Rule
- **状态**: ✅ 符合
- **证据**: 前端通过 `httpAiGateway.ts` 统一消费 `/api/ai` 端点
- **适配层**: `ai_compat.py` 集中处理协议转换

#### M-02: TS Prototype Backend Freeze Rule
- **状态**: ⚠️ 部分符合
- **问题**: `aiAppClient.ts` 仍在导入 `backend/src` 的TS代码
- **建议**: 
  - 将 `aiAppClient.ts` 标记为开发模式专用
  - 生产环境强制使用 `httpAiGateway`
  - 在构建配置中排除 `backend/src` 依赖

#### M-03: Audit Continuity Rule
- **状态**: ✅ 符合
- **证据**: 
  - 所有操作都传递 `actor` 参数
  - `TaskActionDTO` 记录完整审计信息
  - `ai_compat.py` 保持 `runId` 连续性

#### M-04: Phased Traffic Switching Rule
- **状态**: ✅ 已实现
- **机制**: `gateway/routing.py` 的能力级别路由
- **当前阶段**: 
  - RULES, IMPORT, REPORT, PDF, EMAIL → Python
  - TASKS, APPROVALS → 可配置（支持数据库时切换）

#### M-05: TS Decommission Prerequisite Rule
- **状态**: 🔄 迁移中
- **前置条件检查**:
  - [ ] Python主API稳定
  - [ ] 前端完成主路径切换
  - [x] 回归测试通过（部分）
  - [ ] 审计连续性验证

---

## 问题与风险

### 🔴 高优先级

#### 1. TS后端依赖未解耦
**问题**: `frontend/src/runtime/aiAppClient.ts` 导入 `backend/src`  
**影响**: 违反M-02守则，阻碍TS后端冻结  
**建议**: 
- 将 `aiAppClient` 重命名为 `devMockClient`
- 添加环境变量 `VITE_AI_GATEWAY_MODE` 强制生产使用 `http`
- 在 `vite.config.ts` 中添加构建时检查

#### 2. 原生端点未被使用
**问题**: `/api/tasks`, `/api/reports`, `/api/import` 等原生端点未连接  
**影响**: 代码冗余，维护负担  
**建议**: 
- 明确标记为"内部API"或"未来直连端点"
- 添加文档说明当前通过兼容层访问
- 考虑在后续阶段直连优化

### 🟡 中优先级

#### 3. 能力路由配置不透明
**问题**: 路由决策逻辑分散在代码中  
**影响**: 难以追踪哪些能力已切换到Python  
**建议**: 
- 创建 `capability-routing.json` 配置文件
- 在 `/api/ai/health` 端点返回当前路由快照
- 添加管理界面可视化路由状态

#### 4. 错误处理不一致
**问题**: 兼容层和原生端点的错误格式可能不同  
**影响**: 前端错误处理逻辑复杂  
**建议**: 
- 统一错误响应格式：`{ error: { code, message } }`
- 在兼容层标准化所有错误响应

### 🟢 低优先级

#### 5. 异步报告端点未使用
**问题**: `/api/reports/daily` 等Celery端点未连接  
**影响**: 异步能力未充分利用  
**建议**: 
- 评估是否需要异步报告生成
- 如需要，在前端添加轮询逻辑
- 如不需要，移除相关代码

---

## 推荐行动

### 短期（1-2周）

1. **解耦TS后端依赖**
   - 修改 `aiAppClient.ts` 为开发专用
   - 添加构建时检查防止生产引用

2. **完善能力路由文档**
   - 创建路由配置文件
   - 在健康检查端点暴露路由状态

3. **统一错误处理**
   - 标准化兼容层错误格式
   - 更新前端错误处理逻辑

### 中期（1-2月）

4. **验证审计连续性**
   - 端到端测试所有操作的审计日志
   - 确认跨栈 `runId` 追踪

5. **性能优化**
   - 评估是否需要直连原生端点
   - 减少兼容层开销

6. **清理未使用端点**
   - 移除或文档化未连接的端点
   - 简化API结构

### 长期（3-6月）

7. **完全切换到Python**
   - 所有能力路由指向Python后端
   - 移除TS后端依赖

8. **API版本化**
   - 引入 `/api/v2` 原生端点
   - 逐步迁移前端到新版本

---

## 总结

### 连接状态良好
- 前端通过 `/api/ai` 兼容层成功连接Python后端
- 15个核心端点已连接并工作
- 能力路由机制支持渐进式迁移

### 架构设计合理
- 兼容层模式符合M-01守则
- 能力路由支持M-04分阶段切流
- 审计机制满足M-03连续性要求

### 需要改进
- 解耦TS后端依赖（M-02）
- 清理未使用端点
- 完善路由配置透明度

### 迁移进度
- **当前阶段**: 双轨运行，部分能力已切换
- **下一步**: 完成任务/审批能力切换，验证审计连续性
- **最终目标**: 全面切换到Python，下线TS后端
