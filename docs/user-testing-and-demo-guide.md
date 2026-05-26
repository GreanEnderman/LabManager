# LabManager 用户测试与演示指南

> 最后更新：2026-05-01  
> 基于当前实现状态：Python 后端 + React 前端

## 📋 当前可用功能总结

### ✅ 已实现并可测试的功能

#### 1. **Python 后端核心能力**（端口 8001）

**基础设施：**
- ✅ FastAPI 服务骨架
- ✅ PostgreSQL 连接与 schema 管理
- ✅ Redis 连接
- ✅ Celery 异步任务队列
- ✅ 健康检查（/health/live, /health/ready）
- ✅ 审计中间件

**业务能力：**
- ✅ **规则引擎**（`/rules/process`）
  - 三类事件识别：低库存、超期维护、异常设备
  - 事件分类与判重
  - TS/Python 协议适配
  
- ✅ **数据导入**（`/import/*`）
  - 手动录入（`/import/manual`）
  - 批量导入（`/import/batch`）
  - 批次历史查询（`/import/batches`）
  - 批次详情（`/import/batches/{batch_id}`）
  
- ✅ **邮件投递**（`/api/email/*`）
  - 手动发送（`/api/email/send`）
  - 任务状态查询（`/api/email/status/{task_id}`）
  - 发送历史查询（`/api/email/history`）
  - 失败重试（`/api/email/retry/{record_id}`）
  
- ✅ **报告生成**（`/api/reports/*`）
  - 报告生成接口
  - PDF 导出接口（`/api/pdf/*`）

**数据库 Schema：**
- ✅ 正式持久化模型（ai_tasks, ai_task_actions, approvals 等）
- ✅ 数据库迁移机制（`python -m app.db.manage`）
- ✅ Schema 验证工具

#### 2. **前端页面**（端口 3000）

**核心页面：**
- ✅ Dashboard：数据概览
- ✅ AlertCenter：预警中心
- ✅ AIWorkbench：AI 工作台
- ✅ AITaskCenter：任务中心
- ✅ AIApprovals：审批台
- ✅ AIReports：报告中心
- ✅ DataImportCenter：数据导入中心
- ✅ SystemSettingsRuntime：运行时配置
- ✅ ReportDeliverySettings：报告投递设置

**业务页面：**
- ✅ ChemicalInventory：化学品管理
- ✅ EquipmentManagement：设备管理
- ✅ MaintenanceRecords：维护记录
- ✅ InboundOutbound：出入库记录

#### 3. **已验证的流程**

根据 `project-sync-status.md`，以下流程已通过验证：
- ✅ 规则巡检 → 事件生成 → 任务判重
- ✅ 审批门控机制
- ✅ 故障处理路径
- ✅ SLA 提醒与升级
- ✅ 任务跟踪 Agent 执行
- ✅ 报告生成 Agent 执行
- ✅ 导入结果与历史追溯
- ✅ 最小报告投递成功/失败路径

---

## 🔧 环境准备

### 1. 必需服务

```bash
# PostgreSQL（必需）
# Redis（必需）
# SMTP 服务器（可选，开发环境可用文件模拟）
```

### 2. Python 后端配置

创建 `python_backend/.env` 文件：

```bash
# 数据库配置（必需）
LABMANAGER_PY_DATABASE_URL=postgresql://user:password@localhost:5432/labmanager

# Redis 配置（必需）
LABMANAGER_PY_REDIS_URL=redis://localhost:6379/0

# Celery 配置（必需）
LABMANAGER_PY_CELERY_BROKER_URL=redis://localhost:6379/1
LABMANAGER_PY_CELERY_RESULT_BACKEND=redis://localhost:6379/2

# LLM 配置（生产必需，开发可选）
LABMANAGER_PY_LLM_API_KEY=your_api_key
LABMANAGER_PY_LLM_ENDPOINT=https://api.example.com/v1
LABMANAGER_PY_LLM_MODEL=gpt-4

# SMTP 配置（生产必需，开发可选）
LABMANAGER_PY_SMTP_HOST=smtp.example.com
LABMANAGER_PY_SMTP_PORT=587
LABMANAGER_PY_SMTP_USER=your_email@example.com
LABMANAGER_PY_SMTP_PASSWORD=your_password
LABMANAGER_PY_SMTP_FROM=noreply@example.com

# PDF 字体路径（可选）
LABMANAGER_PY_PDF_FONT_PATH=/path/to/fonts

# 环境标识
LABMANAGER_PY_APP_ENV=development

# Schema 检查（可选）
LABMANAGER_PY_SCHEMA_CHECK_ON_READINESS=false
```

### 3. 启动服务

```bash
# 1. 初始化数据库
cd python_backend
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac
pip install -e .[dev]
python -m app.db.manage apply
python -m app.db.manage verify

# 2. 启动 Python 后端
uvicorn app.main:app --reload --port 8001

# 3. 启动 Celery Worker（新终端）
celery -A app.tasks.celery_app:celery_app worker --loglevel=info

# 4. 启动前端（新终端）
cd frontend
npm install
npm run dev
```

### 4. 验证服务状态

```bash
# 检查 Python 后端健康状态
curl http://localhost:8001/health/live
curl http://localhost:8001/health/ready

# 检查前端
# 访问 http://localhost:3000
```

---

## 🧪 用户级别测试流程

### 测试流程 1：规则引擎与事件处理（10分钟）

**目标**：验证规则引擎能正确识别三类事件并进行判重

#### 步骤 1：准备测试数据
```bash
# 准备低库存事件数据
cat > low_stock_event.json << EOF
{
  "event_type": "low_stock",
  "item_id": "CHEM001",
  "item_name": "盐酸",
  "current_stock": 5,
  "threshold": 10,
  "unit": "瓶",
  "timestamp": "2026-05-01T10:00:00Z"
}
EOF
```

#### 步骤 2：调用规则引擎 API
```bash
curl -X POST http://localhost:8001/rules/process \
  -H "Content-Type: application/json" \
  -d @low_stock_event.json
```

#### 步骤 3：验证响应
- ✅ 返回 200 状态码
- ✅ 响应包含事件分类结果
- ✅ 响应包含建议动作
- ✅ 响应包含优先级判断

#### 步骤 4：测试判重机制
```bash
# 再次发送相同事件
curl -X POST http://localhost:8001/rules/process \
  -H "Content-Type: application/json" \
  -d @low_stock_event.json
```

- ✅ 验证系统识别为重复事件
- ✅ 验证不会创建重复任务

---

### 测试流程 2：数据导入（15分钟）

**目标**：验证手动录入和批量导入功能

#### 步骤 1：手动录入单条数据
```bash
curl -X POST http://localhost:8001/import/manual \
  -H "Content-Type: application/json" \
  -d '{
    "item_type": "chemical",
    "name": "硫酸",
    "cas_number": "7664-93-9",
    "quantity": 100,
    "unit": "ml",
    "location": "A-01-03",
    "operator": "张三"
  }'
```

#### 步骤 2：验证导入结果
- ✅ 返回 record_id 和 batch_id
- ✅ 状态为 "success"

#### 步骤 3：查询批次历史
```bash
curl http://localhost:8001/import/batches?page=1&page_size=20
```

- ✅ 返回批次列表
- ✅ 包含刚才的导入记录

#### 步骤 4：前端导入测试
1. 访问 `/data-import`
2. 选择导入类型（化学品/设备）
3. 填写表单或上传文件
4. 提交导入
5. 查看导入结果和历史记录

---

### 测试流程 3：邮件投递与异步任务（15分钟）

**目标**：验证邮件发送、任务队列、状态查询、失败重试

#### 步骤 1：发送测试邮件
```bash
curl -X POST http://localhost:8001/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "测试报告",
    "body": "这是一封测试邮件",
    "report_id": 1,
    "operator_id": 1
  }'
```

#### 步骤 2：记录返回的 task_id
```json
{
  "task_id": "abc-123-def",
  "record_id": 1,
  "status": "queued"
}
```

#### 步骤 3：查询任务状态
```bash
curl http://localhost:8001/api/email/status/abc-123-def
```

- ✅ 返回任务状态（PENDING/SUCCESS/FAILURE）
- ✅ 成功时返回结果

#### 步骤 4：查询发送历史
```bash
curl -X POST http://localhost:8001/api/email/history \
  -H "Content-Type: application/json" \
  -d '{
    "report_id": 1,
    "start_date": "2026-05-01T00:00:00Z",
    "end_date": "2026-05-01T23:59:59Z"
  }'
```

- ✅ 返回发送记录列表
- ✅ 包含收件人、状态、时间等信息

#### 步骤 5：测试失败重试
```bash
# 假设 record_id=1 发送失败
curl -X POST http://localhost:8001/api/email/retry/1
```

- ✅ 创建新的重试任务
- ✅ 返回新的 task_id 和 record_id

---

### 测试流程 4：前端完整业务流程（20分钟）

**目标**：验证前端与后端的完整集成

#### 场景 1：从预警到任务（Dashboard → AlertCenter → AITaskCenter）

1. **查看 Dashboard**
   - 访问 `/dashboard`
   - 验证数据概览卡片显示正常
   - 验证低库存列表显示

2. **进入预警中心**
   - 点击"预警中心"或访问 `/alerts`
   - 验证三类预警展示：低库存、超期维护、异常设备
   - 点击某个预警项查看详情

3. **创建任务**
   - 在预警详情中点击"创建任务"
   - 验证表单自动填充标题和描述
   - 选择负责人、优先级、截止时间
   - 提交任务

4. **任务中心处理**
   - 访问 `/ai/workbench` 或 `/ai/tasks`
   - 在任务列表中找到刚创建的任务
   - 更新任务状态：待处理 → 进行中 → 已完成
   - 填写处理结果
   - 查看活动日志

#### 场景 2：数据导入流程（DataImportCenter）

1. **访问导入中心**
   - 访问 `/data-import`
   - 选择导入类型

2. **执行导入**
   - 手动录入或上传文件
   - 查看校验结果
   - 确认导入

3. **验证结果**
   - 查看导入成功数量
   - 查看错误清单（如有）
   - 在对应业务页面验证数据

#### 场景 3：报告生成与投递（AIReports → ReportDeliverySettings）

1. **生成报告**
   - 访问 `/ai/reports`
   - 选择报告类型（日报/周报）
   - 选择时间范围
   - 点击"生成报告"

2. **查看报告**
   - 在报告列表中找到生成的报告
   - 点击查看详情
   - 验证报告内容完整

3. **发送报告**
   - 点击"发送报告"
   - 选择收件人
   - 确认发送

4. **查看投递记录**
   - 访问 `/report-delivery-settings`
   - 查看投递历史
   - 验证发送状态

---

## 🎬 演示视频录制流程（25分钟完整演示）

### 演示主题：AI 驱动的实验室智能管理系统

---

### 第一幕：系统架构介绍（3分钟）

**画面 1：架构图展示**
- 展示系统架构图（前端 + Python 后端 + 数据库 + 消息队列）
- 旁白："LabManager 采用现代化微服务架构，前端使用 React，后端使用 Python FastAPI，支持异步任务处理和实时数据更新"

**画面 2：技术栈亮点**
- 展示技术栈列表
- 旁白："系统集成了 PostgreSQL 正式持久化、Redis 缓存、Celery 异步任务队列、LangGraph AI 编排等生产级组件"

---

### 第二幕：智能规则引擎（4分钟）

**画面 3：规则引擎演示**
- 打开 API 文档 `/docs`
- 展示 `/rules/process` 接口
- 旁白："系统的核心是智能规则引擎，能自动识别三类实验室风险"

**画面 4：实时事件处理**
- 使用 Postman 或 curl 发送低库存事件
- 展示返回结果：事件分类、优先级、建议动作
- 旁白："规则引擎实时分析事件，自动判断优先级并给出处理建议"

**画面 5：判重机制**
- 再次发送相同事件
- 展示系统识别为重复事件
- 旁白："智能判重机制避免重复处理，提高管理效率"

---

### 第三幕：数据导入与管理（5分钟）

**画面 6：导入中心界面**
- 访问 `/data-import`
- 展示导入界面设计
- 旁白："系统支持手动录入和批量导入两种方式"

**画面 7：手动录入演示**
- 填写化学品信息表单
- 提交数据
- 展示成功提示
- 旁白："手动录入适合少量数据的快速添加"

**画面 8：批量导入演示**
- 上传 Excel 文件
- 展示校验过程
- 展示导入结果（成功数、失败数、错误清单）
- 旁白："批量导入支持完整的数据校验，确保数据质量"

**画面 9：导入历史追溯**
- 查看批次历史列表
- 点击某个批次查看详情
- 展示操作者、时间、结果等信息
- 旁白："完整的导入历史记录，支持审计追溯"

---

### 第四幕：异步任务与邮件投递（5分钟）

**画面 10：邮件发送 API**
- 展示 `/api/email/send` 接口文档
- 旁白："系统采用异步任务队列处理邮件发送，不阻塞主流程"

**画面 11：发送测试邮件**
- 使用 API 发送测试邮件
- 展示返回的 task_id
- 旁白："邮件发送立即返回任务 ID，后台异步处理"

**画面 12：任务状态查询**
- 查询任务状态
- 展示状态变化：PENDING → SUCCESS
- 旁白："实时查询任务状态，掌握处理进度"

**画面 13：发送历史与重试**
- 查询发送历史
- 展示失败记录
- 演示失败重试功能
- 旁白："完善的失败处理机制，支持一键重试"

---

### 第五幕：前端业务流程（6分钟）

**画面 14：Dashboard 概览**
- 展示首页数据统计
- 展示低库存预警列表
- 旁白："Dashboard 提供全局视图，关键指标一目了然"

**画面 15：预警中心**
- 访问预警中心
- 展示三类预警分类展示
- 点击预警查看详情
- 旁白："预警中心集中展示所有需要关注的问题"

**画面 16：创建任务**
- 从预警创建任务
- 展示表单自动填充
- 分配负责人和设置优先级
- 提交任务
- 旁白："一键将预警转化为可执行任务"

**画面 17：任务处理**
- 访问任务中心
- 展示任务列表（待处理、进行中、已完成）
- 更新任务状态
- 填写处理结果
- 查看活动日志
- 旁白："任务全生命周期管理，每个操作都有记录"

---

### 第六幕：报告生成与投递（2分钟）

**画面 18：报告中心**
- 访问报告中心
- 选择生成周报
- 展示生成过程
- 旁白："系统自动汇总数据，生成管理报告"

**画面 19：报告查看与发送**
- 查看报告详情
- 点击发送报告
- 选择收件人
- 确认发送
- 展示投递记录
- 旁白："报告可自动发送给相关主管，支持投递追踪"

---

### 第七幕：系统特性总结（2分钟）

**画面 20：核心特性回顾**
- 展示特性列表：
  - ✅ 智能规则引擎
  - ✅ 异步任务处理
  - ✅ 完整审计追溯
  - ✅ 灵活数据导入
  - ✅ 自动报告生成
  - ✅ 邮件投递管理
- 旁白："LabManager 通过 AI 和自动化技术，将实验室管理从被动响应升级为主动巡检"

**画面 21：技术优势**
- 展示技术优势：
  - 🚀 现代化微服务架构
  - 🔒 生产级安全设计
  - 📊 完整数据追溯
  - ⚡ 高性能异步处理
  - 🎯 智能规则引擎
- 旁白："系统采用生产级技术栈，确保稳定性和可扩展性"

---

## 📝 演示准备清单

### 数据准备
- [ ] 准备 PostgreSQL 数据库并初始化 schema
- [ ] 准备 Redis 服务
- [ ] 准备测试用化学品数据（10+ 条，包含低库存项）
- [ ] 准备测试用设备数据（5+ 台，包含超期维护项）
- [ ] 准备导入用 Excel 文件
- [ ] 配置测试邮箱（或使用文件模拟）

### 环境配置
- [ ] 配置 Python 后端环境变量
- [ ] 启动 Python 后端服务（端口 8001）
- [ ] 启动 Celery Worker
- [ ] 启动前端服务（端口 3000）
- [ ] 验证所有服务健康状态
- [ ] 清理测试数据，保持界面整洁

### API 测试工具
- [ ] 安装 Postman 或使用 curl
- [ ] 准备测试用 JSON 文件
- [ ] 测试所有 API 端点正常工作

### 录制工具
- [ ] 屏幕录制软件（OBS Studio / Camtasia）
- [ ] 麦克风（录制旁白）
- [ ] 视频编辑软件（剪辑、添加字幕）
- [ ] 准备演示脚本和时间控制

---

## 🎯 演示重点提示

### 技术亮点
1. **现代化架构**：Python FastAPI + React + PostgreSQL + Redis + Celery
2. **异步处理**：邮件发送、报告生成等重型任务异步处理
3. **完整追溯**：所有操作都有审计记录
4. **智能规则**：自动识别风险、判重、优先级判断
5. **生产就绪**：正式持久化模型、数据库迁移、健康检查

### 业务价值
1. **自动化**：从人工巡检到系统自动发现问题
2. **闭环管理**：从问题发现到任务关闭的完整流程
3. **可追溯**：完整的操作历史和审计日志
4. **高效率**：异步处理、批量导入、自动报告

### 对比传统方式
- ❌ 传统：人工巡检 → 手工记录 → 邮件通知 → 人工跟进
- ✅ LabManager：自动巡检 → 智能分类 → 任务分派 → 自动催办 → 报告汇总

---

## ⚠️ 注意事项

### 当前限制
1. **TS 后端已冻结**：不再承接新的重型生产能力
2. **Python 后端为主**：新功能优先在 Python 后端实现
3. **迁移进行中**：部分功能可能同时存在 TS 和 Python 两个版本

### 测试建议
1. **优先测试 Python 后端 API**：这是未来的主要方向
2. **验证前后端集成**：确保前端能正确调用 Python 后端
3. **关注异步任务**：确保 Celery Worker 正常运行
4. **检查数据一致性**：验证数据库记录与前端展示一致

### 演示建议
1. **突出技术栈**：强调 Python + FastAPI 的现代化架构
2. **展示异步能力**：演示邮件发送、报告生成等异步任务
3. **体现生产就绪**：展示数据库迁移、健康检查等生产级特性
4. **对比传统方式**：突出自动化和智能化的优势

---

## 📚 相关文档

- [Python 后端 README](../python_backend/README.md)
- [数据库迁移指南](../python_backend/docs/database-migrations.md)
- [部署指南](./deployment-guide.md)
- [项目同步状态](./project-sync-status.md)
- [技术栈迁移路线图](./stack-migration-roadmap.md)

---

## 🔄 更新记录

- 2026-05-01：基于 Python 后端实现状态创建文档
- 重点：规则引擎、数据导入、邮件投递、异步任务
- 状态：Python 后端已实现核心能力，前端集成进行中
