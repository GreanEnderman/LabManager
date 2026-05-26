# QUICKSTART

## 首次安装

### 前端

```bash
cd frontend
npm install
```

### Python 后端

Windows PowerShell:

```powershell
cd python_backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
```

如果 PowerShell 阻止激活脚本，可以临时改用：

```powershell
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

## 启动 Redis

```bash
docker run -d --name labmanager-redis -p 6379:6379 redis:7-alpine
```

如果容器已经存在，使用：

```bash
docker start labmanager-redis
```

## 启动 Celery Worker

Windows PowerShell:

```powershell
cd python_backend
.\.venv\Scripts\python.exe -m celery -A app.tasks.celery_app:celery_app worker --loglevel=info --pool=solo
```

## 启动 Celery Beat

Windows PowerShell:

```powershell
cd python_backend
.\.venv\Scripts\python.exe -m celery -A app.tasks.celery_app:celery_app beat --loglevel=info
```

## 启动后端

Windows PowerShell:

```powershell
cd python_backend
uvicorn app.main:app --reload --port 8001
```

## 启动前端

```bash
cd frontend
npm run dev
```

## 地址

- 前端：http://localhost:3000
- 后端：http://localhost:8001
- API 文档：http://localhost:8001/docs

## 验证自动生成任务

1. 打开工作流监控页：

```text
http://localhost:3000/workflow-monitor
```

2. 在 `rules.scan_and_execute` 这一行点击“立即执行”。

3. 页面会显示最近一次扫描结果：

- `events_found`：规则扫描命中的事件数
- `tasks_created`：本次创建的任务数
- `task_ids`：创建出的任务 ID

4. 点击“查看任务列表”，或直接打开：

```text
http://localhost:3000/ai-workbench?tab=tasks
```

也可以直接用 API 验证：

```bash
curl -X POST http://127.0.0.1:8001/api/workflow/tasks/rules.scan_and_execute/trigger
curl http://127.0.0.1:8001/api/ai/tasks
```

如果 `tasks_created` 为 `0`，优先检查数据库里是否存在低库存化学品、故障设备或维护超期设备。
