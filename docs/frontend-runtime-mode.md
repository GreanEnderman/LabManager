# Frontend Runtime Mode

## Overview

The LabManager frontend uses a **live HTTP-only runtime** for test, staging, and production environments. All AI workflows, settings, and data imports (chemicals/equipment) validate the backend through `/api/ai`.

## Environment Variables

### `VITE_AI_GATEWAY_MODE`

**Required value:** `http` (or omit, which defaults to `http`)

- Test, staging, and production environments **must** use `http` mode
- Any other value will cause runtime initialization to fail
- This prevents silent fallback to mock or direct gateway paths

### `VITE_AI_API_BASE_URL`

**Default:** `/api/ai`

- Override only when targeting a different backend endpoint for integration testing
- In production/staging, the reverse proxy routes `/api/ai` to the backend
- In development, Vite dev server proxies `/api/ai` to the configured backend

### `VITE_AI_HTTP_USERNAME` / `VITE_AI_HTTP_PASSWORD`

**Optional** - Used for automated HTTP login bootstrap during integration

- These credentials assist the HTTP authentication flow
- They do **NOT** bypass backend authentication or enable mock/direct modes
- Leave empty for manual login or when using other auth mechanisms

## Integration Scope

### HTTP Backend Integration (S1-05 validation scope)

These capabilities **must** use the HTTP backend through `/api/ai`:

- **AI Workflows:** Tasks, approvals, reports, events (AIStateLive)
- **AI Settings:** Thresholds, approval strategy, SLA configuration (AISettingsRuntimeLive)
- **Chemical Inventory:** Import, list, query
- **Equipment Assets:** Import, list, query
- **Import Batches:** Chemical and equipment import history

### Local Auxiliary Data (not HTTP backend)

These capabilities use **frontend localStorage** and are **not** part of S1-05 HTTP validation:

- **Movement Records:** Inbound/outbound tracking (localStorage seed data)
- **Maintenance Records:** Equipment maintenance logs (localStorage seed data)

These local auxiliary modules will be migrated to HTTP backend in future work.

## Error Handling

### HTTP Failures

When `/api/ai` is unreachable or returns errors:

- The frontend **throws** the error and propagates it to the UI
- No silent fallback to mock data or direct gateway
- Authentication failures (401/403/422/429) are surfaced through the live auth session handling

### Authentication Failures

The HTTP gateway handles authentication failures per S1-04 baseline:

- **401 Unauthorized:** Invalid or missing token
- **403 Forbidden:** Insufficient permissions
- **422 Unprocessable Entity:** Password policy violation
- **429 Too Many Requests:** Login throttling

These errors are exposed through the UI and do **not** trigger fallback to mock state.

## Verification

To verify the frontend is in live HTTP mode:

1. Check browser Network tab - all AI requests go to `/api/ai`
2. Check console - no mock/direct gateway initialization messages
3. Disable backend - frontend should fail visibly, not continue with mock data
4. Check auth failures - 401/403 should surface in UI, not silently recover
