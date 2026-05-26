# AGENTS.md

## 0. 对话语言要求

- 永远用中文和用户对话。
- 代码标识符、命令、路径、配置名、环境变量、错误信息保持英文原文。

## 1. 项目定位

LabManager 是面向实验室场景的轻量化管理平台，业务主线包括：

- 化学品 / 试剂进销存管理
- 仪器设备维护记录管理
- 面向任务流的“AI 员工”能力

AI 员工不是自由聊天助手，而是围绕流程负责的数字协调员。V1 主链路是：

`巡检 -> 发现问题 -> 建任务 -> 跟进 -> 审批 -> 报告 -> 审计复盘`

## 2. 当前技术栈

前端：

- React 18
- TypeScript
- React Router v6
- Tailwind CSS
- Vite

后端：

- `python_backend/`：FastAPI、Pydantic Settings、PostgreSQL、Redis、Celery、LangGraph，作为后续生产级后端能力的默认落点。
- `backend/`：TypeScript 后端原型与参考实现，保留领域模型、契约、QA 验证与迁移对照价值。

## 3. 重要目录

- `frontend/src/pages/`：页面入口，包含业务页与 AI 工作台相关页面。
- `frontend/src/ai/`：前端 AI 状态、流程与运行时能力。
- `frontend/src/mock/ai/`：AI mock 数据和演示闭环。
- `frontend/src/data/`：前端业务数据与示例数据。
- `backend/src/domain/`：TypeScript 领域模型参考。
- `backend/src/contracts/`：TypeScript API / DTO 契约参考。
- `backend/src/qa/`：TypeScript 后端 P0/P1/P2 验证脚本入口。
- `python_backend/app/`：Python 后端正式能力目录，包含 `api/`、`db/`、`rules/`、`tasks/`、`approvals/`、`activity_logs/`、`graphs/` 等模块。
- `tests/`：跨后端的 API、权限、回归和对照测试。
- `docs/`：产品、架构、迁移、验收和运行边界文档。
- `openspec/`：OpenSpec 变更与规格资料。

## 4. 常用命令

前端：

```bash
cd frontend
npm install
npm run dev
npm run lint
npm run build
npm run preview
```

`npm run build` 会先运行 `npm run verify:dto-boundary`，再执行 `tsc` 和 `vite build`。

TypeScript 后端参考实现：

```bash
cd backend
npm install
npm run build
npm run typecheck
npm run qa:p0
npm run qa:p1
npm run qa:p2
```

Python 后端：

```bash
cd python_backend
python -m venv .venv
.venv\Scripts\activate
pip install -e .[dev]
uvicorn app.main:app --reload --port 8001
pytest
```

Python 后端数据库迁移：

```bash
cd python_backend
python -m app.db.manage apply
python -m app.db.manage status
python -m app.db.manage verify
```

安装包后也可使用：

```bash
labmanager-db apply
labmanager-db status
labmanager-db verify
```

Celery / Redis 本地开发：

```bash
docker run -d --name labmanager-redis -p 6379:6379 redis:7-alpine
cd python_backend
celery -A app.tasks.celery_app:celery_app worker --loglevel=info --pool=solo
celery -A app.tasks.celery_app:celery_app beat --loglevel=info
```

## 5. V1 范围边界

V1 必做：

- 三类事件：`low_stock`、`maintenance_overdue`、`equipment_fault`
- AI 驾驶台、任务中心、审批台、报告中心
- 前端可模拟闭环
- 后端任务中枢
- 规则驱动事件生成
- 活动日志与审计留痕

V1 不做：

- 自由聊天式通用 AI 助手
- 自动采购下单
- 自动停用设备
- 复杂预测模型
- 长周期自主规划执行

## 6. 主要业务对象

`AIEvent` 事件类型：

- `low_stock`
- `maintenance_overdue`
- `equipment_fault`

`AITask` 任务类型：

- `restock`
- `maintenance`
- `anomaly_review`
- `data_fix`
- `report`

`AITask` 状态：

- `open`
- `in_progress`
- `pending_approval`
- `done`
- `closed`

`AIApproval` 状态：

- `pending`
- `approved`
- `rejected`
- `needs_info`

`AIActivityLog` 必须记录：

- 谁触发
- 为什么触发
- 走了哪个规则 / 节点 / 工具
- 结果是什么

## 7. 产品与工程原则

- 先闭环，再增强。
- 先规则，再智能。
- 先 mock，再真实接口。
- 先低风险自动化，再高风险审批。
- 所有动作必须可追踪、可审计、可回溯。
- Agent 只能通过工具层执行动作，不能直接写数据库。
- LLM 可以生成解释、摘要和建议，但不能决定权限、判重、审批门禁或 SLA 判断。
- 不要在未冻结模型前大规模铺后端实现。
- 不要在尚未完成主链路时提前做复杂预测。

## 8. LangGraph 实施约束

LangGraph 用于 `python_backend/` 的后端 Agent 编排层，不作为前端 mock 阶段的开发起点。

推荐顺序：

1. 冻结任务模型、审批模型、日志模型、事件模型。
2. 完成规则驱动和工具层。
3. 用 LangGraph 编排 Agent 主链路。
4. 引入 LLM 生成解释、建议和报告。

V1 LangGraph 节点：

- `Event Ingestor`
- `Normalize Event`
- `Rule Gate`
- `Supervisor Router`
- `Inventory Handler`
- `Maintenance Handler`
- `Fault Handler`
- `Recommendation Builder`
- `Approval Gate`
- `Create / Update Task`
- `Create Approval`
- `Write Activity Log`

必须是纯代码节点：

- 事件校验
- 规则判断
- 任务判重
- 权限校验
- 审批门禁
- SLA 判断

可以是 LLM 节点：

- 任务原因说明
- 风险解释
- 建议动作摘要
- 日报 / 周报总结

## 9. 前端页面职责

- `Dashboard`：主业务首页，补 AI 今日摘要。
- `AlertCenter`：保留为隐藏兼容详情页；主导航不再暴露，日常预警由全局角落图表呈现。
- `AIWorkbench`：统一承接 AI 总览、任务、审批、报告、分析标签页。
- `SystemSettingsRuntime`：阈值、审批策略、SLA 策略配置入口。
- `DataImportCenter`：手工录入、批量导入、结果反馈、导入历史。
- `ChemicalInventoryOps`：化学品主入口，承接库存清单、入库 / 出库操作和最近出入库流水。
- `EquipmentManagementOps`：仪器设备主入口，承接设备状态、维护台账和异常 AI 联动。
- `AIDashboard` / `AITaskCenter` / `AIApprovals` / `AIReports` / `AIAnalysis`：保留为历史拆分页实现参考，不再作为主路由入口。

## 10. 开发优先级

默认按 `docs/ai-executable-backlog.md` 和 `docs/langgraph-agent-architecture.md` 的 `P0 -> P1 -> P2` 推进。

P0 重点：

- AI 页面闭环
- 核心数据模型
- 状态机
- 基础 API
- 规则驱动事件
- LangGraph V1 主链路

第一批直接开工任务：

- 收敛 AI 信息架构
- 整理 AI 前端状态层
- 补 `Dashboard` / `AlertCenter` / 业务页 AI 联动
- 冻结核心数据模型与状态机
- 定义标准事件 DTO
- 落地 LangGraph V1 节点图

## 11. 环境与密钥

- 真实 `.env`、`.env.local`、`.env.production`、`.env.staging` 以及任何真实密钥都不要提交。
- 模板配置可以提交，例如 `frontend/.env.example`、`backend/.env.example`、`python_backend/.env.example`。
- Python 后端使用 `LABMANAGER_PY_*` 环境变量。
- 常见 Python 后端变量包括 `LABMANAGER_PY_DATABASE_URL`、`LABMANAGER_PY_REDIS_URL`、`LABMANAGER_PY_CELERY_BROKER_URL`、`LABMANAGER_PY_CELERY_RESULT_BACKEND`、`LABMANAGER_PY_SCHEMA_CHECK_ON_READINESS`。
- `LABMANAGER_PY_SCHEMA_CHECK_ON_READINESS=true` 会让 readiness diagnostics 执行正式 schema 校验；本地无 PostgreSQL 时保持关闭。

## 12. 迁移与持久化规则

- 数据库迁移集中在 `python_backend/app/db/migrations/`。
- 迁移命令以 `python -m app.db.manage ...` 或 `labmanager-db ...` 为准。
- 生产切流后，不要用 rollback 删除正式工作流表；使用 forward repair migration 或显式数据恢复计划。
- 修改任务、审批、报告、事件、活动日志字段时，同步检查前端 DTO、后端契约、测试快照和文档。

## 13. 测试与验收

完成开发任务至少满足：

- 代码与文档同步。
- 状态流和错误分支已覆盖。
- 不破坏现有前端可演示闭环。
- 关键动作有日志。
- 任务 / 审批 / 报告 / 事件字段一致。
- 验收标准可人工验证。

按改动范围选择验证：

- 前端改动：至少运行 `cd frontend && npm run lint`，必要时运行 `npm run build`。
- TypeScript 后端改动：运行 `cd backend && npm run typecheck`，按影响范围运行 `npm run qa:p0` / `qa:p1` / `qa:p2`。
- Python 后端改动：运行 `cd python_backend && pytest`，涉及迁移时运行 `python -m app.db.manage verify`。
- 跨契约或 DTO 改动：运行前端 `npm run verify:dto-boundary`，并检查 `tests/api/`、`tests/regression/` 中相关测试。

## 14. 仓库卫生

不要把以下内容作为日常提交内容：

- `node_modules/`
- `dist/`、`build/`、`.vite/`
- 覆盖率、缓存、临时目录
- `*.zip`、`*.tar`、`*.gz`、`*.7z`
- 机器导出产物，例如 `mermaid-diagram-*.png`
- 真实 `.env*` 文件

可以保留的示例 / 文档型资产：

- `frontend/public/imported-data/` 下作为演示或样例输入存在的静态资源
- `prototype/` 下用于原型说明的 `code.html` 和 `screen.png`
- `docs/`、`openspec/`、源码、锁文件和不含敏感值的模板配置

新增工具链、输出目录或生成型文件类型时，同步更新根目录 `.gitignore` 和本文件。

## 15. 提交信息

提交信息遵循 Lore Commit Protocol：第一行写“为什么改”，不是“改了什么”。必要时使用 git trailer：

```text
Constraint: <external constraint>
Rejected: <alternative> | <reason>
Confidence: <low|medium|high>
Scope-risk: <narrow|moderate|broad>
Directive: <future warning>
Tested: <verification performed>
Not-tested: <known gaps>
```

示例：

```text
Prevent silent session drops during long-running operations

The auth service returns inconsistent status codes on token expiry,
so the interceptor catches all 4xx responses and triggers an inline refresh.

Constraint: Auth service does not support token introspection
Rejected: Extend token TTL to 24h | security policy violation
Confidence: high
Scope-risk: narrow
Tested: Expired token refresh unit test
Not-tested: Auth service cold-start > 500ms behavior
```
