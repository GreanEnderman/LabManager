from types import SimpleNamespace

from app.inventory.thresholds import get_effective_chemical_threshold


def test_effective_threshold_uses_system_default_before_row_threshold() -> None:
    thresholds = SimpleNamespace(
        defaultLowStockThreshold=5,
        chemicalThresholdOverrides={},
    )

    threshold = get_effective_chemical_threshold(
        {"name": "乙醇", "threshold": 1},
        thresholds,
    )

    assert threshold == 5


def test_effective_threshold_uses_named_override_before_system_default() -> None:
    thresholds = SimpleNamespace(
        defaultLowStockThreshold=5,
        chemicalThresholdOverrides={"乙醇": 8},
    )

    threshold = get_effective_chemical_threshold(
        {"name": "乙醇", "threshold": 1},
        thresholds,
    )

    assert threshold == 8


def test_effective_threshold_falls_back_to_row_threshold_without_settings() -> None:
    threshold = get_effective_chemical_threshold(
        {"name": "乙醇", "threshold": 3},
        None,
    )

    assert threshold == 3
