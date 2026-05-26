from datetime import datetime

from app.gateway.adapter import ProtocolAdapter


def test_audit_field_mapping_ts_to_python():
    adapter = ProtocolAdapter()
    ts_audit = {
        "runId": "test-run-123",
        "operator": "test_user",
        "timestamp": "2024-01-01T00:00:00Z",
    }
    python_audit = adapter._map_audit_fields(ts_audit)
    assert python_audit["runId"] == "test-run-123"
    assert python_audit["operator"] == "test_user"


def test_audit_field_mapping_python_to_ts():
    adapter = ProtocolAdapter()
    python_audit = {
        "run_id": "test-run-456",
        "operator": "test_user",
        "timestamp": "2024-01-01T00:00:00Z",
    }
    ts_audit = adapter._map_audit_fields(python_audit)
    assert ts_audit["runId"] == "test-run-456"
    assert ts_audit["operator"] == "test_user"


def test_run_id_consistency():
    adapter = ProtocolAdapter()
    run_id = "consistent-run-789"

    ts_input = {"audit": {"runId": run_id}}
    python_mapped = adapter.ts_to_python(ts_input)
    assert python_mapped["audit"]["runId"] == run_id

    python_output = {"audit": {"run_id": run_id}}
    ts_mapped = adapter.python_to_ts(python_output)
    assert ts_mapped["audit"]["runId"] == run_id
