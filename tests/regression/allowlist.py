import json
from pathlib import Path
from typing import List, Dict, Any

class AllowlistManager:
    def __init__(self, config_path: str = "tests/regression/allowlist.json"):
        self.config_path = Path(config_path)
        self.config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        if not self.config_path.exists():
            return {"global": [], "endpoints": {}}
        with open(self.config_path) as f:
            return json.load(f)

    def get_allowlist(self, endpoint: str) -> List[str]:
        global_patterns = self.config.get("global", [])
        endpoint_patterns = self.config.get("endpoints", {}).get(endpoint, [])
        return global_patterns + endpoint_patterns

    def add_to_allowlist(self, endpoint: str, pattern: str, justification: str):
        if endpoint not in self.config["endpoints"]:
            self.config["endpoints"][endpoint] = []

        entry = {"pattern": pattern, "justification": justification}
        self.config["endpoints"][endpoint].append(entry)
        self._save_config()

    def _save_config(self):
        with open(self.config_path, 'w') as f:
            json.dump(self.config, f, indent=2)

    def is_allowlisted(self, endpoint: str, difference: Dict[str, Any]) -> bool:
        allowlist = self.get_allowlist(endpoint)
        diff_str = json.dumps(difference)

        for item in allowlist:
            pattern = item if isinstance(item, str) else item.get("pattern", "")
            if pattern in diff_str:
                return True
        return False
