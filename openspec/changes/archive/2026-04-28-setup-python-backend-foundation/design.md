## Context

当前仓库的主实现仍以 React 前端与 TypeScript 原型后端为主，Python 目标栈仅停留在迁移方向与架构文档层面。`python-heavy-capability-intake` 已要求新的重型生产能力默认进入 Python 目标栈规划，`formal-persistence-model-governance` 已冻结正式持久化目标表集合，`bootstrap-credential-hardening` 也已经限制了运行时配置与默认凭证行为。

这意味着仓库已经具备“为什么要迁到 Python”的产品和治理前提，但还缺少一个最小可运行的 Python 主后端落脚点。没有这个骨架，后续规则服务、任务中枢、异步任务、LangGraph 编排与正式数据库接入都只能停留在文档或继续挤压 TypeScript 原型边界。

本设计要解决的是“先把 Python 主后端立起来”，而不是一次性完成全部业务迁移。它必须满足以下现实约束：

- 必须与现有仓库并存，不能破坏前端现有演示闭环。
- 必须给 PostgreSQL、Redis、Celery、LangGraph 留出明确接入点，但不要求本变更完成完整业务实现。
- 必须遵守已冻结的正式持久化与安全配置方向，避免后续返工。
- 必须优先提供可启动、可探活、可配置、可扩展的工程基线。

## Goals / Non-Goals

**Goals:**
- 定义 Python 主后端最小可运行工程的推荐目录结构与职责分层。
- 规定 FastAPI 应用、配置加载、健康检查、Celery worker、Redis/PostgreSQL 连接、LangGraph 编排入口的基础装配方式。
- 明确 Python 主后端与当前前端、TypeScript 原型后端、共享 DTO、正式持久化模型之间的协作边界。
- 为后续 `/opsx:apply` 实施提供清晰、可验证、低歧义的任务拆解。

**Non-Goals:**
- 实现完整的任务中枢、审批流、规则引擎或 LangGraph 业务链路。
- 在本变更内完成 TypeScript 后端向 Python 的全面流量切换。
- 冻结最终 ORM 细节、全部表迁移细节或所有容器编排方案。
- 让 Python 服务在本阶段直接成为全部前端页面的唯一生产 API。

## Decisions

### 1. Python 主后端以独立顶级目录存在，并与现有前后端并行

本变更将 Python 主后端设计为仓库内的独立顶级目录，例如 `python_backend/` 或同等明确命名的服务根目录，而不是嵌入 `backend/src/` 的 TypeScript 结构中。该目录下应独立持有应用入口、配置、API、基础领域模块、基础基础设施模块、worker 与 LangGraph 占位。

推荐最小结构：

- `python_backend/app/main.py` 或等价入口：FastAPI 应用装配
- `python_backend/app/api/`: 路由与健康检查
- `python_backend/app/core/`: 配置、日志、运行时初始化
- `python_backend/app/db/`: 数据库与 Redis 装配、连接健康探测
- `python_backend/app/tasks/`: Celery 应用与示例任务
- `python_backend/app/graphs/`: LangGraph supervisor / handler 占位
- `python_backend/tests/`: 启动与健康检查基础测试
- `python_backend/pyproject.toml` 或等价依赖清单
- `python_backend/.env.example`: 非敏感配置样例

Rationale:
- 独立目录最符合“Python 目标栈”定位，不会把生产后端继续伪装成 TypeScript 子模块。
- 能清晰标明这是新主后端的起点，同时保留现有 TypeScript 原型用于当前演示链路。
- 降低依赖与工具链相互污染风险。

Alternatives considered:
- 在现有 `backend/` 目录中混放 Python 文件。Rejected，因为会模糊技术栈边界并增加构建与运维歧义。
- 单独新建仓库。Rejected，因为当前阶段仍需要与现有前端、文档、规格、原型代码共享上下文。

### 2. FastAPI 负责同步 API 外壳，Celery 负责异步执行骨架，LangGraph 先以可装配占位存在

Python 主后端的最小可运行形态应包含三个并行但松耦合的运行时入口：

- FastAPI Web 进程，用于 `/health/live`、`/health/ready`、未来 `/api/*` 路由挂载
- Celery worker 进程，用于异步任务执行骨架与 Redis broker 接入
- LangGraph 装配模块，用于后续 AI supervisor / handler 图编排入口，但当前只要求存在清晰的创建接口和示例 stub

FastAPI 不应直接承担所有后台任务；异步任务入口必须通过 Celery 应用暴露。LangGraph 不必在本变更中跑真实业务图，但必须具备可导入、可实例化、可被后续 handler 扩展的模块边界。

Rationale:
- 这与产品路线中“任务推进、审批、报告、审计”需要同步接口 + 异步执行 + Agent 编排的结构相匹配。
- 先把三条运行时主干立住，后续新增能力时不需要重构工程骨架。

Alternatives considered:
- 仅搭 FastAPI，不引入 Celery/LangGraph 占位。Rejected，因为验收标准已明确要求任务队列骨架与 LangGraph Python 基线。
- 立即实现完整 LangGraph 流程。Rejected，因为这会把“基础骨架”任务膨胀成业务实现任务。

### 3. 配置系统必须以显式环境变量为中心，并与默认凭证禁令保持一致

Python 主后端必须通过集中配置模块读取环境变量，区分本地开发与非开发环境的启动行为。数据库 DSN、Redis URL、Celery broker/result backend、服务端口、日志级别、LangGraph 开关等均应来自显式配置。仓库可以提供 `.env.example` 作为字段说明，但不得提供可直接用于生产的默认敏感凭证。

健康检查与启动逻辑必须在没有必需配置时给出明确失败信息，而不是悄悄回退到仓库内置账户或隐式连接参数。

Rationale:
- 与 `bootstrap-credential-hardening` 保持一致，避免 Python 栈重新引入默认凭证问题。
- 配置集中化是后续本地、CI、容器化部署的必要基础。

Alternatives considered:
- 在代码中写入本地默认连接串。Rejected，因为这会重新制造安全和环境漂移风险。
- 完全依赖 Docker Compose 隐式注入。Rejected，因为当前阶段仍需支持最小本地直接启动。

### 4. 就绪检查区分 live 与 ready，ready 必须反映依赖可达性

Python 主后端应至少提供两个健康检查端点：

- `live`：仅表明进程已启动并可响应
- `ready`：表明应用关键依赖初始化通过，至少应覆盖配置装载结果，并为 PostgreSQL/Redis 可达性预留检查钩子

在最小实现阶段，`ready` 可以允许可配置的“宽松模式”，以便本地在未接入全部依赖时也能验证工程骨架，但默认设计应为依赖探测路径清晰存在。

Rationale:
- 这为未来容器编排、worker 协同和部署探活提供标准入口。
- 能在不实现业务 API 的情况下，先验证服务骨架是否真的“可运行”。

Alternatives considered:
- 只有单一 `/health` 路由。Rejected，因为无法清晰区分进程活性与依赖就绪性。

### 5. Python 主后端先消费已冻结的持久化方向，不在本变更内反向定义业务模型

Python 工程骨架需要预留与正式 PostgreSQL 持久化模型对接的位置，例如数据库会话工厂、迁移目录或仓储接口包，但不能在本设计中重新发明 `ai_tasks`、`approvals` 等正式模型命名。相关实现必须把 `formal-persistence-model-governance` 视为上游约束。

这意味着本变更允许：

- 创建数据库基础连接、迁移工具入口、占位模型模块
- 为未来 `ai_tasks` 等表的 ORM/SQL 层预留目录与命名空间

但不要求：

- 在本轮把所有正式表全部建完并接入业务

Rationale:
- 既满足“建立 PostgreSQL 基线”，又避免把基础骨架任务和持久化全量实现混在一起。

Alternatives considered:
- 在本变更内完整实现全部正式表与仓储。Rejected，因为超出基础骨架范围。
- 完全不考虑正式表治理，只做临时 demo 库连接。Rejected，因为会偏离已冻结治理方向。

### 6. 与现有仓库的协作边界必须在文档与代码结构上同时可见

本变更必须明确以下边界：

- `frontend/` 继续作为当前演示主入口，不因 Python 骨架接入而被迫切换 API
- 现有 TypeScript `backend/` 在迁移期间保留原型/参考职责，不再承接新的重型生产能力
- Python 主后端承接后续新生产级后端实现入口，尤其是规则引擎、任务中枢、异步任务、LangGraph 编排
- 共享 DTO 与正式持久化模型是跨栈对齐依据，但 Python 代码不应直接复制一份随意漂移的“平行真相”

该边界至少应在变更文档、README 或服务根文档、目录命名与任务拆解中体现。

Rationale:
- 这是本任务验收标准中“与当前仓库结构的协作边界清晰”的核心。
- 没有边界说明，后续实现极易再次把能力塞回 TS 原型。

Alternatives considered:
- 只在设计文档中写边界，不在工程说明中体现。Rejected，因为实施后容易失效。

## Risks / Trade-offs

- [Python 服务目录命名和最终部署形态可能在后续调整] → Mitigation：冻结职责边界与最小模块结构，而不是过早绑定部署细节。
- [最小骨架可能让人误以为业务已经迁完] → Mitigation：在文档与健康检查之外不暴露“已完成业务能力”的暗示，并在任务中显式标注占位性质。
- [PostgreSQL/Redis 探测在本地环境可能增加启动门槛] → Mitigation：将 live/ready 分离，并允许开发模式下的受控宽松检查。
- [Celery 与 LangGraph 先占位可能被质疑“未完全实现”] → Mitigation：把验收锚定在“可运行骨架 + 明确装配点”，而非完整业务执行。

## Migration Plan

1. 在仓库中创建独立 Python 主后端目录与基础依赖清单。
2. 实现集中配置模块、FastAPI 应用入口、`live/ready` 健康检查和基础日志装配。
3. 接入 PostgreSQL 与 Redis 的基础连接配置，以及 Celery 应用与示例任务骨架。
4. 创建 LangGraph 装配模块与最小 stub，使后续 supervisor/handler 可在固定位置扩展。
5. 补充服务根说明文档，明确与前端、TypeScript 原型后端、共享 DTO、正式持久化治理的协作边界。
6. 通过最小测试或启动验证证明 Web 进程与 worker 骨架可正常初始化。

Rollback strategy:

- 如果 Python 骨架实现出现问题，可在不影响现有前端与 TypeScript 原型后端运行的前提下回退新增 Python 目录与启动接线。
- 回退不应改变“新重型生产能力默认进入 Python 目标栈”的治理方向；只回退实现，不回退职责边界。

## Open Questions

- Python 主后端目录最终命名是 `python_backend/`、`services/python-backend/`，还是其他更契合仓库结构的路径？
- 初始依赖管理使用 `uv`、`poetry` 还是标准 `pip + pyproject.toml`，以便兼顾团队习惯和 CI 简洁性？
- 第一轮 `ready` 检查是否默认要求 PostgreSQL 与 Redis 都可达，还是开发模式下允许单独关闭依赖探测？
- LangGraph 初始集成是仅保留图构造工厂，还是同时提供一个可执行的空白 supervisor graph 示例？
