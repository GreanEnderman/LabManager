## Why

The TS prototype backend needs to freeze new feature development (M-02) while Python takes over heavy production capabilities. Rules service is the first migration target because it has clear boundaries and is core to the system's event recognition and inspection logic.

## What Changes

- Migrate three-class event recognition logic from TS to Python
- Implement deduplication logic in Python matching TS reference behavior
- Establish protocol compatibility layer ensuring input/output consistency
- Create comparison framework to validate Python output against TS reference implementation

## Capabilities

### New Capabilities
- `python-rules-engine`: Core rule recognition and inspection engine in Python, supporting three event types with deduplication
- `rules-protocol-adapter`: Protocol compatibility layer ensuring consistent input/output between TS and Python implementations

### Modified Capabilities
<!-- No existing capabilities are being modified at the spec level -->

## Impact

- **Backend**: New Python service handling rules processing
- **TS Backend**: Becomes reference implementation for comparison (per M-02)
- **Protocol**: Rules input/output protocol must remain stable during migration
- **Dependencies**: Requires S1-02 (data model alignment) and S1-03 (audit continuity) to be complete
- **Testing**: Requires dual-track validation comparing TS and Python outputs
