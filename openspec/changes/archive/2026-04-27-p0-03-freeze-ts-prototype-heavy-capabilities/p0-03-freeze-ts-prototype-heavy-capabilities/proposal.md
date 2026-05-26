## Why

生产整改单已经明确，当前 TypeScript 原型后端不应继续承接导入、报告、PDF、邮件、异步任务等新增重型生产能力，否则会持续放大双栈迁移债并削弱 Python 目标栈收口。这个变更需要现在落地成正式边界，避免后续排期和实现继续把新增重型能力错误放入 TS 原型。

## What Changes

- 定义 TypeScript 原型后端的书面边界，只维护现有能力与必要缺陷修复，不再承接新增重型生产能力。
- 定义“新增重型生产能力”的默认落点，统一进入 Python 目标栈设计与 backlog，而不是继续进入 TS 实现。
- 约束研发排期与方案评审口径，禁止把新增重型能力默认排入 TS 原型后端。
- 记录 TS 原型与 Python 目标栈在迁移期间的职责分工，减少后续文档和任务拆分歧义。

## Capabilities

### New Capabilities
- `ts-prototype-capability-boundary`: 定义 TS 原型后端允许继续维护的范围，以及禁止新增重型生产能力的边界规则。
- `python-heavy-capability-intake`: 定义新增重型生产能力的默认归属、设计入口与 backlog 收口规则。

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use existing spec names from openspec/specs/. Leave empty if no requirement changes. -->

## Impact

- Affected systems: TypeScript prototype backend, Python target-stack planning, production remediation backlog, and implementation scheduling.
- Affected artifacts: remediation documentation, architecture/migration guidance, and future backlog intake decisions for import, report, PDF, email, and async-task work.
- Dependencies: depends on `P0-02` single-source DTO boundary so capability ownership is established on top of a shared contract truth.
