"""Callers for TS and Python implementations."""

import httpx
from typing import Any


class TSCaller:
    """Calls TS reference implementation."""

    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url

    async def process_event(self, event: dict[str, Any]) -> dict[str, Any]:
        """Call TS rules endpoint."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/rules/process",
                json=event,
                timeout=10.0,
            )
            response.raise_for_status()
            return response.json()


class PythonCaller:
    """Calls Python implementation."""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url

    async def process_event(self, event: dict[str, Any]) -> dict[str, Any]:
        """Call Python rules endpoint."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/rules/process",
                json=event,
                timeout=10.0,
            )
            response.raise_for_status()
            return response.json()
