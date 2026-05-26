# Docs 导航

本目录用于存放 LabManager 当前有效的需求、设计、backlog、测试与架构文档。

为避免历史文档与当前主线混杂，本文档将资料分为三类：

- 当前主线依据：直接用于开发、排期、联调和验收
- 背景与补充资料：提供需求来源或早期设计参考
- 历史归档：不再作为当前执行依据，仅保留回溯价值

---

## 1. 当前主线依据

这些文档应视为当前开发过程中的优先参考入口。

### 1.1 执行与排期

- `ai-executable-backlog.md`
  - 当前唯一主 backlog
  - 按 `P0 / P1 / P2` 和 `前端 / 后端 / AI / 测试` 组织
  - 当前任务推进、状态同步、版本收敛统一以此为准
- `production-remediation-backlog.md`
  - 生产整改与迁移边界主文档
  - 明确 `maintenance-only TS backend` 与 `new heavy production capability` 的治理口径

### 1.2 Agent 与流程编排

- `langgraph-agent-architecture.md`
  - 当前 LangGraph 主链路设计文档
  - 用于约束节点、State、工具层与实施拆解

### 1.3 成品技术架构

- `final-production-architecture.md`
  - 成品级最终技术架构方案
  - 说明前端、后端、AI、数据库、调度、文件、邮件、部署的推荐技术栈

- `backend-runtime-config-boundary.md`
  - 后端运行时配置边界说明
  - 说明 local / test / staging / production 的配置分层、secret 注入规则与 bootstrap 凭据约束

- `stack-migration-roadmap.md`
  - 技术栈迁移时机与迁移路线图
  - 说明 `现在 / P1 中段 / P1 后段 / P2` 如何迁移、先迁什么、哪些不要动

- `production-remediation-backlog.md`
  - 生产整改任务清单
  - 用于约束 TS 原型冻结边界、Python 目标栈 intake 和迁移期守则

### 1.4 测试与回归

- `qa-p0-01-frontend-regression.md`
  - 当前前端 P0 主流程手工回归清单

---

## 2. 背景与补充资料

这些文档仍有参考价值，但默认不作为当前排期和执行的唯一依据。

### 2.1 需求来源

- `实验室物料管理AI员工需求文档.md`
  - AI 员工专项需求来源文档

- `实验室物料管理AI员工需求文档.pdf`
  - 上述需求文档的 PDF 版本

- `lab-management-requirements.md`
  - 项目整体业务需求整理

### 2.2 早期设计参考

- `ai-employee-design.md`
  - AI 员工整体设计说明
  - 适合作为概念设计和背景理解参考

- `frontend-design-spec.md`
  - 前端页面与视觉/信息架构早期设计稿
  - 适合作为界面设计背景参考

---

## 3. 历史归档

- `archive/`
  - 已确认不再作为当前主线执行依据的历史文档
  - 归档原因与替代关系见 `archive/README.md`

当前已归档：

- `archive/ai-employee-development-plan.md`
- `archive/frontend-ai-employee-tasklist.md`
- `archive/route-mapping.md`

---

## 4. 使用建议

### 4.1 日常开发

默认先看：

1. `ai-executable-backlog.md`
2. `langgraph-agent-architecture.md`
3. `AGENTS.md`

### 4.2 技术决策或栈迁移

默认先看：

1. `final-production-architecture.md`
2. `stack-migration-roadmap.md`
3. `production-remediation-backlog.md`

### 4.3 需求追溯

默认先看：

1. `实验室物料管理AI员工需求文档.md`
2. `lab-management-requirements.md`

### 4.4 查历史方案

默认先看：

1. `archive/README.md`
2. 对应归档文档

---

## 5. 维护规则

- 新增文档前，优先判断是否应并入现有主线文档
- 若某文档已被 backlog 或新架构文档完整替代，应移入 `archive/`
- 若文档仍保留在 `docs/` 根目录，默认表示它对当前项目仍有现实参考价值
- 涉及导入、报告、PDF、邮件、异步任务等新增重型后端能力时，默认先同步检查 `production-remediation-backlog.md` 中的 TS 冻结边界与 Python intake 规则
