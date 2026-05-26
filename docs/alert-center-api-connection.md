# 预警中心 API 连接完成

## 修改内容

### 1. 创建了 Alerts API 客户端
**文件**: `frontend/src/api/alerts.ts`

提供两个核心 API：
- `inspectRules()` - 检测预警事件
- `executeRule()` - 执行预警并创建任务（带 LLM 推荐）

### 2. 创建了实时预警中心页面
**文件**: `frontend/src/pages/AlertCenterLive.tsx`

功能：
- ✅ 从 Python 后端实时加载预警数据
- ✅ 显示低库存、维护超期、设备故障三类预警
- ✅ 支持一键创建任务（调用 LangGraph + LLM）
- ✅ 加载状态和错误处理
- ✅ 刷新按钮

### 3. 更新了路由配置
**文件**: `frontend/src/App.tsx`

将 `/alerts` 路由从静态数据版本切换到实时 API 版本。

## 功能特性

### 预警检测
- 自动检测所有化学品和设备
- 基于配置的阈值判断
- 实时计算维护超期天数

### 智能任务创建
当点击"生成任务"按钮时：
1. 调用 Python 后端 `/api/ai/rules/execute`
2. 触发 LangGraph 完整流程（11 个节点）
3. **LLM 生成智能推荐**：
   - 原因分析
   - 风险评估
   - 行动建议
4. 自动创建任务
5. 记录活动日志
6. 支持审批流程（高风险事件）

### 用户体验
- 加载状态显示
- 错误提示和重试
- 刷新按钮
- 统计卡片
- 分类展示

## 使用方法

### 1. 启动后端服务

确保 Python 后端正在运行：
```bash
cd python_backend
python -m uvicorn app.main:app --reload --port 8001
```

### 2. 配置环境变量

确保前端配置了正确的 API 地址：
```env
VITE_PYTHON_API_BASE_URL=http://localhost:8001
```

### 3. 访问预警中心

打开浏览器访问：
```
http://localhost:5173/alerts
```

## API 调用示例

### 检测预警
```typescript
const response = await alertsApi.inspectRules({
  input: {
    chemicals: [
      { id: 'chem-001', name: 'NaCl', totalQuantity: 3, threshold: 10 }
    ],
    equipment: [
      { id: 'equip-001', name: 'Centrifuge', status: '正常', lastMaintenanceAt: '2026-03-01' }
    ]
  },
  config: {
    now: '2026-05-07T10:00:00Z',
    maintenanceOverdueDays: 30
  }
})
```

### 创建任务
```typescript
const response = await alertsApi.executeRule({
  event: alertEvent,
  actor: {
    id: 'user-001',
    name: 'Lab Manager',
    type: 'user'
  },
  runId: 'run-123456'
})
```

## 后端配置

确保以下配置已启用：

**文件**: `python_backend/.env`
```env
# ✅ LangGraph 已启用
LABMANAGER_PY_LANGGRAPH_ENABLED=true

# ✅ LLM 已配置
LABMANAGER_PY_LLM_API_KEY=sk-xxx...
LABMANAGER_PY_LLM_ENDPOINT=https://yunwu.ai/v1
LABMANAGER_PY_LLM_MODEL=gpt-5.4-mini

# ✅ 数据库已配置
LABMANAGER_PY_DATABASE_URL=postgresql://postgres:labpwd@localhost:5432/labmanager
```

## 测试结果

### LangGraph 测试
- ✅ 所有 11 个节点正常执行
- ✅ 任务创建成功
- ✅ 活动日志记录完整

### LLM 测试
- ✅ API 调用成功
- ✅ 生成智能推荐
- ✅ 返回详细的原因、风险评估和行动建议

### 示例输出
```
LLM Generated Recommendation:
--------------------------------------------------
Reason:
  Sodium Chloride inventory is at 3 bottles, which is well below 
  the safety threshold of 10 bottles. This low stock level may 
  interrupt routine laboratory workflows.

Risk Summary:
  With stock below minimum, there is a moderate risk of supply 
  disruption and delayed testing activities.

Action Summary:
  1. Initiate an immediate reorder for Sodium Chloride
  2. Verify current usage rate and estimate required quantity
  3. Check for any reserved or incoming stock
```

## 下一步

### 可选改进
1. 添加预警历史记录
2. 支持预警规则配置
3. 添加预警通知（邮件/推送）
4. 支持批量处理预警
5. 添加预警趋势分析

### 数据持久化
当前使用内存工具进行测试。如需持久化：
1. 确保 PostgreSQL 数据库运行
2. 运行数据库迁移
3. 后端会自动使用数据库工具

## 故障排查

### 前端无法连接后端
- 检查 `VITE_PYTHON_API_BASE_URL` 配置
- 确认后端服务运行在 8001 端口
- 检查浏览器控制台的网络请求

### LLM 不工作
- 检查 `.env` 中 `LABMANAGER_PY_LANGGRAPH_ENABLED=true`
- 检查 LLM API 密钥是否有效
- 查看后端日志中的 LLM 调用信息

### 任务创建失败
- 检查用户权限（需要 `tasks:write`）
- 查看浏览器控制台错误信息
- 检查后端日志

## 总结

✅ **预警中心已完全连接到 Python 后端**
✅ **LangGraph 和 LLM 功能正常工作**
✅ **支持实时预警检测和智能任务创建**

现在预警中心是一个完全功能的 AI 驱动系统，能够：
- 实时检测预警
- 使用 LLM 生成智能推荐
- 自动创建任务
- 支持审批流程
- 记录完整审计日志
