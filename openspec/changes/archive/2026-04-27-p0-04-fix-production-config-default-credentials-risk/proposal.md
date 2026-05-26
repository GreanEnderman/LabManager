## Why

当前仓库仍然存在默认管理员凭据、默认 JWT secret、以及 SMTP / LLM 等敏感配置的本地内嵌或弱默认值，这会让系统在进入预发或生产环境时直接落入高风险和阻塞发布状态。这个变更需要现在落地，以便先冻结安全配置边界，再推进后续部署、AI 能力接入和生产整改任务。

## What Changes

- 移除或禁用默认管理员账号与默认密码策略，禁止生产环境依赖仓库内预置凭据启动。
- 定义认证、邮件、LLM 等敏感配置的外部注入规则，要求 JWT secret、SMTP、LLM API Key 等只从环境或密钥注入层获取。
- 明确本地、测试、预发、生产环境的配置边界、允许的回退行为和启动校验策略。
- 约束示例配置、运行时配置加载和部署文档，避免继续传播 `change-me`、本地 secret 或伪生产默认值。

## Capabilities

### New Capabilities
- `runtime-secret-injection-boundary`: 定义敏感运行时配置必须通过外部注入提供，并为不同环境声明允许与禁止的默认行为。
- `bootstrap-credential-hardening`: 定义默认管理员、默认密码和初始化凭据在本地开发与生产部署中的启用边界和禁用规则。

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use existing spec names from openspec/specs/. Leave empty if no requirement changes. -->

## Impact

- Affected code: backend 配置加载、认证与管理员初始化逻辑、SMTP/LLM 运行时装配、环境变量模板。
- Affected systems: local/test/staging/production deployment, authentication bootstrap, email delivery, and AI provider integration.
- Affected artifacts: `docs/production-remediation-backlog.md`, environment setup docs, and deployment handoff guidance.
