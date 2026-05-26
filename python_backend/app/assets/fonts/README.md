# Fonts for PDF Export

This directory contains bundled fonts for PDF generation with Chinese character support.

## Required Fonts

- **Noto Sans CJK SC** (Simplified Chinese)
  - License: SIL Open Font License 1.1
  - Download: https://github.com/notofonts/noto-cjk/releases
  - Files needed: NotoSansCJKsc-Regular.otf, NotoSansCJKsc-Bold.otf

## Installation

Download the required font files and place them in this directory:

```bash
# Download Noto Sans CJK fonts
wget https://github.com/notofonts/noto-cjk/releases/download/Sans2.004/NotoSansCJKsc.zip
unzip NotoSansCJKsc.zip -d .
```

## Usage

Fonts are configured in `app/pdf/config.py` and loaded at application startup.
