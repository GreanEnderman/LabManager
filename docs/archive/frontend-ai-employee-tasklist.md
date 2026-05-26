# LabManager AI 员工前端可执行任务清单
## 1. 目标

本清单用于指导前端先产出一个“可模拟互动”的 AI 员工工作台版本。
本阶段目标不是接入真实后端或真实大模型，而是通过前端本地 mock 数据与状态流，完成以下可演示闭环：
- AI 发现问题
- AI 生成任务
- AI 分配责任人
- AI 发起提醒
- 人工处理任务
- AI 发起审批
- 人工审批
- 任务完成归档
- AI 生成日报/周报

## 2. 交付范围

本阶段前端交付应包含以下页面与能力：
1. AI 驾驶台
2. AI 任务中心
3. AI 审批台
4. AI 报告中心
5. AlertCenter 与 AI 任务联动
6. Dashboard 与 AI 摘要联动
7. ChemicalInventory / Equipment / Maintenance 与 AI 建议、任务入口联动
8. 本地 mock 数据与状态流转

## 3. 实施原则

- 先跑通流程，再追求真实数据
- 所有关键动作都必须可点击、可流转、可回看
- 所有状态变化都必须体现在界面上
- 所有 AI 行为都必须留痕
- 所有高风险动作都必须经过模拟审批

## 4. 阶段任务拆分

### 阶段一：搭建前端模拟数据层

#### T1. 新增 AI mock 数据目录

- 新建 `src/mock/ai/` 目录
- 规划 mock 文件：
  - `events.ts`
  - `tasks.ts`
  - `approvals.ts`
  - `reports.ts`
  - `activity-logs.ts`

验收标准：
- 可在单一入口导出 AI 事件、任务、审批、报告、日志数据
- 页面可直接消费这些 mock 数据

#### T2. 定义 AI 前端数据类型

- 新增或补充以下前端类型：
  - `AIEvent`
  - `AITask`
  - `AIApproval`
  - `AIReport`
  - `AIActivityLog`
- 定义字段：
  - `id`
  - `type`
  - `status`
  - `priority`
  - `riskLevel`
  - `sourceType`
  - `sourceId`
  - `title`
  - `summary`
  - `assignee`
  - `dueAt`
  - `createdAt`

验收标准：
- 所有 AI 页面共用同一套类型定义
- 任务、审批、日志之间能通过 `id` 或 `sourceId` 建立关联

#### T3. 建立本地状态管理

- 新增一个 AI 状态管理模块
- 可先使用 React Context + useReducer，或轻量 store
- 支持以下动作：
  - `createTask`
  - `assignTask`
  - `updateTaskStatus`
  - `createApproval`
  - `approveRequest`
  - `rejectRequest`
  - `addActivityLog`
  - `generateReport`

验收标准：
- 不刷新页面的情况下可完成完整状态流转
- 所有动作都会同步更新相关列表和日志

### 阶段二：AI 驾驶台

#### T4. 将 `AIAnalysis` 重构为 AI 驾驶台

- 页面定位从“静态分析展示”改为“AI 员工工作总览”
- 页面保留概览作用，不再以图表占位为主

页面内容：
- 今日发现问题数
- 待处理任务数
- 待审批数
- 超时任务数
- AI 建议动作列表
- 最近活动时间线

验收标准：
- 驾驶台能展示 AI 全局工作状态
- 可从驾驶台进入任务、审批和报告页面

#### T5. 新增 AI 建议动作卡片

- 展示示例动作：
  - 生成补货任务
  - 生成维护任务
  - 催办超时任务
  - 生成日报
- 每张卡片提供点击动作

验收标准：
- 点击后能更新任务列表、审批列表或报告列表
- 操作结果会进入活动日志

#### T6. 新增 AI 活动时间线组件

- 展示 AI 最近执行的动作
- 每条日志显示：
  - 时间
  - 动作类型
  - 关联任务
  - 结果摘要

验收标准：
- 所有关键动作都能在时间线中看到
