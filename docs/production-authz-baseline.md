# Production Authz Baseline

## V1 角色能力矩阵

LabManager V1 使用固定 capability 矩阵，而不是在路由或页面里散落 `admin` 特判。

| 角色 | 核心能力 |
| --- | --- |
| `admin` | 全部能力，包括 `settings:update`、`imports:create`、`report_delivery:manage`、`approvals:write`、`agents:execute` |
| `manager` | AI 流程监督能力，包括 `tasks:write`、`approvals:write`、`reports:generate`、`rules:execute`，但不包含系统治理写能力 |
| `operator` | 执行型能力，包括 `tasks:write`，以及化学品、设备、审批、报告、设置只读 |
| `viewer` | 只读能力，包括化学品、设备、任务、审批、报告、报告投递与设置只读 |

能力矩阵定义位于 `backend/src/domain/authz.ts`，并通过 `AuthenticatedUserDTO.capabilities` 透传给前端。

## 受保护后端路由

当前由 capability 保护的主要后端入口位于 `backend/src/http/router.ts`：

- `settings:read` / `settings:update`：`GET/PATCH /api/ai/settings`
- `chemicals:read`：`GET /api/ai/chemicals`
- `equipment:read`：`GET /api/ai/equipment`
- `imports:read` / `imports:create`：`GET /api/ai/import-batches`、`POST /api/ai/imports/*`
- `tasks:read` / `tasks:write`：`GET /api/ai/tasks*`、`PATCH /api/ai/tasks/:taskId/*`
- `approvals:read` / `approvals:write`：`GET /api/ai/approvals`、`POST /api/ai/approvals`、`PATCH /api/ai/approvals/:approvalId/process`
- `reports:read` / `reports:generate` / `reports:delete`：`GET /api/ai/reports*`、`POST /api/ai/reports/generate`、`DELETE /api/ai/reports/:reportId`
- `report_delivery:read` / `report_delivery:manage`：`/api/ai/report-delivery/*`
- `rules:inspect` / `rules:execute`：`/api/ai/rules/*`
- `agents:execute`：`/api/ai/agents/*`

## Token 生命周期基线

- access token 使用 HMAC SHA-256 签名，必须同时校验签名、`iss`、`aud`、`exp`
- 鉴权不信任 token 内的静态角色结论；返回用户身份时始终回读当前用户记录与当前 capability
- 用户被禁用、`tokenVersion` 变化、`passwordChangedAt` 变化后，旧 token 会在下一次受保护请求上失效
- `staging` / `production` 的 access token TTL 不得超过 `120` 分钟
- malformed token、错误 issuer / audience、过期 token、密码重置后的旧 token 都需要测试覆盖

## 密码与 bootstrap 基线

- 本基线与 `docs/production-remediation-backlog.md` 中的 `P0-04 修复生产配置与默认凭据风险` 保持一致，后续变更不得回退运行时密钥注入或 bootstrap 凭据硬化要求
- 新密码与 bootstrap 密码统一走 `minimum 12 chars + upper/lower/digit/special` 策略
- 默认弱密码列表至少拦截 `labmanager123!`、`password`、`12345678`、`admin123`
- 新密码统一存为 `scrypt$<salt>$<hash>`，旧版 SHA-256 demo hash 仅允许在本地 / 测试登录后迁移
- `staging` / `production` 遇到 legacy SHA-256 hash 时直接拒绝登录，不接受 demo hash 进入生产基线
- bootstrap seed 必须显式开启且显式注入 `BOOTSTRAP_USERS_JSON`，生产环境禁止启用
- fixture bootstrap 用户名 / 密码也会被拦截，避免 `admin`、`demo` 或仓库已知弱口令再次进入环境

## 前端权限消费原则

前端不再把“是否管理员”作为主要写权限来源，而是直接消费 capability：

- 任务操作入口使用 `tasks:write`
- 审批处理入口使用 `approvals:write`
- 数据导入入口使用 `imports:create`
- 报告发送配置使用 `report_delivery:manage`
- 系统设置写入口使用 `settings:update`

实现位置：

- 共享角色上下文：`frontend/src/auth/RoleContext.tsx`
- 主导航：`frontend/src/layouts/MainLayout.tsx`
- 主工作台：`frontend/src/pages/AIWorkbench.tsx`
- 拆分页：`frontend/src/pages/AIApprovals.tsx`、`frontend/src/pages/AITaskCenter.tsx`、`frontend/src/pages/AlertCenter.tsx`、`frontend/src/pages/DataImportCenter.tsx`、`frontend/src/pages/ReportDeliverySettings.tsx`、`frontend/src/pages/SystemSettings*.tsx`

## 失败响应契约

- 缺失、失效、过期或撤销 token 统一返回 `401 unauthorized`
- 已认证但 capability 不足统一返回 `403 forbidden`
- 密码策略违规统一返回 `422 password_policy_violation`
- 登录节流统一返回 `429 too_many_attempts`
- 前端 HTTP gateway 在收到 `401` 后会清除本地 token、广播会话失效事件，并停止 bootstrap 自动重试，避免无穷重登循环
- `403` 与 `429` 保持稳定错误码透传，不会误清理已认证状态

## 认证审计证据

- 登录成功记录 `login_succeeded/authenticated`
- 登录失败统一记录 `login_failed/invalid_credentials`
- 节流统一记录 `login_throttled/too_many_attempts`
- token 失效统一记录 `token_invalidated/*`，细分为 `malformed_token`、`invalid_signature`、`invalid_token_scope`、`expired_token`、`user_state_changed`、`credential_version_changed`
- capability 越权统一记录 `forbidden_action/<capability>`
- 审计事件只保留事件类别、原因码、用户上下文与安全 metadata，不记录原始密码或完整 token

## 验证

后端新增了路由授权测试 `backend/src/http/router.test.ts`，覆盖以下边界：

- `admin` 可更新系统设置，`manager` 不可
- `manager` 可处理审批，`operator` 不可
- `operator` 可推进任务状态，`viewer` 不可
- `viewer` 保留只读访问，未认证访问返回 `401 unauthorized`

`backend/src/services/auth-service.test.ts` 与 `backend/src/services/app-config.test.ts` 继续覆盖：

- 过期 token、错误 issuer / audience、malformed token、密码重置后的旧 token
- 用户禁用、token version 变化、角色降级后的当前能力回读
- 强密码接受、弱口令/默认口令拒绝、scrypt hash 校验链
- 生产环境 legacy SHA-256 拒绝登录
- staging / production token TTL 上限
- bootstrap fixture 用户名 / 密码拦截
- 审计事件不包含原始密码或完整 token

`backend/src/http/router.test.ts` 与 `frontend/src/runtime/httpErrorPresentation.test.ts` 继续覆盖：

- `401 unauthorized`、`403 forbidden`、`429 too_many_attempts` 的稳定错误码
- 前端只在非登录请求的 `401` 上清理会话
- 前端对 `401/403/422/429` 的稳定提示文案与 banner 映射

当前验证缺口：

- `node --test` 在当前执行环境下仍会返回 `spawn EPERM`，因此新增测试文件已通过 TypeScript 诊断和 OpenSpec 校验，但未能在本会话里完成真实测试进程执行
- `frontend npm run build` 的 TypeScript 阶段已经通过，但 Vite/esbuild 在当前执行环境启动子进程时仍返回 `spawn EPERM`，因此产物构建没有在本会话里跑完
- `backend` 缺少可直接执行的本地 `tsc` 命令入口，项目级类型验证目前依赖 OMX 的 `tsc --noEmit` 诊断而不是 `npm run typecheck`
