import logging
from typing import Any

from .renderer import render_pdf
from .simple_text_pdf import render_text_pdf_from_html

logger = logging.getLogger(__name__)


async def export_to_pdf(html_content: str, metadata: dict[str, Any]) -> bytes:
    """Export HTML content to PDF."""
    try:
        return render_pdf(html_content)
    except Exception as e:
        logger.warning("HTML PDF renderer failed; falling back to text PDF: %s", e, exc_info=True)
        return render_text_pdf_from_html(html_content)
