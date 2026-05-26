import os
import platform
from pathlib import Path


def get_system_font_directories() -> list[Path]:
    """Get platform-specific system font directories."""
    system = platform.system()

    if system == "Windows":
        return [Path("C:/Windows/Fonts")]
    elif system == "Darwin":  # macOS
        return [
            Path("/System/Library/Fonts"),
            Path("/Library/Fonts"),
            Path.home() / "Library/Fonts",
        ]
    else:  # Linux and others
        return [
            Path("/usr/share/fonts"),
            Path("/usr/local/share/fonts"),
            Path.home() / ".fonts",
            Path.home() / ".local/share/fonts",
        ]


def find_font_path(configured_path: str | None) -> Path:
    """
    Find a valid font directory.

    Args:
        configured_path: PDF_FONT_PATH from environment

    Returns:
        Path to font directory

    Raises:
        RuntimeError: If no valid font directory found
    """
    if configured_path:
        path = Path(configured_path)
        if path.exists() and path.is_dir():
            return path
        raise RuntimeError(
            f"Configured PDF_FONT_PATH does not exist or is not a directory: {configured_path}"
        )

    for font_dir in get_system_font_directories():
        if font_dir.exists() and font_dir.is_dir():
            return font_dir

    raise RuntimeError(
        "No font directory found. Set PDF_FONT_PATH environment variable or install system fonts."
    )
