## Context

LabManager 前端正在从早期演示闭环迁移到真实后端联调。当前代码已经存在清晰的 live 入口：`frontend/src/main.tsx` 只挂载 `AIStateLive`、`AISettingsRuntimeLive` 和 `ImportContextLive`，`frontend/src/runtime/getAiGateway.ts` 也只返回 `httpAiGateway`，并在 `VITE_AI_GATEWAY_MODE` 不是 `http` 时直接抛错。但仓库里仍保留历史 mock/direct provider、部分页面文案仍提到 mock 演示路径，且导入上下文对 movement/maintenance 这类前端本地数据仍有 localStorage 分支，这会让“联调环境是否真的只验证后端 HTTP”变得不够显式。

S1-05 的核心不是重新设计网关架构，而是把现有 live-only 方向冻结成统一契约：测试与预发默认只验证 `/api/ai`，前端不得在运行时悄悄回落到 mock/direct，鉴权失败或后端不可达必须在页面与文档中可见。这个改动横跨环境变量、gateway 选择、provider 入口、错误处理和联调说明，因此适合先用 design 固定技术决策。

## Goals / Non-Goals

**Goals:**

- 固定测试、预发和生产类环境的前端真实联调模式，默认通过 `/api/ai` 访问 AI 后端。
- 明确环境变量切换规则，让 `VITE_AI_GATEWAY_MODE=http` 成为 live runtime 的唯一允许值，并说明 `VITE_AI_API_BASE_URL` 的默认与覆盖方式。
- 保证 live provider、gateway facade 和页面消费面在联调失败时显式报错，而不是改走 mock/direct 路径继续渲染成功态。
- 让联调说明覆盖 AI 工作台、设置、导入等主要 live 入口，并与 `S1-04` 的 HTTP 鉴权链路保持一致。

**Non-Goals:**

- 不移除历史 mock/direct 代码资产；它们仍可作为本地演示或历史参考实现存在，但不再属于测试/预发联调路径。
- 不把 movement/maintenance 这类暂未后端化的数据一次性迁移成真实后端接口；本变更只定义联调模式边界和禁止静默回退的原则。
- 不新增新的 gateway 类型、运行模式枚举或第三方环境配置依赖。
- 不重构整个前端状态管理，只在现有 live gateway/facade/provider 结构上补强约束与说明。

## Decisions

1. 把 live HTTP 模式定义为测试/预发/生产的唯一联调模式。

   `getAiGateway()` 继续只允许 `http`，并把“未配置时默认视为 http live runtime”与“显式设置非 http 必须失败”都写入规范。这样测试与预发不会因为遗漏变量而落入另一个执行路径。

   Rejected alternative: 保留 `direct` 作为测试/预发备用模式。这样虽然方便排查，但会破坏验收语义，因为页面可能在 HTTP 不通时仍走本地直连逻辑通过检查。

2. 用“失败即显性暴露”替代“失败后自动降级”。

   live provider 和 facade 层保持当前直接抛出 HTTP/鉴权错误的策略，页面必须通过现有错误展示与登录失效提示暴露问题，而不是在 catch 后切换到 mock 数据。联调环境的目标是验证后端，而不是维持演示连续性。

   Rejected alternative: 当 `/api/ai` 失败时自动回退到 mock state。这样会制造假阳性，无法证明后端接口、鉴权和数据契约真实可用。

3. 把运行模式说明集中到环境配置与联调文档，而不是分散在页面注释里。

   注释仍可保留，但应补一份对测试/预发可执行的说明，覆盖 `.env.example`、`.env.staging`、`.env.production` 的意图、`VITE_AI_API_BASE_URL` 的默认行为、何时需要 `VITE_AI_HTTP_USERNAME/VITE_AI_HTTP_PASSWORD`，以及联调时哪些 provider/入口必须保持 live-only。

   Rejected alternative: 仅靠代码中的注释和报错信息传达规则。那样对测试与预发使用者不够直观，也不利于验收时逐项核对。

4. 把 `S1-04` 的鉴权基线当作联调契约的一部分，而不是独立话题。

   测试与预发前端访问 `/api/ai/auth/*` 与受保护接口时，必须暴露真实的 401/403/429 行为；`httpAiGateway` 的 bootstrap 登录逻辑只能作为 HTTP 链路的一部分存在，不能成为绕开鉴权验收的后门。

   Rejected alternative: 把联调模式仅定义为“是否访问 HTTP”，不关心鉴权错误怎么暴露。这样会遗漏一个关键验收点：页面可能确实发了 HTTP 请求，但仍用非真实的错误处理掩盖鉴权问题。

5. 明确“联调范围”与“前端本地暂存范围”的边界。

   化学品、设备、AI 任务/审批/报告/设置等已接入 `aiAppClient` 的能力必须只走 HTTP；movement、maintenance 等仍是前端本地暂存的模块，需要在说明里标记为非本次联调验收对象，避免把“局部本地暂存”误判为“页面偷偷回退到 mock”。

   Rejected alternative: 要求所有导入相关页面在本次都完全后端化。那会把任务范围从“统一联调模式”扩展成“补齐全部真实接口”，超出 S1-05 的目标。

## Risks / Trade-offs

- [Risk] 测试环境中一旦 HTTP 后端不可用，页面会比以前更早失败 -> Mitigation: 在文档中明确这是预期行为，并补充可识别的错误展示与排查入口。
- [Risk] 历史 mock 文案与 live-only 现状不一致，容易让团队误解 -> Mitigation: 同步清理联调相关页面说明与环境文件注释，统一“demo 仅限本地参考、联调只认 HTTP”表述。
- [Risk] 导入模块仍有本地暂存分支，可能被误认为回退 -> Mitigation: 在规格中区分“联调验收必须走 HTTP 的能力”与“暂未后端化的本地辅助数据”，避免误报。
- [Risk] 强约束 `http` 模式会暴露更多环境配置问题 -> Mitigation: 明确 `.env.staging`、`.env.production` 和默认 `/api/ai` 代理规则，并在验收步骤中加入模式自检。

## Migration Plan

1. 梳理当前 live runtime 入口、gateway 选择器、HTTP 鉴权和页面说明，确认哪些能力已经只走 HTTP，哪些仍属本地辅助路径。
2. 调整前端环境变量说明和运行时守卫，确保测试/预发默认走 `/api/ai`，显式非 `http` 配置会失败而不是降级。
3. 更新页面/运行时说明与联调文档，写明模式切换规则、bootstrap 登录变量用途，以及哪些模块不在本次联调验收范围。
4. 为 live gateway/provider 层补充验证，证明联调失败时不会返回 mock 数据或 direct 结果。
5. 运行前端 lint、类型检查、相关测试和 OpenSpec 校验，确认文档与代码一致。
6. 回滚策略：如联调阻塞，只允许修正 HTTP 配置或 live 错误展示，不允许通过重新启用 mock/direct 回退来“恢复通过”。

## Open Questions

- 是否需要在前端启动时额外输出一个显式的 live-mode 标识，帮助测试人员快速确认当前模式，而不必依赖环境文件或 Network 面板？
- movement / maintenance 这类本地暂存导入能力是否需要在联调文档里单列“非 HTTP 验收范围”，避免被误解为违反 S1-05？
