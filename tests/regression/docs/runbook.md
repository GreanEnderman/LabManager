# Local Regression Testing Runbook

## Prerequisites

1. Install dependencies:
```bash
pip install -r tests/regression/requirements.txt
```

2. Start both backends:
```bash
# Terminal 1: TS backend
cd backend
npm install
npm start

# Terminal 2: Python backend
cd python_backend
pip install -r requirements.txt
python main.py
```

3. Seed test database:
```bash
python -m tests.regression.db_seeder seed
```

## Running Tests

### Run all regression tests
```bash
pytest tests/regression/ -v
```

### Run specific endpoint
```bash
pytest tests/regression/test_tasks.py -v
```

### Run with coverage
```bash
pytest tests/regression/ --cov=tests.regression --cov-report=html
```

## Reviewing Results

### Check for new differences
```bash
ls tests/regression/diffs/
```

### View specific diff
```bash
python -m tests.regression.adjudication.cli show <diff-id>
```

### Adjudicate difference
```bash
python -m tests.regression.adjudication.cli adjudicate <diff-id> \
  --category acceptable \
  --justification "Reason for difference" \
  --reviewer-name "Your Name" \
  --reviewer-email "you@example.com"
```

## Troubleshooting

### Tests fail with connection errors
- Verify both backends are running
- Check ports: TS on 3000, Python on 8000

### Database seed fails
- Reset database: `python -m tests.regression.db_cleaner reset-all`
- Re-run seed: `python -m tests.regression.db_seeder seed`

### Allowlist not working
- Verify pattern syntax in `tests/regression/allowlist.json`
- Check logs for pattern matching details

## Cleanup

```bash
# Clean diff logs
rm tests/regression/diffs/*.json

# Reset adjudications
rm tests/regression/adjudication/data/*.json

# Reset database
python -m tests.regression.db_cleaner reset-all
```
