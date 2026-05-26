# Backend Runtime Config Boundary

## 环境分层

- `local`：本地开发。允许使用显式的开发占位值，默认关闭 SMTP、LLM、bootstrap seed。
- `test`：测试环境。和 `local` 一样允许开发态配置，但需要显式打开测试用 bootstrap seed。
- `staging`：预发环境。按部署环境处理，禁止默认 JWT secret、禁止 bootstrap seed，启用的外部能力必须带真实注入配置。
- `production`：生产环境。与 `staging` 同样执行严格校验。

通过 `AI_RUNTIME_ENV` 指定环境；如果未指定，则回退到 `NODE_ENV`，再回退为 `local`。

## 敏感配置规则

- `JWT_SECRET`
  - `staging` / `production` 必须显式注入，不能为空，也不能使用占位值。
  - `local` / `test` 可以使用开发态值，但不应被当作可部署配置。
- `AI_LLM_ENABLED=true`
  - 必须同时提供 `AI_LLM_API_KEY`。
  - `AI_LLM_BASE_URL`、`AI_LLM_MODEL` 可以按接入目标覆盖。
- `SMTP_ENABLED=true`
  - 必须同时提供 `SMTP_HOST`、`SMTP_USER`、`SMTP_PASSWORD`、`SMTP_FROM_ADDRESS`。
  - `SMTP_ENABLED=false` 时，HTTP 运行时会回退到 stub sender，不要求 SMTP 凭据。

## Bootstrap 凭据规则

- 仓库不再内置默认管理员用户名/密码。
- 只有 `BOOTSTRAP_USERS_ENABLED=true` 且显式提供 `BOOTSTRAP_USERS_JSON` 时，才允许 seed 用户。
- `staging` / `production` 禁止启用 bootstrap seed。
- `BOOTSTRAP_USERS_JSON` 不得复用历史默认凭据对 `admin / LabManager123!`。

## 示例

本地开发最小配置：

```env
AI_RUNTIME_ENV=local
JWT_SECRET=local-development-only-jwt-secret
SMTP_ENABLED=false
AI_LLM_ENABLED=false
BOOTSTRAP_USERS_ENABLED=false
```

测试环境启用显式 bootstrap：

```env
AI_RUNTIME_ENV=test
JWT_SECRET=test-only-secret
BOOTSTRAP_USERS_ENABLED=true
BOOTSTRAP_USERS_JSON=[{"username":"tester-admin","password":"BetterPassword!234","name":"Test Admin","role":"admin"}]
```

预发/生产环境要求：

```env
AI_RUNTIME_ENV=production
JWT_SECRET=<externally-injected-secret>
SMTP_ENABLED=true
SMTP_HOST=<externally-injected-host>
SMTP_USER=<externally-injected-user>
SMTP_PASSWORD=<externally-injected-password>
SMTP_FROM_ADDRESS=<externally-injected-address>
AI_LLM_ENABLED=true
AI_LLM_API_KEY=<externally-injected-key>
BOOTSTRAP_USERS_ENABLED=false
```
