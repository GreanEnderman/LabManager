"""Comparison logic and report generation."""

from typing import Any
from dataclasses import dataclass


@dataclass
class ComparisonResult:
    """Result of comparing TS and Python outputs."""
    event_id: str
    matches: bool
    ts_output: dict[str, Any]
    python_output: dict[str, Any]
    differences: list[str]


class OutputComparator:
    """Compares outputs from TS and Python implementations."""

    def compare(
        self, ts_output: dict[str, Any], python_output: dict[str, Any], event_id: str
    ) -> ComparisonResult:
        """Compare TS and Python outputs."""
        differences = []

        # Compare event type
        if ts_output.get("eventType") != python_output.get("eventType"):
            differences.append(
                f"eventType mismatch: {ts_output.get('eventType')} vs {python_output.get('eventType')}"
            )

        # Compare metadata
        ts_meta = ts_output.get("metadata", {})
        py_meta = python_output.get("metadata", {})
        if ts_meta != py_meta:
            differences.append(f"metadata mismatch: {ts_meta} vs {py_meta}")

        # Compare deduplication decision
        if ts_output.get("deduplicated") != python_output.get("deduplicated"):
            differences.append(
                f"deduplicated mismatch: {ts_output.get('deduplicated')} vs {python_output.get('deduplicated')}"
            )

        # Compare audit context
        ts_audit = ts_output.get("audit", {})
        py_audit = python_output.get("audit", {})
        if ts_audit.get("runId") != py_audit.get("runId"):
            differences.append(f"audit.runId mismatch")
        if ts_audit.get("operator") != py_audit.get("operator"):
            differences.append(f"audit.operator mismatch")

        return ComparisonResult(
            event_id=event_id,
            matches=len(differences) == 0,
            ts_output=ts_output,
            python_output=python_output,
            differences=differences,
        )


class ComparisonReporter:
    """Generates comparison reports."""

    def generate_report(self, results: list[ComparisonResult]) -> str:
        """Generate text report from comparison results."""
        total = len(results)
        passed = sum(1 for r in results if r.matches)
        failed = total - passed

        report = ["=" * 60]
        report.append("TS vs Python Rules Engine Comparison Report")
        report.append("=" * 60)
        report.append(f"Total: {total} | Passed: {passed} | Failed: {failed}")
        report.append("")

        if failed > 0:
            report.append("FAILURES:")
            for result in results:
                if not result.matches:
                    report.append(f"\n  Event: {result.event_id}")
                    for diff in result.differences:
                        report.append(f"    - {diff}")

        report.append("\n" + "=" * 60)
        return "\n".join(report)
