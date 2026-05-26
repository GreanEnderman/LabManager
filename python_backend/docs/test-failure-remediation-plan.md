# Python Backend Test Failure Remediation Plan

本文档记录 2026-05-04 全量 `pytest` 中仍存在的既有失败项。它们不阻塞 `/api/ai` 兼容层专项验证，但会阻塞后续正式迁移 reports、PDF 与数据库相关能力。

## Current Status

最近一次全量结果：

- `34 passed`
- `6 failed`

已通过的兼容层专项：

- `pytest tests\test_ai_compat_gateway.py`
- 结果：`3 passed`

## Failure 1: database URL expectation drift

测试：

- `tests/test_db_migrations.py::test_manage_reports_missing_database_url_without_traceback`

现象：

- 测试期望 `main(["status"])` 返回 `1`
- 实际返回 `0`

初步判断：

- 当前测试环境已经注入或解析到了 database config，导致 CLI 不再进入缺失配置分支。

修复方向：

- 在该测试内显式清理 `LABMANAGER_PY_DATABASE_URL`。
- 清理 `get_settings()` cache，避免跨测试环境污染。
- 将 CLI 对缺失配置的行为定义为固定契约：缺失 DB URL 时 `status` 返回 `1`，且不打印 traceback。

## Failure 2: health readiness configErrors expectation drift

测试：

- `tests/test_health.py::test_ready_health_endpoint_reports_missing_config_in_non_strict_mode`

现象：

- 测试期望 `configErrors` 包含数据库与 Redis 缺失错误
- 实际 `configErrors` 为空

初步判断：

- 环境变量或 settings cache 影响了测试隔离。

修复方向：

- 在测试 fixture 中对 readiness 测试隔离环境变量。
- 每次 `create_app()` 前后清理 `get_settings.cache_clear()`。
- 保持非 strict readiness 的语义：HTTP 200，但 `configErrors` 应如实报告缺失依赖。

## Failure 3: WeasyPrint and pydyf version mismatch

测试：

- `tests/test_pdf_export.py::test_pdf_export_with_chinese_characters`
- `tests/test_pdf_export.py::test_pdf_export_empty_content`

现象：

- `TypeError: PDF.__init__() takes 1 positional argument but 3 were given`

初步判断：

- 当前运行环境实际安装的 `pydyf` 版本与 `weasyprint>=60,<61` 不兼容。
- `pyproject.toml` 已约束 `pydyf>=0.9.0,<0.10.0`，但全局 Python 环境可能没有按项目依赖锁定运行。

修复方向：

- 优先在项目虚拟环境中运行测试。
- 增加依赖健康检查，启动时或 PDF 测试前确认 `weasyprint` 与 `pydyf` 版本组合。
- 如当前环境必须使用全局 Python，则调整安装依赖到约束版本。

## Failure 4: weekly report AsyncMock cursor fixture

测试：

- `tests/test_weekly_report.py::test_weekly_report_with_full_data`
- `tests/test_weekly_report.py::test_weekly_report_with_partial_data`

现象：

- `TypeError: 'coroutine' object does not support the asynchronous context manager protocol`

初步判断：

- `mock_db_connection.cursor()` 返回的是 coroutine，而 data access 代码需要 `async with conn.cursor() as cur`。
- daily report 测试出现 warnings，weekly report 直接失败，说明 fixture 没有完整模拟 async context manager。

修复方向：

- 改造 `tests/conftest.py` 中的 `mock_db_connection`，让 `cursor()` 返回支持 `__aenter__` / `__aexit__` 的对象。
- 为 `fetchall()` 提供按查询场景可配置的结果。
- 保持 data access 实现不为测试夹具退让，优先修 fixture。

## Recommended Order

1. 修 settings cache 与环境隔离，恢复 DB/health 测试确定性。
2. 修 AsyncMock cursor fixture，让 report generator 测试稳定。
3. 在虚拟环境中锁定 PDF 依赖组合，解决 WeasyPrint/pydyf mismatch。
4. 再开始把 `/api/ai/reports` 与 `/api/ai/reports/{id}/pdf` 从 compat fallback 切到正式 Python 服务。
