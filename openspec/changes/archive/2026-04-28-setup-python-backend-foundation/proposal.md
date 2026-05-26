## Why

当前仓库已经明确了 Python 将承接重型生产能力，并且已经冻结了正式持久化目标，但还没有一个可启动、可扩展、可与现有前后端原型共存的 Python 主后端工程骨架。现在建立最小可运行基础骨架，可以把后续规则引擎、任务中枢、异步任务与 LangGraph 编排接入放到稳定目标栈上，而不是继续堆叠在 TypeScript 原型后端中。

## What Changes

- 新增 Python 主后端最小可运行工程骨架，覆盖 FastAPI 应用入口、基础目录结构、配置加载、健康检查与本地启动路径。
- 定义 PostgreSQL、Redis、Celery、LangGraph Python 在 V1 中的接入位置与基础装配方式，但不在本变更内实现完整业务链路。
- 明确 Python 主后端与现有 React 前端、TypeScript 原型后端、共享 DTO/正式持久化模型之间的协作边界，避免职责重叠和后续迁移歧义。
- 为后续实现提供可验证的任务拆解，使 `/opsx:apply` 可以直接进入骨架搭建与最小联调工作。

## Capabilities

### New Capabilities
- `python-runtime-foundation`: 定义 Python 主后端的最小可运行骨架，包括 API 进程、配置系统、健康检查、任务队列入口和 LangGraph 集成占位。
- `python-backend-coexistence-boundary`: 定义 Python 主后端与现有仓库中前端、TypeScript 原型后端、共享模型和正式持久化目标之间的职责边界与协作方式。

### Modified Capabilities
- None.

## Impact

- 受影响代码与目录：新增或扩展仓库中的 Python 后端目录、应用入口、配置模块、基础 worker 目录与依赖清单。
- 受影响系统：FastAPI、PostgreSQL、Redis、Celery、LangGraph Python 的基础装配方式。
- 受影响契约：需要遵守 `python-heavy-capability-intake` 与 `formal-persistence-model-governance` 已冻结的方向，但本变更不修改现有 OpenSpec 规格。
- 受影响协作边界：明确当前 TypeScript 原型后端继续承接既有演示链路，Python 主后端先承接新生产级后端骨架与后续迁移入口。
