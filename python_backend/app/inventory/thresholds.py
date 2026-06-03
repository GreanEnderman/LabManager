"""Inventory threshold resolution helpers."""

from typing import Any


def as_number(value: Any, fallback: float = 0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def get_effective_chemical_threshold(chem: dict[str, Any], thresholds: Any | None) -> float:
    """Resolve the low-stock threshold from system settings.

    System settings are the source of truth. Per-chemical overrides are matched
    by chemical name; the imported row threshold is only a fallback for older
    deployments without saved settings.
    """
    if thresholds is not None:
        overrides = getattr(thresholds, "chemicalThresholdOverrides", {}) or {}
        override = overrides.get(str(chem.get("name") or ""))
        if override is not None:
            return as_number(override)

        default_threshold = getattr(thresholds, "defaultLowStockThreshold", None)
        if default_threshold is not None:
            return as_number(default_threshold)

    return as_number(chem.get("threshold"))
