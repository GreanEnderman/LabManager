from datetime import date

import pytest

from app.reports.data_access.inventory import ReportRiskThresholds, get_potential_risks


class FakeCursor:
    def __init__(self):
        self.calls = []
        self._rows = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def execute(self, query, params=None):
        self.calls.append((query, params))
        if "FROM chemicals" in query:
            multiplier = params[0]
            self._rows = [("chem-1", "Buffer", 12, 10, "瓶")] if multiplier >= 1.2 else []
        elif "FROM equipment" in query:
            self._rows = [("eq-1", "Centrifuge", date(2026, 5, 3))]
        else:
            window_start = params[0]
            self._rows = [("eq-2", "Incubator", 3)] if window_start <= date(2026, 4, 1) else []

    async def fetchall(self):
        return self._rows


class FakeConnection:
    def __init__(self):
        self.cursor_instance = FakeCursor()

    def cursor(self):
        return self.cursor_instance


@pytest.mark.asyncio
async def test_potential_risks_follow_configurable_thresholds():
    conn = FakeConnection()

    strict = await get_potential_risks(
        conn,
        date(2026, 5, 1),
        date(2026, 5, 2),
        ReportRiskThresholds(
            near_low_stock_ratio=0.1,
            near_maintenance_days=3,
            fault_frequency_window_days=7,
        ),
    )
    relaxed = await get_potential_risks(
        conn,
        date(2026, 5, 1),
        date(2026, 5, 2),
        ReportRiskThresholds(
            near_low_stock_ratio=0.25,
            near_maintenance_days=7,
            fault_frequency_window_days=45,
        ),
    )

    assert strict["near_low_stock"] == []
    assert relaxed["near_low_stock"][0]["id"] == "chem-1"
    assert strict["high_fault_frequency"] == []
    assert relaxed["high_fault_frequency"][0]["equipment_id"] == "eq-2"
    assert relaxed["thresholds"] == {
        "near_low_stock_ratio": 0.25,
        "near_maintenance_days": 7,
        "fault_frequency_window_days": 45,
        "high_fault_count": 2,
    }
