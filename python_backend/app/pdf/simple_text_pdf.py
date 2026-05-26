"""Small fallback PDF writer for text-only reports.

This is intentionally minimal. It is used only when the HTML renderer is not
available because of local WeasyPrint/pydyf version mismatches.
"""

from __future__ import annotations

import html
import re
from io import BytesIO


def html_to_text_lines(html_content: str) -> list[str]:
    """Extract readable text lines from simple report HTML."""
    text = re.sub(r"(?i)<\s*(br|/p|/h[1-6]|/li|/section|/div|/ul)\b[^>]*>", "\n", html_content)
    text = re.sub(r"(?i)<\s*li\b[^>]*>", "\n- ", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    lines = []
    for raw_line in text.splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if line:
            lines.append(line)
    return lines or ["LabManager AI Report"]


def _wrap_line(line: str, limit: int = 34) -> list[str]:
    if len(line) <= limit:
        return [line]
    wrapped = []
    current = ""
    for char in line:
        current += char
        if len(current) >= limit:
            wrapped.append(current)
            current = ""
    if current:
        wrapped.append(current)
    return wrapped


def _pdf_hex_text(value: str) -> str:
    return value.encode("utf-16-be", errors="replace").hex().upper()


def _pdf_stream(lines: list[str]) -> bytes:
    commands = ["BT", "/F1 12 Tf", "50 790 Td", "16 TL"]
    line_count = 0
    for line in lines:
        for wrapped in _wrap_line(line):
            if line_count >= 46:
                commands.append(f"<{_pdf_hex_text('内容过长，其余内容请在系统报告预览页查看。')}> Tj")
                commands.append("T*")
                commands.append("ET")
                return "\n".join(commands).encode("ascii")
            commands.append(f"<{_pdf_hex_text(wrapped)}> Tj")
            commands.append("T*")
            line_count += 1
    commands.append("ET")
    return "\n".join(commands).encode("ascii")


def render_text_pdf_from_html(html_content: str) -> bytes:
    """Render a simple single-page PDF containing extracted report text."""
    stream = _pdf_stream(html_to_text_lines(html_content))
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        (
            b"<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light "
            b"/Encoding /UniGB-UCS2-H /DescendantFonts [6 0 R] >>"
        ),
        b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream",
        (
            b"<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light "
            b"/CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> "
            b"/FontDescriptor 7 0 R /DW 1000 >>"
        ),
        (
            b"<< /Type /FontDescriptor /FontName /STSong-Light /Flags 4 "
            b"/FontBBox [-260 -220 1200 1000] /ItalicAngle 0 /Ascent 880 "
            b"/Descent -120 /CapHeight 700 /StemV 80 >>"
        ),
    ]

    output = BytesIO()
    output.write(b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(output.tell())
        output.write(f"{index} 0 obj\n".encode("ascii"))
        output.write(obj)
        output.write(b"\nendobj\n")

    xref_offset = output.tell()
    output.write(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    output.write(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.write(f"{offset:010d} 00000 n \n".encode("ascii"))
    output.write(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        ).encode("ascii")
    )
    return output.getvalue()
