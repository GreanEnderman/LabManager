# Deployment Guide

## Environment Variables

The LabManager Python backend requires the following environment variables for external dependencies. All variables use the `LABMANAGER_PY_` prefix.

### PDF Font Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LABMANAGER_PY_PDF_FONT_PATH` | No | System fonts | Path to directory containing fonts for PDF generation |

**Behavior:**
- If set: Uses fonts from the specified directory
- If not set: Falls back to platform-specific system font directories
  - Windows: `C:\Windows\Fonts`
  - macOS: `/System/Library/Fonts`, `/Library/Fonts`, `~/Library/Fonts`
  - Linux: `/usr/share/fonts`, `/usr/local/share/fonts`, `~/.fonts`, `~/.local/share/fonts`
- If no fonts found: Application fails at startup with clear error message

### LLM Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LABMANAGER_PY_LLM_API_KEY` | Yes | None | API key for LLM service |
| `LABMANAGER_PY_LLM_ENDPOINT` | Yes | None | LLM service endpoint URL |
| `LABMANAGER_PY_LLM_MODEL` | Yes | None | LLM model identifier |

**Behavior:**
- All three variables are required
- Application fails at startup if any are missing
- No fallback or degraded mode

### SMTP Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LABMANAGER_PY_SMTP_HOST` | Production: Yes<br>Development: No | None | SMTP server hostname |
| `LABMANAGER_PY_SMTP_PORT` | Production: Yes<br>Development: No | None | SMTP server port |
| `LABMANAGER_PY_SMTP_USER` | Production: Yes<br>Development: No | None | SMTP authentication username |
| `LABMANAGER_PY_SMTP_PASSWORD` | Production: Yes<br>Development: No | None | SMTP authentication password |
| `LABMANAGER_PY_SMTP_FROM` | Production: Yes<br>Development: No | None | From email address |

**Behavior:**
- **Production mode** (`LABMANAGER_PY_APP_ENV` not in `dev`, `development`, `local`, `test`):
  - All SMTP variables are required
  - Application fails at startup if any are missing
- **Development mode**:
  - SMTP variables are optional
  - If incomplete, emails are logged to `logs/emails/emails.log` instead of being sent
  - Warning logged at startup

## Platform-Specific Font Installation

### Windows

Fonts are automatically available at `C:\Windows\Fonts`. No additional setup required.

### macOS

System fonts are available by default. To add custom fonts:
```bash
cp your-fonts/*.ttf ~/Library/Fonts/
```

### Linux (Ubuntu/Debian)

Install common fonts:
```bash
sudo apt-get update
sudo apt-get install fonts-liberation fonts-dejavu
```

Or add custom fonts:
```bash
mkdir -p ~/.local/share/fonts
cp your-fonts/*.ttf ~/.local/share/fonts/
fc-cache -f -v
```

## Configuration Validation

The application validates all external dependency configuration at startup. If validation fails, the application will not start and will display clear error messages indicating which configuration is missing or invalid.

To verify your configuration before deployment, use the validation script (see next section).
