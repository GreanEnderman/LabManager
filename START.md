npm run dev

docker run -d --name labmanager-redis -p 6379:6379 redis:7-alpine

celery -A app.tasks.celery_app:celery_app worker --loglevel=info --pool=solo

celery -A app.tasks.celery_app:celery_app beat --loglevel=info

cd python_backend
uvicorn app.main:app --reload --port 8001