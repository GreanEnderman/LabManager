import json
from pathlib import Path
from typing import Dict, Any, List

class DatabaseSeeder:
    def __init__(self, db_connection):
        self.db = db_connection

    async def seed_from_fixture(self, fixture_path: str):
        fixture_file = Path(fixture_path)
        if not fixture_file.exists():
            raise FileNotFoundError(f"Fixture not found: {fixture_path}")

        with open(fixture_file) as f:
            fixture_data = json.load(f)

        for table_name, records in fixture_data.get("seed_data", {}).items():
            await self._insert_records(table_name, records)

    async def _insert_records(self, table_name: str, records: List[Dict[str, Any]]):
        for record in records:
            columns = ", ".join(record.keys())
            placeholders = ", ".join([f"${i+1}" for i in range(len(record))])
            query = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
            await self.db.execute(query, *record.values())
