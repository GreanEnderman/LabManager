import json
from pathlib import Path
from typing import Optional, List
from datetime import datetime
from tests.regression.adjudication.models import Adjudication, AdjudicationCategory, Reviewer

class AdjudicationStorage:
    def __init__(self, storage_dir: str = "tests/regression/adjudication/data"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def get(self, diff_id: str) -> Optional[Adjudication]:
        filepath = self.storage_dir / f"{diff_id}.json"
        if not filepath.exists():
            return None

        with open(filepath) as f:
            data = json.load(f)

        return Adjudication(
            diff_id=data['diff_id'],
            category=AdjudicationCategory(data['category']),
            justification=data['justification'],
            reviewers=[
                Reviewer(
                    name=r['name'],
                    email=r['email'],
                    timestamp=datetime.fromisoformat(r['timestamp'])
                ) for r in data['reviewers']
            ],
            created_at=datetime.fromisoformat(data['created_at']),
            updated_at=datetime.fromisoformat(data['updated_at'])
        )

    def save(self, adjudication: Adjudication):
        filepath = self.storage_dir / f"{adjudication.diff_id}.json"

        data = {
            'diff_id': adjudication.diff_id,
            'category': adjudication.category.value,
            'justification': adjudication.justification,
            'reviewers': [
                {
                    'name': r.name,
                    'email': r.email,
                    'timestamp': r.timestamp.isoformat()
                } for r in adjudication.reviewers
            ],
            'created_at': adjudication.created_at.isoformat(),
            'updated_at': adjudication.updated_at.isoformat()
        }

        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)

    def list_all(self) -> List[Adjudication]:
        adjudications = []
        for filepath in self.storage_dir.glob("*.json"):
            adj = self.get(filepath.stem)
            if adj:
                adjudications.append(adj)
        return adjudications

    def get_blocking_count(self) -> int:
        return sum(1 for adj in self.list_all() if adj.is_blocking())
