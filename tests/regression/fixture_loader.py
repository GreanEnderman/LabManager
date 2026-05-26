import json
from pathlib import Path
from typing import Dict, Any, Optional

class FixtureLoader:
    def __init__(self, fixtures_dir: str = "tests/regression/fixtures"):
        self.fixtures_dir = Path(fixtures_dir)

    def load(self, fixture_name: str) -> Dict[str, Any]:
        fixture_path = self.fixtures_dir / f"{fixture_name}.json"
        if not fixture_path.exists():
            raise FileNotFoundError(f"Fixture not found: {fixture_path}")

        with open(fixture_path) as f:
            return json.load(f)

    def get_request_payload(self, fixture_name: str) -> Optional[Dict[str, Any]]:
        fixture = self.load(fixture_name)
        return fixture.get("request", {}).get("body")

    def get_request_headers(self, fixture_name: str) -> Optional[Dict[str, str]]:
        fixture = self.load(fixture_name)
        return fixture.get("request", {}).get("headers")

    def get_seed_data(self, fixture_name: str) -> Optional[Dict[str, Any]]:
        fixture = self.load(fixture_name)
        return fixture.get("seed_data")
