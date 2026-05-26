"""Regression tests for localized report presentation fields."""

from app.reports.presentation import build_report_from_result, localize_report_presentation, render_report_html


def test_weekly_report_result_uses_chinese_presentation_fields():
    report = build_report_from_result(
        "report-test-weekly",
        {
            "start_date": "2026-05-11",
            "end_date": "2026-05-17",
            "task_completions": 0,
            "approvals": 0,
            "metrics": {
                "total_activities": 0,
                "task_status_distribution": {},
                "inventory_changes": {
                    "inbound": {"count": 0, "quantity": 0},
                    "outbound": {"count": 0, "quantity": 0},
                },
                "potential_risks": {
                    "near_low_stock": [],
                    "near_maintenance_due": [],
                    "high_fault_frequency": [],
                },
            },
            "daily_breakdown": [
                {"date": "2026-05-11", "task_completions": 0, "approvals": 0, "activities": 0},
            ],
            "metadata": {"timestamp": "2026-05-24T10:38:07.773192"},
        },
    )

    assert report["title"] == "AI 周报 - 2026-05-11 至 2026-05-17"
    assert report["summary"] == "AI 周报 - 2026-05-11 至 2026-05-17：本周期完成任务 0 项，审批记录 0 条，活动记录 0 条。当前任务状态：暂无任务状态分布数据。"
    assert report["highlights"] == [
        "闭环产出：完成任务 0 项，审批记录 0 条",
        "执行活跃度：活动记录 0 条",
        "库存流转：本周期没有记录到入库或出库动作。",
        "风险关注：未发现接近低库存、临近维护或高频故障对象。",
    ]
    assert [section["title"] for section in report["metadata"]["sections"]] == [
        "摘要",
        "重点结论",
        "任务与审批",
        "库存流转",
        "风险关注",
        "周期趋势",
        "管理员建议",
    ]
    assert report["metadata"]["sections"][-1]["content"] == "当前周期运行平稳。建议管理员确认统计时间窗是否符合预期，并继续保持巡检、库存盘点和维护计划更新。"


def test_daily_report_result_uses_chinese_presentation_fields():
    report = build_report_from_result(
        "report-test-daily",
        {
            "date": "2026-05-23",
            "task_completions": 1,
            "approvals": 2,
            "metrics": {
                "activities": 3,
                "task_status_distribution": {"open": 4, "pending_approval": 2},
                "inventory_changes": {
                    "inbound": {"count": 1, "quantity": 10},
                    "outbound": {"count": 2, "quantity": 5},
                },
                "potential_risks": {
                    "near_low_stock": [{"id": "chem-1"}],
                    "near_maintenance_due": [{"id": "eq-1"}],
                    "high_fault_frequency": [],
                },
            },
            "metadata": {"timestamp": "2026-05-24T10:38:04.461885"},
        },
    )

    assert report["title"] == "AI 日报 - 2026-05-23"
    assert report["summary"] == "AI 日报 - 2026-05-23：本周期完成任务 1 项，审批记录 2 条，活动记录 3 条。当前任务状态：待处理 4 项，待审批 2 项。"
    assert report["highlights"] == [
        "闭环产出：完成任务 1 项，审批记录 2 条",
        "执行活跃度：活动记录 3 条",
        "库存流转：入库 1 次、合计 10；出库 2 次、合计 5。",
        "风险关注：接近低库存物料 1 项，临近维护设备 1 台，高频故障设备 0 台。",
    ]
    assert report["metadata"]["sections"][-1]["title"] == "管理员建议"
    assert "优先处理待审批和已升级事项" in report["metadata"]["sections"][-1]["content"]


def test_legacy_english_report_record_is_localized_on_read():
    report = localize_report_presentation(
        {
            "id": "legacy-weekly",
            "type": "weekly",
            "title": "Weekly Report - 2026-05-11 to 2026-05-17",
            "summary": "Weekly Report - 2026-05-11 to 2026-05-17: 0 completed tasks, 0 approvals, 0 activity records.",
            "highlights": ["Completed tasks: 0", "Approvals: 0", "Activities: 0"],
            "createdAt": "2026-05-24T10:38:07.773192",
            "metadata": {
                "start_date": "2026-05-11",
                "end_date": "2026-05-17",
                "task_completions": 0,
                "approvals": 0,
                "metrics": {"total_activities": 0},
            },
        }
    )

    assert report["title"] == "AI 周报 - 2026-05-11 至 2026-05-17"
    assert report["summary"] == "AI 周报 - 2026-05-11 至 2026-05-17：本周期完成任务 0 项，审批记录 0 条，活动记录 0 条。当前任务状态：暂无任务状态分布数据。"
    assert report["createdAt"] == "2026-05-24T10:38:07.773192"


def test_report_html_includes_visible_report_content():
    report = build_report_from_result(
        "report-test-html",
        {
            "date": "2026-05-23",
            "task_completions": 1,
            "approvals": 2,
            "metrics": {"activities": 3},
            "metadata": {"timestamp": "2026-05-24T10:38:04.461885"},
        },
    )

    html = render_report_html(report)

    assert "<h1>AI 日报 - 2026-05-23</h1>" in html
    assert "本周期完成任务 1 项" in html
    assert "重点结论" in html
    assert "管理员建议" in html
