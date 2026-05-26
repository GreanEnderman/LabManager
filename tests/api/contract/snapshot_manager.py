import json
from pathlib import Path
from typing import Any, Dict


class SnapshotManager:
    def __init__(self, snapshot_dir: str = "tests/api/contract/snapshots"):
        self.snapshot_dir = Path(snapshot_dir)
        self.snapshot_dir.mkdir(parents=True, exist_ok=True)

    def save_snapshot(self, name: str, data: Dict[str, Any]):
        snapshot_path = self.snapshot_dir / f"{name}.json"
        with open(snapshot_path, "w") as f:
            json.dump(data, f, indent=2)

    def load_snapshot(self, name: str) -> Dict[str, Any]:
        snapshot_path = self.snapshot_dir / f"{name}.json"
        if not snapshot_path.exists():
            return None
        with open(snapshot_path, "r") as f:
            return json.load(f)

    def validate_schema(self, response_data: Dict[str, Any], required_fields: list) -> bool:
        return all(field in response_data for field in required_fields)
