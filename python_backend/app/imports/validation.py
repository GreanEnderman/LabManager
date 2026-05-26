from datetime import datetime
from typing import Any


class ValidationError:
    def __init__(self, field_path: str, error_code: str, message: str):
        self.field_path = field_path
        self.error_code = error_code
        self.message = message

    def to_dict(self) -> dict:
        return {
            "field_path": self.field_path,
            "error_code": self.error_code,
            "message": self.message,
        }


def validate_date_range(data: dict, start_field: str, end_field: str) -> list[ValidationError]:
    errors = []
    start = data.get(start_field)
    end = data.get(end_field)

    if start and end:
        try:
            start_dt = datetime.fromisoformat(start) if isinstance(start, str) else start
            end_dt = datetime.fromisoformat(end) if isinstance(end, str) else end
            if end_dt < start_dt:
                errors.append(
                    ValidationError(
                        field_path=f"{start_field},{end_field}",
                        error_code="INVALID_DATE_RANGE",
                        message=f"{end_field} must be after {start_field}",
                    )
                )
        except (ValueError, TypeError):
            pass

    return errors


def validate_cross_fields(data: dict, rules: list[dict]) -> list[ValidationError]:
    errors = []
    for rule in rules:
        rule_type = rule.get("type")
        if rule_type == "date_range":
            errors.extend(validate_date_range(data, rule["start_field"], rule["end_field"]))
    return errors


def aggregate_batch_errors(records_errors: list[tuple[int, list[ValidationError]]]) -> dict:
    aggregated = {}
    for record_index, errors in records_errors:
        if errors:
            aggregated[record_index] = [error.to_dict() for error in errors]
    return aggregated

