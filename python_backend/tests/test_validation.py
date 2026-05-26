from datetime import datetime

from app.imports.validation import ValidationError, aggregate_batch_errors, validate_cross_fields, validate_date_range


def test_validate_date_range_valid():
    data = {"start_date": "2024-01-01", "end_date": "2024-12-31"}
    errors = validate_date_range(data, "start_date", "end_date")
    assert len(errors) == 0


def test_validate_date_range_invalid():
    data = {"start_date": "2024-12-31", "end_date": "2024-01-01"}
    errors = validate_date_range(data, "start_date", "end_date")
    assert len(errors) == 1
    assert errors[0].error_code == "INVALID_DATE_RANGE"


def test_validate_cross_fields():
    data = {"start_date": "2024-12-31", "end_date": "2024-01-01"}
    rules = [{"type": "date_range", "start_field": "start_date", "end_field": "end_date"}]
    errors = validate_cross_fields(data, rules)
    assert len(errors) == 1


def test_aggregate_batch_errors():
    error1 = ValidationError("field1", "REQUIRED", "Field is required")
    error2 = ValidationError("field2", "INVALID", "Invalid value")
    records_errors = [(0, [error1]), (2, [error2])]
    aggregated = aggregate_batch_errors(records_errors)
    assert 0 in aggregated
    assert 2 in aggregated
    assert len(aggregated[0]) == 1
