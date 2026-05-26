import asyncio
from typing import Optional, Dict, Any
from .proxy import DualBackendProxy, ComparisonResult

class RegressionClient:
    def __init__(self, ts_url: str = "http://localhost:3000", python_url: str = "http://localhost:8000"):
        self.proxy = DualBackendProxy(ts_url, python_url)

    async def post(self, path: str, body: Optional[Dict[str, Any]] = None,
                   headers: Optional[Dict[str, str]] = None) -> ComparisonResult:
        return await self.proxy.invoke("POST", path, headers, body)

    async def get(self, path: str, headers: Optional[Dict[str, str]] = None) -> ComparisonResult:
        return await self.proxy.invoke("GET", path, headers, None)

    async def put(self, path: str, body: Optional[Dict[str, Any]] = None,
                  headers: Optional[Dict[str, str]] = None) -> ComparisonResult:
        return await self.proxy.invoke("PUT", path, headers, body)

    async def delete(self, path: str, headers: Optional[Dict[str, str]] = None) -> ComparisonResult:
        return await self.proxy.invoke("DELETE", path, headers, None)
