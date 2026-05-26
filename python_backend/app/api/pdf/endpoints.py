"""PDF export API endpoints.

NOTE: These endpoints are not directly used by the frontend.
Frontend accesses PDF export through the compatibility layer at /api/ai/reports/{id}/pdf.

These endpoints serve as:
1. Internal API for future direct integration
2. Direct PDF generation from HTML/templates
3. Testing and development interface

See: docs/api-connection-analysis.md for connection mapping.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from app.pdf.exporter import export_to_pdf
from app.reports.templates import render_template

router = APIRouter(prefix="/api/pdf", tags=["pdf"])


class PDFExportRequest(BaseModel):
    html_content: str | None = None
    template_name: str | None = None
    context: dict | None = None
    metadata: dict


@router.post("/export")
async def export_pdf(request: PDFExportRequest):
    """Export HTML content or template to PDF."""
    try:
        if request.html_content:
            html = request.html_content
        elif request.template_name and request.context:
            html = render_template(request.template_name, request.context)
        else:
            raise HTTPException(
                status_code=400,
                detail="Either html_content or (template_name + context) required"
            )

        pdf_bytes = await export_to_pdf(html, request.metadata)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=report.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
