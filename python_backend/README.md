# LabManager Python Backend Foundation

这是 LabManager 面向目标生产栈的 Python 主后端最小骨架，职责是提供可启动的 FastAPI 运行时、显式配置加载、健康检查、PostgreSQL/Redis 接线位、Celery worker 骨架，以及 LangGraph 编排扩展入口。

## 当前边界

- `frontend/` 仍然是当前演示主入口，不依赖这里已经实现完整业务 API。
- 现有 `backend/` TypeScript 服务继续承担原型与参考实现职责，不再作为新重型生产能力的默认落点。
- `python_backend/` 是后续规则引擎、正式持久化、异步任务、LangGraph 编排等生产级后端能力的默认接入边界。
- 共享 DTO 与正式持久化治理仍以仓库现有契约和 OpenSpec 规格为准，这里只预留适配入口，不复制第二份“真相模型”。

首批迁移能力边界、TS 对照关系、切流顺序、回退策略与 parity 验证标准见 [docs/first-batch-capability-migration-plan.md](/D:/Documents/Codes/Project/_Studio/LabManager/python_backend/docs/first-batch-capability-migration-plan.md)。

## 目录结构

```text
python_backend/
├─ app/
│  ├─ api/         # FastAPI 路由与健康检查
│  ├─ core/        # 配置、日志与运行时初始化
│  ├─ db/          # PostgreSQL / Redis 接线与依赖探测
│  ├─ graphs/      # LangGraph graph/supervisor 占位
│  ├─ tasks/       # Celery app 与示例任务
│  └─ main.py      # FastAPI 应用入口
├─ tests/          # 最小启动与健康检查测试
├─ .env.example
└─ pyproject.toml
```

## 本地启动

```bash
cd python_backend
python -m venv .venv
.venv\Scripts\activate
pip install -e .[dev]
uvicorn app.main:app --reload --port 8001
```

默认提供：

- `GET /health/live`
- `GET /health/ready`

## Database migrations

S1-03 adds a lightweight PostgreSQL migration path under `app/db/migrations/`.
It uses the same `LABMANAGER_PY_DATABASE_URL` setting as the runtime database connector and does not require the HTTP service to be running.
See [docs/database-migrations.md](docs/database-migrations.md) for the formal table set, verification scope, rollback boundary, and current verification gap.

```bash
cd python_backend
python -m app.db.manage apply
python -m app.db.manage status
python -m app.db.manage verify
```

If the package is installed, the same commands are also available through:

```bash
labmanager-db apply
labmanager-db status
labmanager-db verify
```

`verify` checks the formal AI workflow tables, required columns, core foreign keys, and operational indexes. The initial rollback command is safe only before these formal tables contain authoritative migrated production data:

```bash
python -m app.db.manage rollback
```

After production cutover, use forward repair migrations or an explicit data recovery plan instead of dropping formal workflow tables.

`LABMANAGER_PY_SCHEMA_CHECK_ON_READINESS=true` enables schema verification inside readiness diagnostics. Keep it disabled in lightweight local development when no PostgreSQL service is running.

如果你要运行 Celery worker，需要额外提供显式环境变量：

```bash
celery -A app.tasks.celery_app:celery_app worker --loglevel=info
```

## 必需配置

服务通过 `LABMANAGER_PY_*` 环境变量读取配置，不提供可直接用于生产的内置凭证。

- `LABMANAGER_PY_DATABASE_URL`: PostgreSQL 连接串
- `LABMANAGER_PY_REDIS_URL`: Redis 连接串
- `LABMANAGER_PY_CELERY_BROKER_URL`: Celery broker
- `LABMANAGER_PY_CELERY_RESULT_BACKEND`: Celery result backend
- `LABMANAGER_PY_SCHEMA_CHECK_ON_READINESS`: when `true`, readiness diagnostics include formal schema verification

开发环境下如果未提供数据库或 Redis，`/health/ready` 会明确报告缺失项；开启严格模式时会返回失败状态。
