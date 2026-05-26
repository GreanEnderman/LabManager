from typing import Any, Dict, List
from deepdiff import DeepDiff

class ResponseComparator:
    def __init__(self, allowlist: List[str] = None):
        self.allowlist = allowlist or []

    def compare(self, ts_response, python_response) -> List[Dict[str, Any]]:
        differences = []

        if ts_response.status_code != python_response.status_code:
            differences.append({
                "type": "status_code",
                "ts": ts_response.status_code,
                "python": python_response.status_code
            })

        header_diffs = self._compare_headers(ts_response.headers, python_response.headers)
        differences.extend(header_diffs)

        body_diffs = self._compare_bodies(ts_response.body, python_response.body)
        differences.extend(body_diffs)

        return [d for d in differences if not self._is_allowlisted(d)]

    def _compare_headers(self, ts_headers: Dict[str, str], python_headers: Dict[str, str]) -> List[Dict[str, Any]]:
        ignore_headers = {'date', 'server', 'x-request-id', 'x-response-time'}
        ts_filtered = {k.lower(): v for k, v in ts_headers.items() if k.lower() not in ignore_headers}
        python_filtered = {k.lower(): v for k, v in python_headers.items() if k.lower() not in ignore_headers}

        diff = DeepDiff(ts_filtered, python_filtered, ignore_order=True)
        if diff:
            return [{"type": "headers", "diff": diff.to_dict()}]
        return []

    def _compare_bodies(self, ts_body: Any, python_body: Any) -> List[Dict[str, Any]]:
        diff = DeepDiff(ts_body, python_body, ignore_order=True)
        if diff:
            return [{"type": "body", "diff": diff.to_dict()}]
        return []

    def _is_allowlisted(self, difference: Dict[str, Any]) -> bool:
        for pattern in self.allowlist:
            if self._matches_pattern(difference, pattern):
                return True
        return False

    def _matches_pattern(self, difference: Dict[str, Any], pattern: str) -> bool:
        return pattern in str(difference)
