## 1. Database Models and Schema

- [x] 1.1 Create SQLAlchemy models for batch history (batch_id, timestamp, operator, file_name, total_count, success_count, failed_count, status)
- [x] 1.2 Create SQLAlchemy models for import records with audit fields (operator, reason, time, runId)
- [x] 1.3 Create SQLAlchemy models for error records (batch_id, record_index, field_path, error_code, message)
- [x] 1.4 Add database migration scripts for import tables

## 2. Validation Engine

- [x] 2.1 Create Pydantic schemas for import data with field-level validation rules
- [x] 2.2 Implement cross-field validation logic (e.g., date range checks)
- [x] 2.3 Build structured error formatter (field path, error code, message)
- [x] 2.4 Add batch error aggregation logic (group by record index)

## 3. Import API Endpoints

- [x] 3.1 Implement POST /api/import/manual endpoint for single record entry
- [x] 3.2 Implement POST /api/import/batch endpoint for file upload (CSV/Excel parsing)
- [x] 3.3 Add audit metadata capture middleware (operator, reason, time, runId)
- [x] 3.4 Implement GET /api/import/batches endpoint with filtering and pagination
- [x] 3.5 Implement GET /api/import/batches/<batch-id> endpoint for batch details

## 4. Batch Processing

- [x] 4.1 Implement stream processing for large file uploads
- [x] 4.2 Add chunked validation with progress tracking
- [x] 4.3 Build batch record creation and status update logic
- [x] 4.4 Store failed records with error details in error table

## 5. Rule Integration

- [x] 5.1 Create post-import hook interface for rule checking
- [x] 5.2 Implement async rule execution trigger after successful import
- [x] 5.3 Add rule check result storage linked to batch/record

## 6. Gateway/Facade Layer

- [x] 6.1 Create unified DTO for frontend consumption
- [x] 6.2 Implement gateway endpoints that adapt Python responses to frontend contract
- [x] 6.3 Add protocol translation logic for TS-to-Python migration phase

## 7. Testing and Validation

- [x] 7.1 Write unit tests for validation engine (field-level and cross-field)
- [x] 7.2 Write integration tests for import endpoints (manual and batch)
- [x] 7.3 Add cross-stack audit field consistency tests (Python vs TS runId matching)
- [x] 7.4 Test batch history retrieval with filtering and pagination
- [x] 7.5 Test error reporting format and completeness
