# 报告生成与 PDF 导出功能启用指南

> 最后更新：2026-05-01

## ✅ 功能状态

报告生成和 PDF 导出功能已启用并可用。

## 📋 可用的 API 端点

### 报告生成

#### 1. 生成日报
```bash
POST /api/reports/daily
Content-Type: application/json

{
  "date": "2026-05-01",
  "operator": "user@example.com"
}
```

**响应：**
```json
{
  "task_id": "abc123...",
  "status": "pending"
}
```

#### 2. 生成周报
```bash
POST /api/reports/weekly
Content-Type: application/json

{
  "start_date": "2026-04-24",
  "end_date": "2026-05-01",
  "operator": "user@example.com"
}
```

**响应：**
```json
{
  "task_id": "def456...",
  "status": "pending"
}
```

#### 3. 查询任务状态
```bash
GET /api/reports/tasks/{task_id}
```

**响应：**
```json
{
  "task_id": "abc123...",
  "status": "SUCCESS",
  "state": "SUCCESS",
  "ready": true,
  "successful": true,
  "result": {
    "date": "2026-05-01",
    "task_completions": 15,
    "approvals": 8,
    "metrics": {
      "activities": 42
    },
    "metadata": {
      "operator": "user@example.com",
      "timestamp": "2026-05-01T10:30:00",
      "run_id": "uuid-here"
    }
  }
}
```

### PDF 导出

#### 导出 PDF
```bash
POST /api/pdf/export
Content-Type: application/json

{
  "html_content": "<h1>报告标题</h1><p>内容...</p>",
  "metadata": {
    "title": "日报",
    "author": "LabManager",
    "subject": "Daily Report"
  }
}
```

或使用模板：
```json
{
  "template_name": "daily_report",
  "context": {
    "date": "2026-05-01",
    "data": {...}
  },
  "metadata": {
    "title": "日报"
  }
}
```

**响应：** PDF 文件（application/pdf）

## 🚀 启动步骤

### 1. 环境配置

确保 `.env` 文件包含以下配置：

```bash
# 数据库（必需）
LABMANAGER_PY_DATABASE_URL=postgresql://user:password@localhost:5432/labmanager

# Redis（必需 - 用于 Celery）
LABMANAGER_PY_REDIS_URL=redis://localhost:6379/0
LABMANAGER_PY_CELERY_BROKER_URL=redis://localhost:6379/1
LABMANAGER_PY_CELERY_RESULT_BACKEND=redis://localhost:6379/2

# PDF 字体路径（可选，Windows 默认使用 C:\Windows\Fonts）
LABMANAGER_PY_PDF_FONT_PATH=/path/to/fonts
```

### 2. 启动服务

#### 终端 1：启动 FastAPI 后端
```bash
cd python_backend
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac
uvicorn app.main:app --reload --port 8001
```

#### 终端 2：启动 Celery Worker（必需！）

**首次启动前，安装依赖：**
```bash
cd python_backend
pip install -e .
```

**启动 Celery Worker：**

**方法 1：使用启动脚本（推荐）**
```bash
# Windows
cd python_backend
start_celery.bat

# Linux/Mac
cd python_backend
python start_celery.py
```

**方法 2：手动启动（需要先设置环境变量）**
```bash
cd python_backend
.venv\Scripts\activate  # Windows

# Windows - 设置环境变量
set LABMANAGER_PY_CELERY_BROKER_URL=redis://localhost:6379/1
set LABMANAGER_PY_CELERY_RESULT_BACKEND=redis://localhost:6379/2
celery -A app.tasks.celery_app:celery_app worker --loglevel=info --pool=solo

# Linux/Mac - 使用 dotenv
export $(cat .env | xargs)
celery -A app.tasks.celery_app:celery_app worker --loglevel=info
```

> ⚠️ **重要**：报告生成是异步任务，必须启动 Celery Worker 才能处理任务。

### 3. 验证服务

```bash
# 检查 API 端点是否注册
curl http://localhost:8001/docs

# 生成测试日报
curl -X POST http://localhost:8001/api/reports/daily \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-05-01", "operator": "test@example.com"}'

# 查询任务状态（使用上面返回的 task_id）
curl http://localhost:8001/api/reports/tasks/{task_id}
```

## 🔍 故障排查

### 问题 1：Celery 尝试连接 RabbitMQ (amqp://guest@127.0.0.1:5672)

**错误信息**：
```
consumer: Cannot connect to amqp://guest:**@127.0.0.1:5672//
```

**原因**：环境变量未加载，Celery 使用了默认的 RabbitMQ broker

**解决方案**：

1. **使用启动脚本（推荐）**：
   ```bash
   # Windows
   cd python_backend
   start_celery.bat
   
   # Linux/Mac
   python start_celery.py
   ```

2. **手动设置环境变量**：
   ```bash
   # Windows CMD
   set LABMANAGER_PY_CELERY_BROKER_URL=redis://localhost:6379/1
   set LABMANAGER_PY_CELERY_RESULT_BACKEND=redis://localhost:6379/2
   celery -A app.tasks.celery_app:celery_app worker --loglevel=info --pool=solo
   
   # Windows PowerShell
   $env:LABMANAGER_PY_CELERY_BROKER_URL="redis://localhost:6379/1"
   $env:LABMANAGER_PY_CELERY_RESULT_BACKEND="redis://localhost:6379/2"
   celery -A app.tasks.celery_app:celery_app worker --loglevel=info --pool=solo
   ```

3. **验证配置已加载**：
   ```bash
   python -c "from app.core.config import get_settings; s = get_settings(); print(f'Broker: {s.celery_broker_url}')"
   # 应输出：Broker: redis://localhost:6379/1
   ```

### 问题 2：任务一直处于 PENDING 状态

**原因**：Celery Worker 未启动

**解决**：
```bash
# 检查 Celery Worker 是否运行
# 应该看到类似输出：
# [tasks]
#   . app.reports.tasks.generate_daily_report_async
#   . app.reports.tasks.generate_weekly_report_async
```

### 问题 2：Redis 连接失败

**原因**：Redis 服务未启动或配置错误

**解决**：
```bash
# 检查 Redis 是否运行
redis-cli ping
# 应返回：PONG

# 检查环境变量
echo $LABMANAGER_PY_CELERY_BROKER_URL
```

### 问题 3：PDF 导出中文乱码

**原因**：缺少中文字体

**解决**：
- Windows：系统会自动使用 `C:\Windows\Fonts` 中的字体
- Linux：安装中文字体包
  ```bash
  sudo apt-get install fonts-noto-cjk
  ```
- 或手动指定字体路径：
  ```bash
  LABMANAGER_PY_PDF_FONT_PATH=/usr/share/fonts/truetype
  ```

### 问题 4：数据库查询失败

**原因**：数据库 schema 未初始化

**解决**：
```bash
cd python_backend
python -m app.db.manage apply
python -m app.db.manage verify
```

## 📊 报告数据来源

报告生成依赖以下数据库表：
- `ai_tasks` - 任务完成数据
- `approvals` - 审批记录
- `activity_logs` - 活动日志

确保这些表已创建并包含数据。

## 🔗 相关文档

- [用户测试指南](../docs/user-testing-and-demo-guide.md)
- [项目迁移守则](../CLAUDE.md)
- [API 文档](http://localhost:8001/docs)（启动后端后访问）

## 📝 技术实现

- **报告生成器**：`app/reports/generator.py`
- **异步任务**：`app/reports/tasks.py`
- **API 端点**：`app/api/reports/endpoints.py`
- **PDF 导出**：`app/pdf/exporter.py`
- **路由注册**：`app/api/router.py`
