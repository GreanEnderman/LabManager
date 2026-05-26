from pathlib import Path


FONT_DIR = Path(__file__).parent.parent / "assets" / "fonts"
NOTO_SANS_CJK_REGULAR = FONT_DIR / "NotoSansCJKsc-Regular.otf"
NOTO_SANS_CJK_BOLD = FONT_DIR / "NotoSansCJKsc-Bold.otf"

PDF_CONFIG = {
    "margin_top": "2cm",
    "margin_bottom": "2cm",
    "margin_left": "2cm",
    "margin_right": "2cm",
}
