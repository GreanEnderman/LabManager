from pathlib import Path
import inspect

import pydyf
from weasyprint import HTML
from weasyprint.text.fonts import FontConfiguration

from .config import NOTO_SANS_CJK_BOLD, NOTO_SANS_CJK_REGULAR, PDF_CONFIG


def init_font_config() -> FontConfiguration:
    """Initialize WeasyPrint font configuration with bundled fonts."""
    font_config = FontConfiguration()
    return font_config


def patch_pydyf_pdf_constructor() -> None:
    """Bridge WeasyPrint versions that still pass version/identifier to pydyf.PDF."""
    if len(inspect.signature(pydyf.PDF).parameters) != 0:
        return

    original_pdf = pydyf.PDF

    class CompatiblePDF(original_pdf):
        def __init__(self, version: str | bytes = "1.7", identifier=False):
            super().__init__()
            self.version = version
            self.identifier = identifier

    pydyf.PDF = CompatiblePDF


def get_base_css() -> str:
    """Get base CSS with font configuration."""
    return f"""
    @page {{
        size: A4;
        margin: {PDF_CONFIG['margin_top']} {PDF_CONFIG['margin_right']} {PDF_CONFIG['margin_bottom']} {PDF_CONFIG['margin_left']};
        @top-center {{
            content: "LabManager Report";
            font-size: 10px;
            color: #666;
        }}
        @bottom-center {{
            content: "Page " counter(page) " of " counter(pages);
            font-size: 10px;
            color: #666;
        }}
    }}
    @font-face {{
        font-family: 'Noto Sans CJK SC';
        src: url('file://{NOTO_SANS_CJK_REGULAR}');
        font-weight: normal;
    }}
    @font-face {{
        font-family: 'Noto Sans CJK SC';
        src: url('file://{NOTO_SANS_CJK_BOLD}');
        font-weight: bold;
    }}
    body {{
        font-family: 'Noto Sans CJK SC', sans-serif;
    }}
    """


def render_pdf(html_content: str, css: str = "") -> bytes:
    """Render HTML to PDF with configured fonts."""
    from weasyprint import CSS

    patch_pydyf_pdf_constructor()
    font_config = init_font_config()
    base_css = get_base_css()
    html = HTML(string=html_content)

    stylesheets = [CSS(string=base_css)]
    if css:
        stylesheets.append(CSS(string=css))

    return html.write_pdf(font_config=font_config, stylesheets=stylesheets)
