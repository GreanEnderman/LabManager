from datetime import date, datetime
from datetime import timedelta
from typing import Any

from psycopg import AsyncConnection

from .data_access.activity_logs import get_daily_activity_count
from .data_access.approvals import count_approvals
from .data_access.inventory import (
    ReportRiskThresholds,
    get_inventory_changes,
    get_potential_risks,
    get_task_status_distribution,
)
from .data_access.tasks import count_task_completions
from .data_access.utils import aggregate_with_fallback
from .models import DailyReportData, ReportMetadata, WeeklyReportData


def get_report_risk_thresholds() -> ReportRiskThresholds:
    from app.core.config import get_settings

    settings = get_settings()
    return ReportRiskThresholds(
        near_low_stock_ratio=settings.report_near_low_stock_ratio,
        near_maintenance_days=settings.report_near_maintenance_days,
        fault_frequency_window_days=settings.report_fault_frequency_window_days,
    )


async def generate_daily_report(
    conn: AsyncConnection,
    target_date: date,
    operator: str,
    run_id: str,
    llm_service: Any = None,
) -> DailyReportData:
    """Generate daily activity report with optional LLM-generated summary.

    Args:
        conn: Database connection
        target_date: Date for the report
        operator: User generating the report
        run_id: Unique run identifier
        llm_service: Optional LLM service for generating narrative summary

    Returns:
        DailyReportData with statistics and optional AI-generated summary
    """
    next_date = target_date + timedelta(days=1)
    risk_thresholds = get_report_risk_thresholds()
    results = await aggregate_with_fallback(
        conn,
        [
            (count_task_completions, (target_date,), 0, "task_completions"),
            (count_approvals, (target_date,), 0, "approvals"),
            (get_daily_activity_count, (target_date,), 0, "activities"),
            (get_task_status_distribution, (target_date, next_date), {}, "task_status_distribution"),
            (get_inventory_changes, (target_date, next_date), {}, "inventory_changes"),
            (get_potential_risks, (target_date, next_date, risk_thresholds), {}, "potential_risks"),
        ]
    )

    metadata = ReportMetadata(
        operator=operator,
        timestamp=datetime.now().isoformat(),
        run_id=run_id
    )

    # Generate LLM summary if service is available
    summary = None
    highlights = []
    if llm_service is not None:
        try:
            report_data = {
                "type": "daily",
                "date": target_date.isoformat(),
                "stats": {
                    "task_completions": results["task_completions"],
                    "approvals": results["approvals"],
                    "activities": results["activities"],
                    "task_status_distribution": results["task_status_distribution"],
                    "inventory_changes": results["inventory_changes"],
                    "potential_risks": results["potential_risks"],
                }
            }
            narrative = await llm_service.generate_report_narrative(report_data)
            summary = narrative.summary
            highlights = narrative.highlights

            # Add LLM metadata
            metadata_dict = metadata.model_dump() if hasattr(metadata, 'model_dump') else metadata.__dict__
            metadata_dict["llmUsed"] = narrative.meta.get("llmUsed", True)
            metadata_dict["llmProvider"] = narrative.meta.get("provider")
            metadata = ReportMetadata(**metadata_dict)
        except Exception as e:
            # Fallback: no summary on error
            metadata_dict = metadata.model_dump() if hasattr(metadata, 'model_dump') else metadata.__dict__
            metadata_dict["llmUsed"] = False
            metadata_dict["llmFallbackReason"] = str(e)
            metadata = ReportMetadata(**metadata_dict)

    report = DailyReportData(
        date=target_date,
        task_completions=results["task_completions"],
        approvals=results["approvals"],
        metrics={
            "activities": results["activities"],
            "task_status_distribution": results["task_status_distribution"],
            "inventory_changes": results["inventory_changes"],
            "potential_risks": results["potential_risks"],
        },
        metadata=metadata
    )

    # Add summary and highlights if available
    if summary:
        report_dict = report.model_dump() if hasattr(report, 'model_dump') else report.__dict__
        report_dict["summary"] = summary
        report_dict["highlights"] = highlights
        report = DailyReportData(**report_dict)

    return report


async def generate_weekly_report(
    conn: AsyncConnection,
    start_date: date,
    end_date: date,
    operator: str,
    run_id: str,
    llm_service: Any = None,
) -> WeeklyReportData:
    """Generate weekly summary report with optional LLM-generated summary.

    Args:
        conn: Database connection
        start_date: Start date of the week
        end_date: End date of the week
        operator: User generating the report
        run_id: Unique run identifier
        llm_service: Optional LLM service for generating narrative summary

    Returns:
        WeeklyReportData with statistics and optional AI-generated summary
    """
    from .data_access.activity_logs import get_activity_metrics
    from .data_access.approvals import get_approval_records
    from .data_access.tasks import get_task_completions

    risk_thresholds = get_report_risk_thresholds()
    results = await aggregate_with_fallback(
        conn,
        [
            (get_task_completions, (start_date, end_date), [], "tasks"),
            (get_approval_records, (start_date, end_date), [], "approvals"),
            (get_activity_metrics, (start_date, end_date), {}, "metrics"),
            (get_task_status_distribution, (start_date, end_date), {}, "task_status_distribution"),
            (get_inventory_changes, (start_date, end_date), {}, "inventory_changes"),
            (get_potential_risks, (start_date, end_date, risk_thresholds), {}, "potential_risks"),
        ]
    )
    tasks = results["tasks"]
    approvals = results["approvals"]
    metrics = results["metrics"]
    metrics["task_status_distribution"] = results["task_status_distribution"]
    metrics["inventory_changes"] = results["inventory_changes"]
    metrics["potential_risks"] = results["potential_risks"]

    daily_breakdown = []
    current_date = start_date
    while current_date < end_date:
        day_results = await aggregate_with_fallback(
            conn,
            [
                (count_task_completions, (current_date,), 0, "task_completions"),
                (count_approvals, (current_date,), 0, "approvals"),
                (get_daily_activity_count, (current_date,), 0, "activities"),
            ]
        )
        daily_breakdown.append({
            "date": current_date.isoformat(),
            "task_completions": day_results["task_completions"],
            "approvals": day_results["approvals"],
            "activities": day_results["activities"]
        })
        current_date += timedelta(days=1)

    metadata = ReportMetadata(
        operator=operator,
        timestamp=datetime.now().isoformat(),
        run_id=run_id
    )

    # Generate LLM summary if service is available
    summary = None
    highlights = []
    if llm_service is not None:
        try:
            report_data = {
                "type": "weekly",
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "stats": {
                    "task_completions": len(tasks),
                    "approvals": len(approvals),
                    "metrics": metrics,
                    "daily_breakdown": daily_breakdown,
                }
            }
            narrative = await llm_service.generate_report_narrative(report_data)
            summary = narrative.summary
            highlights = narrative.highlights

            # Add LLM metadata
            metadata_dict = metadata.model_dump() if hasattr(metadata, 'model_dump') else metadata.__dict__
            metadata_dict["llmUsed"] = narrative.meta.get("llmUsed", True)
            metadata_dict["llmProvider"] = narrative.meta.get("provider")
            metadata = ReportMetadata(**metadata_dict)
        except Exception as e:
            # Fallback: no summary on error
            metadata_dict = metadata.model_dump() if hasattr(metadata, 'model_dump') else metadata.__dict__
            metadata_dict["llmUsed"] = False
            metadata_dict["llmFallbackReason"] = str(e)
            metadata = ReportMetadata(**metadata_dict)

    report = WeeklyReportData(
        start_date=start_date,
        end_date=end_date,
        task_completions=len(tasks),
        approvals=len(approvals),
        metrics=metrics,
        daily_breakdown=daily_breakdown,
        metadata=metadata
    )

    # Add summary and highlights if available
    if summary:
        report_dict = report.model_dump() if hasattr(report, 'model_dump') else report.__dict__
        report_dict["summary"] = summary
        report_dict["highlights"] = highlights
        report = WeeklyReportData(**report_dict)

    return report
