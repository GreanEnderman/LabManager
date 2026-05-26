"""Presentation helpers for AI report DTOs."""

from datetime import datetime, timezone
from html import escape
from typing import Any


STATUS_LABELS = {
    "open": "待处理",
    "in_progress": "处理中",
    "pending_approval": "待审批",
    "done": "已完成",
    "closed": "已关闭",
}


def _as_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _activity_count(metrics: dict[str, Any]) -> int:
    return _as_int(metrics.get("activities", metrics.get("total_actions", metrics.get("total_activities", 0))))


def _format_status_distribution(status_distribution: Any) -> str:
    if not isinstance(status_distribution, dict) or not status_distribution:
        return "暂无任务状态分布数据"
    parts = []
    for status, count in status_distribution.items():
        label = STATUS_LABELS.get(str(status), str(status))
        parts.append(f"{label} {count} 项")
    return "，".join(parts)


def _format_inventory_changes(changes: Any) -> str:
    if not isinstance(changes, dict):
        return "暂无库存流转数据"
    inbound = changes.get("inbound") or {}
    outbound = changes.get("outbound") or {}
    inbound_count = _as_int(inbound.get("count"))
    inbound_quantity = _as_int(inbound.get("quantity"))
    outbound_count = _as_int(outbound.get("count"))
    outbound_quantity = _as_int(outbound.get("quantity"))
    if inbound_count == 0 and outbound_count == 0:
        return "本周期没有记录到入库或出库动作。"
    return (
        f"入库 {inbound_count} 次、合计 {inbound_quantity}；"
        f"出库 {outbound_count} 次、合计 {outbound_quantity}。"
    )


def _risk_count(risks: Any, key: str) -> int:
    if not isinstance(risks, dict):
        return 0
    value = risks.get(key)
    return len(value) if isinstance(value, list) else 0


def _format_risk_focus(risks: Any) -> str:
    near_low_stock = _risk_count(risks, "near_low_stock")
    near_maintenance_due = _risk_count(risks, "near_maintenance_due")
    high_fault_frequency = _risk_count(risks, "high_fault_frequency")
    if near_low_stock == 0 and near_maintenance_due == 0 and high_fault_frequency == 0:
        return "未发现接近低库存、临近维护或高频故障对象。"
    return (
        f"接近低库存物料 {near_low_stock} 项，"
        f"临近维护设备 {near_maintenance_due} 台，"
        f"高频故障设备 {high_fault_frequency} 台。"
    )


def _format_daily_breakdown(daily_breakdown: Any) -> str:
    if not isinstance(daily_breakdown, list) or not daily_breakdown:
        return "日报无每日拆分；可结合活动记录查看当日执行情况。"
    active_days = [
        day
        for day in daily_breakdown
        if _as_int(day.get("task_completions")) or _as_int(day.get("approvals")) or _as_int(day.get("activities"))
    ]
    if not active_days:
        return "本周期每日拆分均为 0，说明该时间窗内没有形成任务完成、审批或活动记录。"
    busiest_day = max(active_days, key=lambda day: _as_int(day.get("activities")))
    return (
        f"共 {len(active_days)} 天有记录；活动最多的是 {busiest_day.get('date')}，"
        f"活动 {busiest_day.get('activities', 0)} 条、完成任务 {busiest_day.get('task_completions', 0)} 项、"
        f"审批 {busiest_day.get('approvals', 0)} 条。"
    )


def _build_summary(report_title: str, task_count: int, approval_count: int, activity_count: int, metrics: dict[str, Any]) -> str:
    status_distribution = metrics.get("task_status_distribution")
    status_summary = _format_status_distribution(status_distribution)
    return (
        f"{report_title}：本周期完成任务 {task_count} 项，审批记录 {approval_count} 条，"
        f"活动记录 {activity_count} 条。当前任务状态：{status_summary}。"
    )


def _build_highlights(task_count: int, approval_count: int, activity_count: int, metrics: dict[str, Any]) -> list[str]:
    risks = metrics.get("potential_risks")
    inventory_changes = metrics.get("inventory_changes")
    return [
        f"闭环产出：完成任务 {task_count} 项，审批记录 {approval_count} 条",
        f"执行活跃度：活动记录 {activity_count} 条",
        f"库存流转：{_format_inventory_changes(inventory_changes)}",
        f"风险关注：{_format_risk_focus(risks)}",
    ]


def _build_sections(
    summary: str,
    highlights: list[str],
    task_count: int,
    approval_count: int,
    activity_count: int,
    metrics: dict[str, Any],
    daily_breakdown: Any,
) -> list[dict[str, str]]:
    risks = metrics.get("potential_risks")
    return [
        {"title": "摘要", "content": summary},
        {"title": "重点结论", "content": "；".join(str(item) for item in highlights)},
        {
            "title": "任务与审批",
            "content": (
                f"本周期完成任务 {task_count} 项，审批记录 {approval_count} 条。"
                f"任务状态分布为：{_format_status_distribution(metrics.get('task_status_distribution'))}。"
            ),
        },
        {"title": "库存流转", "content": _format_inventory_changes(metrics.get("inventory_changes"))},
        {"title": "风险关注", "content": _format_risk_focus(risks)},
        {"title": "周期趋势", "content": _format_daily_breakdown(daily_breakdown)},
        {
            "title": "管理员建议",
            "content": (
                "优先处理待审批和已升级事项；对接近低库存物料安排复核或补货；"
                "对临近维护和高频故障设备确认负责人、截止时间和复盘记录。"
                if task_count or approval_count or activity_count or _format_risk_focus(risks) != "未发现接近低库存、临近维护或高频故障对象。"
                else "当前周期运行平稳。建议管理员确认统计时间窗是否符合预期，并继续保持巡检、库存盘点和维护计划更新。"
            ),
        },
    ]


def build_report_from_result(task_id: str, result: dict[str, Any]) -> dict[str, Any]:
    """Build the frontend-facing report DTO from generated report data."""
    report_type = "daily" if "date" in result else "weekly"
    if report_type == "daily":
        report_title = f"AI 日报 - {result.get('date')}"
    else:
        report_title = f"AI 周报 - {result.get('start_date')} 至 {result.get('end_date')}"
    task_count = result.get("task_completions", 0)
    approval_count = result.get("approvals", 0)
    metrics = result.get("metrics") or {}
    activity_count = _activity_count(metrics)
    summary = result.get("summary") or _build_summary(report_title, task_count, approval_count, activity_count, metrics)
    highlights = result.get("highlights") or _build_highlights(task_count, approval_count, activity_count, metrics)
    metadata = {
        **result,
        "sections": _build_sections(
            summary,
            highlights,
            task_count,
            approval_count,
            activity_count,
            metrics,
            result.get("daily_breakdown"),
        ),
    }
    return {
        "id": task_id,
        "type": report_type,
        "title": report_title,
        "summary": summary,
        "highlights": highlights,
        "createdAt": result.get("metadata", {}).get("timestamp", datetime.now(timezone.utc).isoformat()),
        "metadata": metadata,
    }


def localize_report_presentation(report: dict[str, Any]) -> dict[str, Any]:
    """Return a localized presentation for legacy English report records."""
    title = str(report.get("title") or "")
    metadata = report.get("metadata") or {}
    if not isinstance(metadata, dict):
        return report

    has_report_window = "date" in metadata or ("start_date" in metadata and "end_date" in metadata)
    is_legacy_english = title.startswith("Daily Report") or title.startswith("Weekly Report")
    if not has_report_window or not is_legacy_english:
        return report

    localized = build_report_from_result(str(report.get("id")), metadata)
    return {
        **report,
        "title": localized["title"],
        "summary": localized["summary"],
        "highlights": localized["highlights"],
        "metadata": localized["metadata"],
    }


def render_report_html(report: dict[str, Any]) -> str:
    """Render a report DTO to printable HTML for PDF export."""
    localized = localize_report_presentation(report)
    metadata = localized.get("metadata") or {}
    sections = metadata.get("sections") if isinstance(metadata, dict) else []
    if not isinstance(sections, list):
        sections = []

    section_html = "\n".join(
        f"""
        <section class="section">
          <h2>{escape(str(section.get("title") or "章节"))}</h2>
          <p>{escape(str(section.get("content") or ""))}</p>
        </section>
        """
        for section in sections
        if isinstance(section, dict)
    )
    highlights_html = "\n".join(f"<li>{escape(str(item))}</li>" for item in localized.get("highlights", []))

    return f"""
    <!doctype html>
    <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <title>{escape(str(localized.get("title") or "AI 报告"))}</title>
      <style>
        body {{
          color: #0f172a;
          font-size: 13px;
          line-height: 1.7;
        }}
        .eyebrow {{
          color: #475569;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }}
        h1 {{
          font-size: 28px;
          margin: 10px 0 4px;
        }}
        h2 {{
          font-size: 17px;
          margin: 0 0 8px;
        }}
        .created-at {{
          color: #475569;
          margin-bottom: 22px;
        }}
        .summary {{
          border: 1px solid #dbe3ef;
          border-radius: 10px;
          padding: 14px 16px;
          background: #f8fafc;
        }}
        .highlights {{
          margin: 18px 0;
          padding-left: 18px;
        }}
        .section {{
          border-top: 1px solid #dbe3ef;
          padding-top: 14px;
          margin-top: 14px;
        }}
        p {{
          margin: 0;
        }}
      </style>
    </head>
    <body>
      <div class="eyebrow">LabManager AI Report</div>
      <h1>{escape(str(localized.get("title") or "AI 报告"))}</h1>
      <div class="created-at">{escape(str(localized.get("createdAt") or ""))}</div>

      <section class="summary">
        <h2>摘要</h2>
        <p>{escape(str(localized.get("summary") or ""))}</p>
      </section>

      <section class="section">
        <h2>重点结论</h2>
        <ul class="highlights">{highlights_html}</ul>
      </section>

      {section_html}
    </body>
    </html>
    """
