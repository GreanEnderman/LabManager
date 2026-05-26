from app.imports.validation import ValidationError, aggregate_batch_errors


def test_validation_error_structure():
    error = ValidationError("field.path", "ERROR_CODE", "Error message")
    error_dict = error.to_dict()
    assert error_dict["field_path"] == "field.path"
    assert error_dict["error_code"] == "ERROR_CODE"
    assert error_dict["message"] == "Error message"


def test_batch_error_aggregation_format():
    error1 = ValidationError("name", "REQUIRED", "Name is required")
    error2 = ValidationError("email", "INVALID_FORMAT", "Invalid email format")
    error3 = ValidationError("age", "OUT_OF_RANGE", "Age must be positive")

    records_errors = [(0, [error1, error2]), (5, [error3])]
    aggregated = aggregate_batch_errors(records_errors)

    assert 0 in aggregated
    assert 5 in aggregated
    assert len(aggregated[0]) == 2
    assert len(aggregated[5]) == 1
    assert aggregated[0][0]["field_path"] == "name"
    assert aggregated[0][1]["error_code"] == "INVALID_FORMAT"


def test_empty_error_aggregation():
    records_errors = [(0, []), (1, [])]
    aggregated = aggregate_batch_errors(records_errors)
    assert len(aggregated) == 0
