#!/usr/bin/env python3
"""
Configuration validation script for deployment verification.

Usage:
    python scripts/validate_config.py

Environment variables should be set before running this script.
"""

import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent / "python_backend"))

from app.core.config import get_settings
from app.core.validation import validate_startup_config


def main():
    print("=" * 60)
    print("LabManager Configuration Validation")
    print("=" * 60)
    print()

    try:
        settings = get_settings()
        print(f"Environment: {settings.app_env}")
        print(f"Development mode: {settings.is_development}")
        print()

        print("Validating external dependencies...")
        print()

        validate_startup_config(settings)

        print()
        print("=" * 60)
        print("✓ All configuration validated successfully!")
        print("=" * 60)
        return 0

    except RuntimeError as e:
        print()
        print("=" * 60)
        print("✗ Configuration validation failed:")
        print("=" * 60)
        print()
        print(str(e))
        print()
        print("Please set the required environment variables and try again.")
        return 1
    except Exception as e:
        print()
        print("=" * 60)
        print("✗ Unexpected error during validation:")
        print("=" * 60)
        print()
        print(str(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())
