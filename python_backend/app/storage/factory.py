"""Storage factory for creating storage backends."""

from enum import Enum
from typing import Optional

from app.storage.protocol import AIStorage
from app.storage.memory import InMemoryAIStorage


class StorageMode(str, Enum):
    """Storage backend modes."""

    MEMORY = "memory"
    POSTGRES = "postgres"


def create_storage(mode: StorageMode = StorageMode.MEMORY) -> AIStorage:
    """Create storage backend based on mode.

    Args:
        mode: Storage mode (memory or postgres)

    Returns:
        Storage backend instance

    Raises:
        ValueError: If mode is invalid
    """
    if mode == StorageMode.MEMORY:
        return InMemoryAIStorage()
    elif mode == StorageMode.POSTGRES:
        # PostgreSQL storage requires connection factory
        # For now, raise error - should be created with connection
        raise ValueError(
            "PostgreSQL storage requires connection factory. "
            "Use PostgresAIStorage directly with a connection."
        )
    else:
        raise ValueError(f"Unknown storage mode: {mode}")


def get_storage_mode_from_env() -> StorageMode:
    """Get storage mode from environment variable.

    Returns:
        Storage mode from STORAGE_MODE env var, defaults to MEMORY
    """
    import os

    mode_str = os.getenv("STORAGE_MODE", "memory").lower()

    if mode_str == "postgres":
        return StorageMode.POSTGRES
    else:
        return StorageMode.MEMORY
