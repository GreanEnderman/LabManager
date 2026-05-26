# Frontend Live Integration Acceptance Checklist

## Test Scenarios

### 1. Unauthenticated Access
- [ ] Open frontend without login credentials
- [ ] Verify HTTP requests to `/api/ai` return 401
- [ ] Verify UI shows authentication failure (not silent fallback to mock)
- [ ] Verify no AI workflows, settings, or import data loads

### 2. Authentication Failure
- [ ] Configure invalid `VITE_AI_HTTP_USERNAME` / `VITE_AI_HTTP_PASSWORD`
- [ ] Verify bootstrap login fails with visible error
- [ ] Verify auth invalidation is marked in session
- [ ] Verify subsequent requests do not retry with invalid credentials

### 3. Authorization Failure
- [ ] Login with user lacking required capabilities
- [ ] Attempt protected operations (e.g., task assignment, approval processing)
- [ ] Verify HTTP 403 responses are surfaced in UI
- [ ] Verify no silent fallback to mock success state

### 4. Backend Unreachable
- [ ] Stop backend server or misconfigure `VITE_AI_API_BASE_URL`
- [ ] Verify frontend fails to load AI state
- [ ] Verify error messages indicate HTTP failure (not "loading...")
- [ ] Verify no mock data appears as fallback

### 5. Normal HTTP Integration
- [ ] Configure valid credentials and reachable backend
- [ ] Verify all AI workflows load from `/api/ai`
- [ ] Verify chemicals/equipment import uses HTTP backend
- [ ] Verify movements/maintenance use localStorage (documented as local auxiliary)
- [ ] Check browser Network tab - all AI requests go to `/api/ai`

### 6. Gateway Mode Enforcement
- [ ] Set `VITE_AI_GATEWAY_MODE=direct` (or any non-http value)
- [ ] Verify frontend throws error at gateway initialization
- [ ] Verify error message mentions "only supports http"
- [ ] Verify no silent fallback to direct/mock gateway

### 7. Environment Variable Defaults
- [ ] Omit `VITE_AI_GATEWAY_MODE` entirely
- [ ] Verify frontend defaults to HTTP mode
- [ ] Verify `/api/ai` is used as base URL
- [ ] Verify no mock/direct initialization

## Verification Commands

```bash
# Frontend lint and type check
cd frontend
npm run lint
npm run type-check

# Build verification
npm run build

# OpenSpec verification
cd ..
openspec verify --change s1-05-unify-frontend-live-integration-mode
```

## Known Limitations

### Out of Scope for S1-05

These capabilities are **not** part of HTTP backend integration validation:

- **Movement Records:** Use localStorage seed data (not HTTP backend)
- **Maintenance Records:** Use localStorage seed data (not HTTP backend)

These will be migrated to HTTP backend in future work.
