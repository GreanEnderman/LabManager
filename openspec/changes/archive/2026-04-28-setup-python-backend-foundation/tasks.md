## 1. Python 服务骨架与依赖清单

- [x] 1.1 创建独立的 Python 主后端目录、基础包结构和服务入口文件。
- [x] 1.2 添加 Python 依赖清单与项目元数据，覆盖 FastAPI、PostgreSQL 驱动、Redis、Celery、LangGraph Python 及基础开发工具。
- [x] 1.3 补充服务级说明文件与非敏感环境变量示例，明确启动方式和必需配置项。

## 2. FastAPI 运行时与健康检查

- [x] 2.1 实现集中配置模块与运行时初始化逻辑，使用环境变量驱动服务配置并禁止敏感默认值回退。
- [x] 2.2 实现 FastAPI 应用装配、基础路由挂载与日志初始化。
- [x] 2.3 提供 `live` 与 `ready` 健康检查端点，并为 PostgreSQL / Redis 依赖探测预留清晰接线点。

## 3. 基础基础设施装配

- [x] 3.1 添加 PostgreSQL 与 Redis 的基础连接模块或工厂，占位后续正式持久化实现入口。
- [x] 3.2 创建 Celery 应用与至少一个示例任务，确保异步任务骨架和 Redis broker/result backend 接线存在。
- [x] 3.3 创建 LangGraph 模块边界与最小 graph/supervisor stub，确保后续 AI 编排可以在固定位置扩展。

## 4. 仓库协作边界与最小验证

- [x] 4.1 在 Python 服务文档或仓库说明中明确其与 `frontend/`、TypeScript 原型 `backend/`、共享 DTO 和正式持久化治理之间的职责边界。
- [x] 4.2 添加最小测试或验证脚本，覆盖应用启动与健康检查成功路径。
- [x] 4.3 运行最小启动与验证命令，确认 Python 服务骨架可启动、健康检查可访问、基础模块导入正常。
