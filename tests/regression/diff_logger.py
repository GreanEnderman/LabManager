import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

class DiffLogger:
    def __init__(self, output_dir: str = "tests/regression/diffs"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def log_difference(self, endpoint: str, method: str, fixture_name: str,
                      ts_response, python_response, differences: List[Dict[str, Any]]) -> str:
        timestamp = datetime.utcnow().isoformat()
        filename = f"{timestamp.replace(':', '-')}_{method}_{endpoint.replace('/', '_')}.json"
        filepath = self.output_dir / filename

        log_entry = {
            "timestamp": timestamp,
            "endpoint": endpoint,
            "method": method,
            "fixture": fixture_name,
            "ts_response": {
                "status_code": ts_response.status_code,
                "headers": ts_response.headers,
                "body": ts_response.body
            },
            "python_response": {
                "status_code": python_response.status_code,
                "headers": python_response.headers,
                "body": python_response.body
            },
            "differences": differences,
            "adjudication": None
        }

        with open(filepath, 'w') as f:
            json.dump(log_entry, f, indent=2)

        return str(filepath)
