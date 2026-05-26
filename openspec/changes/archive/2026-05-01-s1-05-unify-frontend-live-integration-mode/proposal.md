## Why

当前前端已经同时保留了历史 mock/direct 痕迹与新的 live HTTP 接入路径，测试和预发环境如果没有被明确约束，就可能在联调时混入本地直连或前端 mock 行为，导致“后端通过了、页面其实没真正走 HTTP”的假阳性验证。S1-05 需要把联调模式收敛成可说明、可配置、不可静默回退的统一契约，确保测试与预发只验证 `/api/ai` 后端。

## What Changes

- 统一前端真实联调模式的环境约束，规定测试与预发默认通过 `/api/ai` 访问后端 AI API。
- 明确 `VITE_AI_GATEWAY_MODE`、`VITE_AI_API_BASE_URL` 与可选 HTTP bootstrap 登录变量的切换规则和适用环境。
- 约束 live 前端入口、gateway 选择器和运行时 provider，不允许在联调环境静默退回 direct/mock 路径。
- 为联调失败场景定义可见的错误暴露与说明要求，避免页面“看起来还能用”但实际绕过 HTTP 后端。
- 补充联调模式文档与验收验证项，覆盖页面入口、AI 工作台、导入与设置等 live provider 消费面。

## Capabilities

### New Capabilities
- `frontend-live-integration-mode`: 定义前端在测试、预发和生产类环境中的真实联调模式约束、环境变量规则，以及禁止 mock/direct 静默回退的运行时行为。

### Modified Capabilities
- `production-authz-baseline`: 补充前端真实联调对 `/api/ai/auth/*` 与受保护接口的消费约束，要求测试与预发环境通过 HTTP 鉴权链路暴露认证/鉴权失败，而不是回落到本地演示路径。

## Impact

- Affected code: `frontend/src/main.tsx`, `frontend/src/runtime/getAiGateway.ts`, `frontend/src/runtime/httpAiGateway.ts`, `frontend/src/runtime/aiAppFacadeAsync.ts`, `frontend/src/ai/AIStateLive.tsx`, `frontend/src/ai/AISettingsRuntimeLive.tsx`, `frontend/src/imports/ImportContextLive.tsx`, 以及相关环境配置文件与联调文档。
- Affected APIs: `/api/ai`, `/api/ai/auth/login`, `/api/ai/auth/me`, 以及 AI 任务、审批、报告、设置、导入相关 HTTP 接口。
- Affected docs/specs: 前端联调模式说明、环境变量说明、`production-authz-baseline`、新增 `frontend-live-integration-mode`。
- Dependencies: 依赖 `P0-01` 已完成的前后端联通基础与 `S1-04` 的生产鉴权基线；本变更不得削弱 `S1-04` 规定的认证失败暴露与权限门禁行为。
