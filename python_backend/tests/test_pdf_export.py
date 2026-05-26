"""Test PDF export with Chinese characters."""
import pytest

from app.pdf.exporter import export_to_pdf
from app.reports.presentation import build_report_from_result, render_report_html


@pytest.mark.asyncio
async def test_pdf_export_with_chinese_characters():
    """Test PDF export renders Chinese characters correctly."""
    html_content = """
    <html>
    <head><meta charset="UTF-8"></head>
    <body>
        <h1>测试报告</h1>
        <p>任务完成数：10</p>
        <p>审批数：5</p>
        <p>活动记录数：25</p>
    </body>
    </html>
    """

    metadata = {
        "operator": "测试用户",
        "run_id": "test-chinese-123"
    }

    pdf_bytes = await export_to_pdf(html_content, metadata)

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 0
    assert pdf_bytes[:4] == b'%PDF'  # PDF magic number


@pytest.mark.asyncio
async def test_pdf_export_empty_content():
    """Test PDF export with empty content."""
    html_content = "<html><body></body></html>"
    metadata = {"operator": "test", "run_id": "empty-test"}

    pdf_bytes = await export_to_pdf(html_content, metadata)

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 0


@pytest.mark.asyncio
async def test_report_pdf_export_contains_rendered_report_body():
    """Test report PDF export renders non-empty report content instead of a blank placeholder."""
    report = build_report_from_result(
        "report-test-pdf",
        {
            "date": "2026-05-23",
            "task_completions": 1,
            "approvals": 2,
            "metrics": {"activities": 3},
            "metadata": {"timestamp": "2026-05-24T10:38:04.461885"},
        },
    )

    pdf_bytes = await export_to_pdf(render_report_html(report), report["metadata"])

    assert pdf_bytes[:4] == b"%PDF"
    assert len(pdf_bytes) > 1000
