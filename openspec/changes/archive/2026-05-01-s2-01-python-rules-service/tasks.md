## 1. Python Rules Engine Setup

- [x] 1.1 Create python_backend/rules module structure
- [x] 1.2 Add FastAPI dependencies to python_backend requirements
- [x] 1.3 Define Pydantic models for three event types (task, approval, activity)
- [x] 1.4 Define Pydantic models for audit context (runId, operator, timestamp)

## 2. Event Recognition Implementation

- [x] 2.1 Implement task event classifier with metadata extraction
- [x] 2.2 Implement approval event classifier with metadata extraction
- [x] 2.3 Implement activity log event classifier with metadata extraction
- [x] 2.4 Add event type routing logic

## 3. Deduplication Logic

- [x] 3.1 Implement deduplication cache with time-window support
- [x] 3.2 Add task event deduplication by task ID
- [x] 3.3 Add approval event deduplication by approval ID
- [x] 3.4 Add activity event deduplication by activity ID
- [x] 3.5 Implement cache cleanup for expired entries

## 4. Audit Context Handling

- [x] 4.1 Add audit context validation on event input
- [x] 4.2 Implement audit field propagation through processing pipeline
- [x] 4.3 Add audit context to output responses

## 5. Protocol Adapter Implementation

- [x] 5.1 Create gateway/adapter module for TS-Python protocol translation
- [x] 5.2 Implement TS-to-Python input field mapping
- [x] 5.3 Implement Python-to-TS output field mapping
- [x] 5.4 Add unknown field passthrough logic
- [x] 5.5 Implement error format translation (validation and system errors)
- [x] 5.6 Add audit context propagation in adapter layer

## 6. Comparison Framework

- [x] 6.1 Create tests/comparison harness structure
- [x] 6.2 Implement test data generator for three event types
- [x] 6.3 Add TS reference implementation caller
- [x] 6.4 Add Python implementation caller
- [x] 6.5 Implement output comparison logic (classification, metadata, deduplication)
- [x] 6.6 Add comparison report generator

## 7. Integration and Testing

- [x] 7.1 Add FastAPI endpoint for rules processing
- [x] 7.2 Wire protocol adapter to Python rules engine
- [x] 7.3 Run comparison framework against both implementations
- [x] 7.4 Verify audit context preservation across stacks
- [x] 7.5 Add CI job to run comparison on every commit
