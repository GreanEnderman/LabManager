# LabManager Python Backend Deployment Runbook

This runbook deploys the React frontend and `python_backend/` FastAPI service to one server with Docker Compose.

## Prerequisites

- Linux server with Docker Engine and Docker Compose plugin.
- A domain name pointing to the server.
- TLS handled by a host-level proxy, load balancer, or a future 443 server block.
- PostgreSQL and Redis either from Compose or managed services.

## First-Time Setup

1. Build the frontend locally or in CI.

   ```bash
   cd frontend
   npm ci
   npm run lint
   npm run build
   ```

2. Prepare server env.

   ```bash
   cp deploy/env.production.example deploy/env.production
   ```

   Fill real values in `deploy/env.production`. Do not commit this file.
   Keep the formal workflow routing flags enabled in production so the frontend
   task list reads the same persisted task data that `rules.scan_and_execute` writes:

   ```env
   LABMANAGER_PY_PY_BACKEND_RULES_ENABLED=true
   LABMANAGER_PY_PY_BACKEND_TASKS_ENABLED=true
   LABMANAGER_PY_PY_BACKEND_APPROVALS_ENABLED=true
   ```

3. Start PostgreSQL and Redis first when using Compose-local dependencies.

   ```bash
   cd deploy
   docker compose -f docker-compose.prod.yml up -d postgres redis
   ```

4. Apply and verify database migrations.

   ```bash
   docker compose -f docker-compose.prod.yml run --rm api python -m app.db.manage status
   docker compose -f docker-compose.prod.yml run --rm api python -m app.db.manage apply
   docker compose -f docker-compose.prod.yml run --rm api python -m app.db.manage verify
   ```

5. Start the application stack.

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   curl http://localhost:8004/api/ai/routing/validate
   ```

   Confirm `rules`, `tasks`, and `approvals` resolve to `python` instead of
   `compat_fallback` before verifying the AI workbench.

## Health Checks

Run from the server:

```bash
curl -f http://localhost/health/live
curl -f http://localhost/health/ready
curl -f http://localhost/api/ai/health
```

Expected result:

- `/health/live` returns `200`.
- `/health/ready` returns `200` after PostgreSQL, Redis, and schema checks pass.
- `/api/ai/health` returns a healthy compatibility response.

## Smoke Test

- Open the frontend domain.
- Confirm browser network requests use `/api/ai`, not `localhost`.
- Inspect or generate a rule event.
- Create or update a task.
- Process an approval.
- Generate a report and export PDF.
- Confirm activity/audit logs record the action path.

## Release Update

```bash
cd frontend
npm ci
npm run lint
npm run build

cd ../deploy
docker compose -f docker-compose.prod.yml build api worker beat
docker compose -f docker-compose.prod.yml run --rm api python -m app.db.manage apply
docker compose -f docker-compose.prod.yml run --rm api python -m app.db.manage verify
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

## Rollback

For application rollback, redeploy the previous backend image tag and previous frontend `dist/` artifact.

For database changes after production cutover, prefer forward repair migrations. Do not use rollback to drop formal workflow tables after they contain authoritative production data.

## Backup

For Compose-local PostgreSQL:

```bash
cd deploy
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U labmanager -d labmanager > labmanager-$(date +%Y%m%d-%H%M%S).sql
```

Store backups outside the server or in managed object storage. Run a restore drill before real operational use.

## Operations Notes

- Run exactly one `beat` service instance.
- Keep real `.env` files out of git.
- Prefer managed PostgreSQL before storing important lab operational data.
- Same-origin routing through Nginx is the production default; add configurable CORS only if frontend and API must use different origins.

