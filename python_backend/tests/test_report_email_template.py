from app.reports.scheduled_tasks import _format_report_email


def test_supervisor_report_email_template_snapshot():
    subject, body = _format_report_email(
        "daily",
        {
            "summary": "AI closed the loop on today's critical lab operations.",
            "task_completions": 4,
            "approvals": 1,
            "metrics": {
                "task_status_distribution": {"done": 4, "open": 2},
                "inventory_changes": {"outbound": {"count": 3, "quantity": 12}},
                "potential_risks": {
                    "near_low_stock": [{"id": "chem-1"}],
                    "near_maintenance_due": [{"id": "eq-1"}],
                    "high_fault_frequency": [{"equipment_id": "eq-2"}],
                },
            },
        },
        report_url="https://lab.example/ai-workbench/reports?taskId=report-1",
        attachment_names=["daily-report.pdf"],
    )

    assert subject == "LabManager daily report"
    assert "<h3>Summary</h3>" in body
    assert "AI closed the loop on today&#x27;s critical lab operations." in body
    assert "<h3>Key risks</h3>" in body
    assert "Near low stock: 1" in body
    assert "Near maintenance due: 1" in body
    assert "High fault frequency: 1" in body
    assert "https://lab.example/ai-workbench/reports?taskId=report-1" in body
    assert "daily-report.pdf" in body
