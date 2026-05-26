## Why

当前仓库缺少明确的忽略与交付边界，导致压缩包、图片产物、构建输出、依赖目录和环境文件容易混入版本控制，仓库审查面与交付面持续膨胀。这个问题需要现在收敛，因为后续 P0 主线会持续增加前后端构建产物与配置文件，如果不先建立基线，后续实现和评审成本都会被放大。

## What Changes

- 定义仓库级交付卫生基线，明确哪些文件必须纳入版本控制，哪些文件必须忽略，哪些文件只能通过发行物或文档方式交付。
- 建立 `.gitignore` 规则治理要求，覆盖 `dist`、`node_modules`、压缩包、图片导出产物、运行缓存、日志与环境文件。
- 明确环境文件分层策略，区分模板类配置、开发期本地密钥、构建期注入配置与绝不入库的敏感文件。
- 规定仓库交付面必须收敛为“可审查、可构建、可发布”的最小集合，并要求新增目录或工具链产物时同步更新忽略策略。

## Capabilities

### New Capabilities
- `repository-delivery-hygiene-governance`: 定义仓库忽略规则、构建产物提交边界、环境文件边界与最小可交付集合治理要求。

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use existing spec names from openspec/specs/. Leave empty if no requirement changes. -->

## Impact

- Affected code: 仓库根目录 `.gitignore`、前后端构建输出目录约定、环境文件模板与交付文档。
- Affected systems: Git 提交边界、代码评审面、构建产物管理、发布包整理与本地开发环境隔离。
- Dependencies: 无前置变更依赖，但该基线会影响后续所有新增目录、构建工具与交付清单的治理方式。
