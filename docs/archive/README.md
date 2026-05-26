# 文档归档说明

本目录用于存放已经不再作为当前主线执行依据的历史文档。

归档原则：

- 文档内容已被更新的主线文档替代
- 文档中的页面职责、路线图或任务拆分与当前实现不一致
- 文档仍有历史参考价值，但继续放在 `docs/` 主入口会造成误导

当前已归档文档：

## 1. `ai-employee-development-plan.md`

归档原因：

- 该文档使用早期 Milestone 节奏和周次排期
- 当前项目已切换为以 `docs/ai-executable-backlog.md` 为主的 `P0 / P1 / P2` 执行方式
- 文档中的阶段描述更适合作为历史规划参考，不适合作为当前开发表依据

替代文档：

- `docs/ai-executable-backlog.md`
- `docs/langgraph-agent-architecture.md`
- `docs/stack-migration-roadmap.md`

## 2. `frontend-ai-employee-tasklist.md`

归档原因：

- 该文档是前端早期专项任务清单
- 当前前端 P0 任务已完成并已被总 backlog 吸收
- 若继续保留在主目录，容易与当前跨前后端统一 backlog 重复

替代文档：

- `docs/ai-executable-backlog.md`
- `docs/qa-p0-01-frontend-regression.md`

## 3. `route-mapping.md`

归档原因：

- 文档中的 AI 页面映射停留在早期阶段
- 当前实际路由已包含 `ai-dashboard`、`ai-tasks`、`ai-approvals`、`ai-reports`
- 文档中对 `AIAnalysis`、权限状态和导航结构的描述已与当前实现不完全一致

替代依据：

- `frontend/src/App.tsx`
- `AGENTS.md`
- `docs/ai-executable-backlog.md`

说明：

- `docs/` 根目录保留当前仍作为主线依据的需求、backlog、LangGraph、测试和技术架构文档
- `docs/archive/` 中的文档默认不再作为当前任务拆解和开发排期依据
