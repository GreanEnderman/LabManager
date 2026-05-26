## 1. Runtime Mode Guardrails

- [x] 1.1 审核 `frontend/src/main.tsx`、live providers、`aiAppFacadeAsync` 与 gateway 入口，列出测试/预发必须保持 HTTP-only 的消费面。
- [x] 1.2 收敛 `frontend/src/runtime/getAiGateway.ts` 与相关运行时守卫，确保 live runtime 只接受 `VITE_AI_GATEWAY_MODE=http`，缺省时仍走 HTTP。
- [x] 1.3 检查 `httpAiGateway` 与认证会话处理，确保 `/api/ai` 不可达或鉴权失败时显式暴露错误，而不是返回本地替代数据。
- [x] 1.4 为联调范围内的 facade/provider 补充验证，证明页面不会在运行时静默切回 mock/direct 路径。

## 2. Environment And Integration Documentation

- [x] 2.1 更新 `frontend/.env.example`、`frontend/.env.staging`、`frontend/.env.production` 的说明，明确测试与预发默认走 `/api/ai`。
- [x] 2.2 补充运行模式切换规则文档，说明 `VITE_AI_GATEWAY_MODE`、`VITE_AI_API_BASE_URL`、`VITE_AI_HTTP_USERNAME`、`VITE_AI_HTTP_PASSWORD` 的适用范围。
- [x] 2.3 标注哪些前端能力属于真实 HTTP 联调范围，哪些仍是本地辅助数据，不计入 S1-05 的后端联调验收。
- [x] 2.4 清理联调相关页面或注释中的误导性 mock 文案，统一”测试/预发只认 HTTP 后端”表述。

## 3. Authz Baseline Alignment

- [x] 3.1 对齐 `S1-04` 的前端鉴权消费约束，确保 `/api/ai/auth/*` 与受保护接口的 401/403/422/429 在 live runtime 中按真实 HTTP 路径处理。
- [x] 3.2 验证 bootstrap 登录变量仅作为 HTTP 鉴权辅助，不会成为 direct/mock 绕过路径。
- [x] 3.3 为联调验收补充检查项，覆盖未登录、鉴权失败、后端不可达和正常 `/api/ai` 响应四类场景。

## 4. Verification

- [x] 4.1 运行前端 lint、类型检查和与 live runtime 相关的测试或构建校验。
- [x] 4.2 运行 OpenSpec 验证，确认 `proposal/design/specs/tasks` 全部通过。
- [x] 4.3 记录剩余验证缺口，例如尚未后端化的数据导入模块或需要人工联调确认的页面。
