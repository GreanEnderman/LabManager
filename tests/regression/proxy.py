import asyncio
import httpx
from typing import Dict, Any, Optional
from dataclasses import dataclass

@dataclass
class BackendResponse:
    status_code: int
    headers: Dict[str, str]
    body: Any

@dataclass
class ComparisonResult:
    ts_response: BackendResponse
    python_response: BackendResponse
    differences: list[Dict[str, Any]]

class DualBackendProxy:
    def __init__(self, ts_base_url: str, python_base_url: str, timeout: float = 30.0):
        self.ts_base_url = ts_base_url.rstrip('/')
        self.python_base_url = python_base_url.rstrip('/')
        self.timeout = timeout

    async def invoke(self, method: str, path: str, headers: Optional[Dict[str, str]] = None,
                     body: Optional[Any] = None) -> ComparisonResult:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            ts_task = self._call_backend(client, self.ts_base_url, method, path, headers, body)
            python_task = self._call_backend(client, self.python_base_url, method, path, headers, body)

            ts_resp, python_resp = await asyncio.gather(ts_task, python_task, return_exceptions=True)

            ts_response = self._handle_response(ts_resp)
            python_response = self._handle_response(python_resp)

            return ComparisonResult(
                ts_response=ts_response,
                python_response=python_response,
                differences=[]
            )

    async def _call_backend(self, client: httpx.AsyncClient, base_url: str, method: str,
                           path: str, headers: Optional[Dict[str, str]], body: Optional[Any]) -> httpx.Response:
        url = f"{base_url}{path}"
        return await client.request(method, url, headers=headers, json=body)

    def _handle_response(self, resp) -> BackendResponse:
        if isinstance(resp, Exception):
            return BackendResponse(status_code=0, headers={}, body={"error": str(resp)})
        return BackendResponse(
            status_code=resp.status_code,
            headers=dict(resp.headers),
            body=resp.json() if resp.headers.get('content-type', '').startswith('application/json') else resp.text
        )
