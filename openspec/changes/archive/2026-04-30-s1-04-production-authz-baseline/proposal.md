## Why

当前后端已具备登录、JWT 校验和粗粒度 admin 判断，但仍停留在演示级认证模型：角色权限边界、token 生命周期、密码策略、默认账户禁用和失败响应规范尚未形成可验收的生产基线。S1-04 依赖 P0-04 已完成的默认凭据与 secret 注入边界，在此基础上把认证鉴权提升为可审计、可测试、可部署的最小安全合同。

## What Changes

- 定义 LabManager V1 的角色矩阵，明确 `admin`、`manager`、`operator`、`viewer` 对 AI 任务、审批、报告、配置、数据导入和系统治理能力的访问边界。
- 定义 token 生命周期与认证失效策略，包括访问 token 有效期、过期处理、签名/issuer/audience 校验、用户禁用后的失效要求，以及未来 refresh/session 机制的边界。
- 定义密码策略和默认账户禁用策略，覆盖密码复杂度、存储算法、临时/初始化密码、默认账户禁用、登录失败限制和审计留痕。
- 规范认证失败与鉴权失败 API 响应，区分 401/403/422/429 等错误，统一错误码、响应体、前端处理和不泄露敏感原因的约束。
- 不引入第三方身份提供商、SSO、多租户或复杂权限 DSL；本变更聚焦生产可控的 V1 内建认证鉴权基线。

## Capabilities

### New Capabilities
- `production-authz-baseline`: 定义 V1 内建认证、角色矩阵、token 生命周期、密码策略、默认账户禁用和鉴权失败响应的生产基线。

### Modified Capabilities

## Impact

- Affected code: `backend/src/domain/types.ts`, `backend/src/domain/models.ts`, `backend/src/contracts/shared.ts`, `backend/src/services/auth-service.ts`, `backend/src/services/app-config.ts`, `backend/src/http/router.ts`, 前端认证状态与权限显隐逻辑。
- Affected APIs: `/api/ai/auth/login`, `/api/ai/auth/me`, 需要认证的 AI 任务、审批、报告、配置和导入相关 API。
- Affected docs/specs: 认证鉴权生产基线、部署/运维安全说明、角色矩阵说明。
- Dependencies: 依赖 `P0-04` 已建立的 runtime secret 与 bootstrap credential hardening；本变更不得回退或削弱 P0-04 的生产启动校验。
