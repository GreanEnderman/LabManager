# Agent V1 实施计划

## 文档说明

本文档基于 [agent-architecture-v1.md](../python_backend/docs/agent-architecture-v1.md) 和当前代码实现状态，制定详细的实施计划。

**规划日期**: 2026-05-05  
**目标**: 补齐 Python 后端智能体架构 V1，并增强 LLM 能力

---

## 当前状态总结

### ✅ 已完成（完成度 85%）

1. **LangGraph Supervisor Graph 主链路** - 100%
   - 所有 12 个节点已实现
   - 条件分支逻辑完整
   - 状态流转正确

2. **专项 Agent** - 100%
   - Inventory Agent（库存）
   - Maintenance Agent（维护）
   - Fault Agent（故障）

3. **工具层抽象** - 90%
   - TaskTool、ApprovalTool、AuditLogTool 接口完整
   - 内存实现和正式实现并存
   - 规则适配器已实现

4. **纯代码门禁** - 95%
   - 事件校验、判重、审批门禁都是纯代码
   - 权限判断基础实现已有

### ⚠️ 待补齐

1. **API 路由对接** - 需验证
2. **集成测试** - 部分覆盖
3. **权限判断** - 需增强
4. **LLM 集成** - 未实现

---

## 阶段一：立即可做（补齐 V1）

### 任务 1.1：验证 API 路由对接

**目标**: 确保 `/api/ai/rules/execute` 正确对接到 Supervisor Graph

**当前状态**:
- ✅ `ai_compat.py:529-568` 已实现 `/api/ai/rules/execute` 端点
- ✅ 当 `Capability.RULES` 路由到 `PYTHON_BACKEND` 时，调用 `run_supervisor_graph_async`
- ✅ 使用 `resolve_supervisor_tools()` 获取工具层实例
- ⚠️ 需要验证完整链路是否正常工作

**实施步骤**:

1. **编写端到端测试** (2小时)
   ```python
   # tests/test_rules_execute_integration.py
   async def test_rules_execute_calls_supervisor_graph():
       # 发送事件到 /api/ai/rules/execute
       # 验证返回包含 taskId
       # 验证任务已创建
       # 验证活动日志已写入
   ```

2. **验证 capability routing** (1小时)
   - 检查 `app/gateway/routing.py` 配置
   - 确认 `Capability.RULES` 默认路由
   - 测试 capability flag 切换

3. **验证工具层对接** (1小时)
   - 确认 `TaskServiceTaskTool` 正确写入数据库
   - 确认 `ApprovalServiceApprovalTool` 正确创建审批
   - 确认 `TaskActionAuditLogTool` 正确写入日志

**验收标准**:
- [ ] 从前端发送事件到 `/api/ai/rules/execute` 可以成功创建任务
- [ ] 任务数据正确写入 `ai_tasks` 表
- [ ] 活动日志正确写入 `ai_task_actions` 表
- [ ] 高风险事件正确创建审批记录
- [ ] 判重逻辑正确工作（重复事件不创建新任务）

**依赖**: 无

**预计工时**: 4小时

### 任务 1.2：补充 Supervisor Graph 集成测试

**目标**: 完整覆盖 Supervisor Graph 的所有节点和分支

**当前状态**:
- ✅ 已有 `tests/test_supervisor_graph.py` 基础测试
- ⚠️ 需要补充边界场景和错误处理测试

**实施步骤**:

1. **补充三类事件的完整测试** (3小时)
   ```python
   # tests/test_supervisor_graph_complete.py
   
   async def test_low_stock_event_creates_restock_task():
       """测试低库存事件 -> 补货任务"""
   
   async def test_maintenance_overdue_creates_maintenance_task():
       """测试维护超期事件 -> 维护任务"""
   
   async def test_equipment_fault_creates_high_risk_approval():
       """测试设备故障事件 -> 高风险审批"""
   ```

2. **补充判重逻辑测试** (2小时)
   ```python
   async def test_duplicate_event_returns_existing_task():
       """重复事件应返回已有任务，不创建新任务"""
   
   async def test_closed_task_allows_new_task():
       """已关闭任务不阻止新任务创建"""
   ```

3. **补充审批门禁测试** (2小时)
   ```python
   async def test_high_risk_event_requires_approval():
       """高风险事件必须创建审批"""
   
   async def test_medium_risk_event_no_approval():
       """中风险事件不需要审批"""
   ```

4. **补充错误处理测试** (2小时)
   ```python
   async def test_invalid_event_type_rejected():
       """非法事件类型应被拒绝"""
   
   async def test_missing_required_fields_rejected():
       """缺少必需字段应被拒绝"""
   
   async def test_tool_failure_graceful_degradation():
       """工具层失败应优雅降级"""
   ```

**验收标准**:
- [ ] 三类事件的正常流程都有测试覆盖
- [ ] 判重逻辑有完整测试（包括边界情况）
- [ ] 审批门禁逻辑有完整测试
- [ ] 错误处理和降级逻辑有测试覆盖
- [ ] 测试覆盖率 > 85%

**依赖**: 任务 1.1

**预计工时**: 9小时

---

### 任务 1.3：完善权限判断逻辑

**目标**: 实现完整的权限判断，确保只有授权用户可以执行敏感操作

**当前状态**:
- ⚠️ `rules_adapter.py` 有基础权限判断框架
- ❌ 缺少完整的权限策略定义
- ❌ 缺少权限验证中间件

**实施步骤**:

1. **定义权限模型** (2小时)
   ```python
   # app/auth/permissions.py
   
   class Permission(str, Enum):
       RULES_EXECUTE = "rules:execute"
       TASK_CREATE = "task:create"
       TASK_ASSIGN = "task:assign"
       APPROVAL_CREATE = "approval:create"
       APPROVAL_PROCESS = "approval:process"
   
   class Role(str, Enum):
       ADMIN = "admin"
       MANAGER = "manager"
       OPERATOR = "operator"
       VIEWER = "viewer"
   
   ROLE_PERMISSIONS = {
       Role.ADMIN: [all permissions],
       Role.MANAGER: [most permissions],
       Role.OPERATOR: [limited permissions],
       Role.VIEWER: [read-only],
   }
   ```

2. **实现权限验证中间件** (3小时)
   ```python
   # app/auth/middleware.py
   
   def require_permission(permission: Permission):
       """装饰器：验证用户是否有指定权限"""
   
   async def verify_actor_permission(actor: dict, permission: Permission) -> bool:
       """验证 actor 是否有权限"""
   ```

3. **在 Supervisor Graph 中集成权限检查** (2小时)
   ```python
   # app/graphs/supervisor.py
   
   def normalize_event(state: SupervisorState) -> SupervisorState:
       # 添加权限检查
       if not verify_actor_permission(state["actor"], Permission.RULES_EXECUTE):
           state["errors"].append("Permission denied")
           return state
   ```

4. **补充权限测试** (2小时)
   ```python
   # tests/test_permissions.py
   
   async def test_admin_can_execute_rules():
       """管理员可以执行规则"""
   
   async def test_viewer_cannot_execute_rules():
       """查看者不能执行规则"""
   ```

**验收标准**:
- [ ] 权限模型清晰定义
- [ ] 所有敏感操作都有权限检查
- [ ] 权限验证失败返回明确错误
- [ ] 权限测试覆盖所有角色和操作组合

**依赖**: 任务 1.1

**预计工时**: 9小时

---

## 阶段二：近期推进（增强能力）

### 任务 2.1：接入 LLM 到 Recommendation Builder

**目标**: 使用 LLM 生成更智能的任务原因、风险说明和建议动作

**当前状态**:
- ❌ `supervisor.py:250-260` 的 `build_recommendation` 是硬编码模板
- ❌ 未接入任何 LLM API

**实施步骤**:

1. **选择 LLM 提供商** (1小时)
   - 选项 A: OpenAI GPT-4
   - 选项 B: Anthropic Claude
   - 选项 C: 本地部署模型
   - 建议: 使用 Anthropic Claude（与当前 AI 员工定位一致）

2. **实现 LLM 客户端** (3小时)
   ```python
   # app/llm/client.py
   
   class LLMClient:
       async def generate_task_reason(
           self,
           event: dict,
           context: dict,
       ) -> str:
           """生成任务原因说明"""
   
       async def generate_risk_explanation(
           self,
           event: dict,
           risk_level: str,
       ) -> str:
           """生成风险解释"""
   
       async def generate_recommendation(
           self,
           event: dict,
           task_type: str,
       ) -> str:
           """生成建议动作"""
   ```

3. **设计 Prompt 模板** (4小时)
   ```python
   # app/llm/prompts.py
   
   TASK_REASON_PROMPT = """
   你是实验室管理 AI 助手。根据以下事件信息，生成简洁的任务原因说明（1-2句话）。
   
   事件类型: {event_type}
   来源对象: {source_name}
   证据: {evidence}
   
   要求：
   - 说明为什么需要处理这个问题
   - 突出关键风险点
   - 语气专业、客观
   """
   
   RISK_EXPLANATION_PROMPT = """..."""
   RECOMMENDATION_PROMPT = """..."""
   ```

4. **集成到 Supervisor Graph** (3小时)
   ```python
   # app/graphs/supervisor.py
   
   async def build_recommendation(state: SupervisorState) -> SupervisorState:
       llm_client = get_llm_client()
       
       # 使用 LLM 生成内容
       reason = await llm_client.generate_task_reason(
           event=state["normalizedEvent"],
           context=state.get("ruleDecision", {}),
       )
       
       risk_explanation = await llm_client.generate_risk_explanation(
           event=state["normalizedEvent"],
           risk_level=state["handlerResult"]["riskLevel"],
       )
       
       recommendation_text = await llm_client.generate_recommendation(
           event=state["normalizedEvent"],
           task_type=state["handlerResult"]["taskType"],
       )
   ```

5. **添加降级策略** (2小时)
   ```python
   # 当 LLM 失败时，回退到模板
   try:
       reason = await llm_client.generate_task_reason(...)
   except Exception:
       reason = fallback_template_reason(event)
   ```

6. **补充测试** (3小时)
   ```python
   # tests/test_llm_integration.py
   
   async def test_llm_generates_task_reason():
       """测试 LLM 生成任务原因"""
   
   async def test_llm_failure_uses_fallback():
       """测试 LLM 失败时使用降级模板"""
   ```

**验收标准**:
- [ ] LLM 客户端正确实现并可配置
- [ ] Prompt 模板经过测试和优化
- [ ] 生成的文本质量高于硬编码模板
- [ ] LLM 失败时有降级策略
- [ ] 响应时间 < 2秒（P95）

**依赖**: 任务 1.1, 1.2

**预计工时**: 16小时

### 任务 2.2：实现报告自然语言摘要

**目标**: 使用 LLM 生成日报、周报的自然语言摘要

**当前状态**:
- ✅ `python_backend/app/reports/generator.py` 已实现报告生成
- ⚠️ 摘要是结构化数据拼接，缺少自然语言流畅性

**实施步骤**:

1. **设计报告摘要 Prompt** (3小时)
   ```python
   # app/llm/prompts.py
   
   DAILY_REPORT_PROMPT = """
   你是实验室管理 AI 助手。根据今日工作数据，生成简洁的日报摘要（3-5句话）。
   
   任务数据:
   - 新建任务: {new_tasks_count}
   - 完成任务: {completed_tasks_count}
   - 待处理任务: {open_tasks_count}
   
   审批数据:
   - 待审批: {pending_approvals_count}
   - 已批准: {approved_count}
   
   关键事件:
   {key_events}
   
   要求：
   - 突出今日工作重点
   - 标注需要关注的问题
   - 语气专业、简洁
   """
   
   WEEKLY_REPORT_PROMPT = """..."""
   ```

2. **实现报告摘要生成器** (4小时)
   ```python
   # app/reports/llm_summarizer.py
   
   class ReportSummarizer:
       async def summarize_daily_report(
           self,
           tasks: list[dict],
           approvals: list[dict],
           activity_logs: list[dict],
       ) -> str:
           """生成日报摘要"""
   
       async def summarize_weekly_report(
           self,
           tasks: list[dict],
           approvals: list[dict],
           activity_logs: list[dict],
       ) -> str:
           """生成周报摘要"""
   
       async def extract_highlights(
           self,
           data: dict,
       ) -> list[str]:
           """提取关键亮点"""
   ```

3. **集成到报告生成流程** (3小时)
   ```python
   # app/reports/generator.py
   
   async def generate_daily_report(self, date: datetime) -> Report:
       # 获取数据
       tasks = await self._get_tasks_for_date(date)
       approvals = await self._get_approvals_for_date(date)
       
       # 使用 LLM 生成摘要
       summarizer = ReportSummarizer()
       summary = await summarizer.summarize_daily_report(
           tasks=tasks,
           approvals=approvals,
           activity_logs=activity_logs,
       )
       
       highlights = await summarizer.extract_highlights({
           "tasks": tasks,
           "approvals": approvals,
       })
   ```

4. **添加缓存机制** (2小时)
   ```python
   # 避免重复生成相同报告
   # 使用 Redis 缓存 LLM 生成结果
   ```

5. **补充测试** (3小时)
   ```python
   # tests/test_report_summarizer.py
   
   async def test_daily_report_summary_quality():
       """测试日报摘要质量"""
   
   async def test_weekly_report_summary_quality():
       """测试周报摘要质量"""
   ```

**验收标准**:
- [ ] 日报摘要流畅、专业、信息完整
- [ ] 周报摘要突出趋势和关键问题
- [ ] 摘要生成时间 < 3秒
- [ ] 有缓存机制避免重复生成
- [ ] 降级策略可用

**依赖**: 任务 2.1

**预计工时**: 15小时

---

### 任务 2.3：添加复盘建议生成

**目标**: 基于任务执行历史，生成流程优化建议

**当前状态**:
- ❌ 未实现任何复盘能力

**实施步骤**:

1. **设计复盘数据模型** (2小时)
   ```python
   # app/retrospective/models.py
   
   class RetrospectiveInput:
       task_id: str
       task_type: str
       duration: timedelta
       status_transitions: list[dict]
       approval_history: list[dict]
       sla_violations: list[dict]
   
   class RetrospectiveSuggestion:
       category: str  # "process", "threshold", "assignment"
       priority: str  # "high", "medium", "low"
       suggestion: str
       evidence: list[str]
   ```

2. **实现复盘分析器** (5小时)
   ```python
   # app/retrospective/analyzer.py
   
   class RetrospectiveAnalyzer:
       async def analyze_task(
           self,
           task: dict,
           actions: list[dict],
       ) -> list[RetrospectiveSuggestion]:
           """分析单个任务，生成改进建议"""
       
       async def analyze_batch(
           self,
           tasks: list[dict],
           time_range: tuple[datetime, datetime],
       ) -> list[RetrospectiveSuggestion]:
           """批量分析任务，发现模式"""
   ```

3. **设计复盘 Prompt** (3小时)
   ```python
   # app/llm/prompts.py
   
   RETROSPECTIVE_PROMPT = """
   你是实验室管理流程优化专家。分析以下任务执行数据，提出改进建议。
   
   任务信息:
   - 类型: {task_type}
   - 耗时: {duration}
   - 状态变化: {transitions}
   - SLA 违规: {violations}
   
   请从以下角度分析：
   1. 流程效率：是否有不必要的等待或重复步骤
   2. 阈值设置：是否需要调整触发阈值
   3. 人员分配：是否需要调整默认指派规则
   
   输出格式：
   - 类别: [process/threshold/assignment]
   - 优先级: [high/medium/low]
   - 建议: [具体建议]
   - 证据: [支持证据]
   """
   ```

4. **集成到报告生成** (3小时)
   ```python
   # 在周报中包含复盘建议
   async def generate_weekly_report(self, week_start: datetime) -> Report:
       # ... 生成常规内容
       
       # 添加复盘建议
       analyzer = RetrospectiveAnalyzer()
       suggestions = await analyzer.analyze_batch(
           tasks=tasks,
           time_range=(week_start, week_end),
       )
       
       report.suggestions = suggestions
   ```

5. **补充测试** (2小时)
   ```python
   # tests/test_retrospective.py
   
   async def test_analyze_slow_task():
       """测试分析慢任务"""
   
   async def test_analyze_sla_violations():
       """测试分析 SLA 违规"""
   ```

**验收标准**:
- [ ] 可以识别常见问题模式（慢任务、频繁驳回、SLA 违规）
- [ ] 建议具体、可执行
- [ ] 建议有优先级排序
- [ ] 建议有证据支持

**依赖**: 任务 2.1, 2.2

**预计工时**: 15小时

---

## 实施时间表

### Sprint 1: 补齐 V1（2周）

**Week 1**:
- 任务 1.1: 验证 API 路由对接 (4h)
- 任务 1.2: 补充 Supervisor Graph 集成测试 (9h)
- 任务 1.3: 完善权限判断逻辑 (9h)
- **总计**: 22小时

**Week 2**:
- 完成剩余测试和文档
- 代码审查和优化
- **总计**: 18小时

**里程碑**: V1 完整可用，所有核心功能经过测试验证

---

### Sprint 2: 增强能力（3周）

**Week 3-4**:
- 任务 2.1: 接入 LLM 到 Recommendation Builder (16h)
- 任务 2.2: 实现报告自然语言摘要 (15h)
- **总计**: 31小时

**Week 5**:
- 任务 2.3: 添加复盘建议生成 (15h)
- 集成测试和优化
- **总计**: 20小时

**里程碑**: LLM 增强功能上线，智能化水平显著提升

---

## 风险与缓解

### 风险 1: LLM API 成本过高

**缓解措施**:
- 使用缓存减少重复调用
- 对非关键场景使用降级模板
- 设置每日调用上限

### 风险 2: LLM 响应时间不稳定

**缓解措施**:
- 设置超时时间（3秒）
- 超时后使用降级策略
- 异步生成非实时内容（如报告摘要）

### 风险 3: 权限模型与现有系统不兼容

**缓解措施**:
- 先实现独立的权限层
- 逐步与现有认证系统集成
- 保留兼容模式

### 风险 4: 测试覆盖不足导致回归

**缓解措施**:
- 每个任务都包含测试步骤
- 使用 CI/CD 自动运行测试
- 代码审查强制要求测试覆盖

---

## 成功标准

### V1 补齐成功标准

- [ ] `/api/ai/rules/execute` 端到端测试通过
- [ ] Supervisor Graph 测试覆盖率 > 85%
- [ ] 权限验证覆盖所有敏感操作
- [ ] 所有 P0 验收标准通过
- [ ] 文档更新完整

### LLM 增强成功标准

- [ ] LLM 生成的文本质量评分 > 4/5（人工评估）
- [ ] LLM 响应时间 P95 < 3秒
- [ ] LLM 失败率 < 1%
- [ ] 降级策略可用性 100%
- [ ] 用户满意度调查 > 80%

---

## 附录：技术选型

### LLM 提供商选择

| 提供商 | 优势 | 劣势 | 建议 |
|--------|------|------|------|
| Anthropic Claude | 与 AI 员工定位一致，上下文窗口大 | 成本较高 | **推荐** |
| OpenAI GPT-4 | 生态成熟，文档完善 | API 限流严格 | 备选 |
| 本地模型 | 成本可控，数据安全 | 需要 GPU 资源，维护成本高 | 长期考虑 |

### 缓存策略

- **Redis**: 用于 LLM 响应缓存（TTL: 1小时）
- **内存缓存**: 用于会话内重复请求（TTL: 5分钟）

### 监控指标

- LLM 调用次数、成功率、响应时间
- 降级策略触发次数
- 用户反馈评分
- 成本统计

---

## 总结

本实施计划分为两个阶段：

1. **阶段一（2周）**: 补齐 V1 核心功能，确保架构完整性和稳定性
2. **阶段二（3周）**: 接入 LLM 增强智能化能力

总预计工时：**106小时**（约 13 个工作日）

关键成功因素：
- 完整的测试覆盖
- 清晰的降级策略
- 持续的质量监控
- 及时的文档更新

