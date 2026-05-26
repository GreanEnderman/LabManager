## Purpose

Define the repository delivery hygiene baseline so source control contains only reviewable source truth, reproducible build inputs, safe configuration templates, and necessary documentation.

## Requirements

### Requirement: Repository Ignore Baseline Must Be Defined
The repository SHALL define a root-level ignore policy that excludes dependency directories, build outputs, caches, logs, archive packages, and machine-generated export artifacts from version control by default.

#### Scenario: Ignoring common development and build noise
- **WHEN** the team introduces or reviews repository-wide ignore rules
- **THEN** the root policy MUST exclude at least dependency directories, build output directories such as `dist` and `build`, cache directories, log files, and coverage outputs that are not part of the source of truth

#### Scenario: Ignoring delivery archives and generated exports
- **WHEN** archive packages or generated export artifacts such as zip bundles or diagram export images appear in the workspace
- **THEN** the repository MUST treat them as ignored delivery artifacts unless they are explicitly documented as source assets in an allowed location

### Requirement: Environment Files Must Follow Template Boundary Rules
The repository MUST distinguish between committable environment templates and non-committable environment value files so real runtime secrets or machine-local settings do not enter version control.

#### Scenario: Committing environment configuration guidance
- **WHEN** the project needs to document required environment variables for local setup or deployment
- **THEN** it MUST do so through template files such as `.env.example` or equivalent documentation that contains no live secret values

#### Scenario: Handling local or deployed environment values
- **WHEN** a developer or deploy process creates `.env`, `.env.local`, or other environment value files with real settings
- **THEN** those files MUST be excluded from version control and MUST NOT be treated as part of the repository delivery surface

### Requirement: Repository Delivery Surface Must Stay Minimal
The repository SHALL keep only the minimum set of source files, configuration, templates, and documentation required for human review, reproducible builds, and controlled releases.

#### Scenario: Reviewing whether a file belongs in the repository
- **WHEN** a new file type, generated directory, or delivery artifact is introduced
- **THEN** the team MUST evaluate whether it contributes reviewable source truth, build input, or release governance before allowing it into version control

#### Scenario: Handling generated outputs for demos or handoff
- **WHEN** a team member needs to share a demo build, archive package, or exported visual artifact
- **THEN** that output MUST be distributed through a release or external handoff path rather than committed as routine repository content

### Requirement: Governance Must Be Maintainable As Tooling Evolves
The repository MUST provide a maintainable update path for ignore rules and delivery policy whenever new tools, directories, or generated artifact types are added.

#### Scenario: Adding a new toolchain output
- **WHEN** a new frontend, backend, documentation, or automation tool introduces generated files or directories
- **THEN** the implementation change MUST update the repository ignore policy or delivery guidance in the same change if those outputs are not part of the repository source of truth

#### Scenario: Preserving business source assets
- **WHEN** the project intentionally stores images or other binary assets that are primary product sources rather than generated exports
- **THEN** the governance policy MUST allow them through explicit directory or naming conventions so ignore rules do not erase legitimate source assets
