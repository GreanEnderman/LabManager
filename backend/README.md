# LabManager Backend

LabManager 的后端阶段采用“领域层先行”的方式推进：

- 先冻结核心数据模型
- 先实现任务状态机与审批状态机
- 再接 API、规则引擎与 LangGraph

当前目录职责：

- `src/domain/`：核心领域类型、模型定义、状态机、日志辅助函数
- `src/contracts/`：前后端和 LangGraph 共享的数据契约

当前已覆盖：

- `BE-P0-01` AI 核心数据模型冻结
- `BE-P0-02` 任务状态机实现
- `BE-P0-03` 审批状态机实现
- `P0-05` 正式持久化模型收口脚手架（正式表定义、DDL 产物、snapshot 过渡边界）

建议后续顺序：

1. 基于 `src/contracts/api.ts` 补任务与审批 API
2. 将日志写入服务接到状态机动作
3. 将规则引擎和 LangGraph 输入输出统一到 `src/contracts/`

持久化相关补充：

- 正式表定义见 `src/domain/models.ts`
- 关系型 schema 脚手架见 `src/services/formal-persistence-schema.ts`
- 过渡 snapshot 存储仅用于兼容和回退，不是正式生产真相
