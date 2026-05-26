import os
from enum import Enum
from pathlib import Path

from dotenv import load_dotenv


ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(ENV_FILE, override=False)


class ServiceTarget(str, Enum):
    TS_BACKEND = "ts"
    PYTHON_BACKEND = "python"
    COMPAT_FALLBACK = "compat_fallback"


class Capability(str, Enum):
    SETTINGS = "settings"
    INVENTORY = "inventory"
    IMPORT = "import"
    RULES = "rules"
    TASKS = "tasks"
    APPROVALS = "approvals"
    REPORT = "report"
    REPORT_PDF = "report_pdf"
    REPORT_DELIVERY = "report_delivery"
    ASYNC = "async"


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _capability_enabled(name: str, default: bool = False) -> bool:
    """Read rollout flags with both canonical and LABMANAGER-prefixed names."""
    canonical = f"PY_BACKEND_{name}_ENABLED"
    prefixed = f"LABMANAGER_PY_{canonical}"
    if os.getenv(canonical) is not None:
        return _env_bool(canonical, default)
    return _env_bool(prefixed, default)


_CAPABILITY_ENV_SUFFIXES: dict[Capability, str] = {
    Capability.SETTINGS: "SETTINGS",
    Capability.INVENTORY: "INVENTORY",
    Capability.IMPORT: "IMPORT",
    Capability.RULES: "RULES",
    Capability.TASKS: "TASKS",
    Capability.APPROVALS: "APPROVALS",
    Capability.REPORT: "REPORT",
    Capability.REPORT_PDF: "REPORT_PDF",
    Capability.REPORT_DELIVERY: "REPORT_DELIVERY",
    Capability.ASYNC: "ASYNC",
}
_CAPABILITY_TARGET_OVERRIDES: dict[Capability, ServiceTarget] = {}


def set_capability_target_override(capability: Capability, target: ServiceTarget | None) -> None:
    if target is None:
        _CAPABILITY_TARGET_OVERRIDES.pop(capability, None)
        return
    _CAPABILITY_TARGET_OVERRIDES[capability] = target


def get_capability_target(capability: Capability) -> ServiceTarget:
    if capability in _CAPABILITY_TARGET_OVERRIDES:
        return _CAPABILITY_TARGET_OVERRIDES[capability]
    if _capability_enabled(_CAPABILITY_ENV_SUFFIXES[capability]):
        return ServiceTarget.PYTHON_BACKEND
    return ServiceTarget.COMPAT_FALLBACK


def get_capability_routing_snapshot() -> dict[str, str]:
    """Get current routing snapshot for all capabilities.

    Returns:
        Dict mapping capability name to target service
    """
    return {capability.value: get_capability_target(capability).value for capability in Capability}


def validate_routing_consistency() -> list[str]:
    """Validate cross-capability routing dependencies.

    Returns:
        List of warning messages for inconsistent routing
    """
    warnings = []

    # Rule: If TASKS → PYTHON, then APPROVALS must also → PYTHON
    tasks_target = get_capability_target(Capability.TASKS)
    approvals_target = get_capability_target(Capability.APPROVALS)

    if tasks_target == ServiceTarget.PYTHON_BACKEND:
        if approvals_target != ServiceTarget.PYTHON_BACKEND:
            warnings.append(
                f"TASKS → PYTHON but APPROVALS → {approvals_target.value}. "
                "This may cause data inconsistency."
            )

    # Rule: If RULES → PYTHON, then TASKS must also → PYTHON
    rules_target = get_capability_target(Capability.RULES)
    if rules_target == ServiceTarget.PYTHON_BACKEND:
        if tasks_target != ServiceTarget.PYTHON_BACKEND:
            warnings.append(
                f"RULES → PYTHON but TASKS → {tasks_target.value}. "
                "Rules engine requires Python task service."
            )

    # Rule: If REPORT → PYTHON, then TASKS must also → PYTHON
    report_target = get_capability_target(Capability.REPORT)
    if report_target == ServiceTarget.PYTHON_BACKEND:
        if tasks_target != ServiceTarget.PYTHON_BACKEND:
            warnings.append(
                f"REPORT → PYTHON but TASKS → {tasks_target.value}. "
                "Report generation requires Python task service."
            )

    return warnings


REPORT_SERVICE_TARGET = get_capability_target(Capability.REPORT)
PDF_SERVICE_TARGET = get_capability_target(Capability.REPORT_PDF)
