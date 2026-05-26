from dataclasses import dataclass
from datetime import datetime
from typing import Optional, List
from enum import Enum

class AdjudicationCategory(Enum):
    UNADJUDICATED = "unadjudicated"
    ACCEPTABLE = "acceptable"
    PYTHON_CORRECT = "python-correct"
    TS_CORRECT = "ts-correct"
    NEEDS_DISCUSSION = "needs-discussion"

@dataclass
class Reviewer:
    name: str
    email: str
    timestamp: datetime

@dataclass
class Adjudication:
    diff_id: str
    category: AdjudicationCategory
    justification: str
    reviewers: List[Reviewer]
    created_at: datetime
    updated_at: datetime

    def is_blocking(self) -> bool:
        return self.category in [
            AdjudicationCategory.UNADJUDICATED,
            AdjudicationCategory.TS_CORRECT,
            AdjudicationCategory.NEEDS_DISCUSSION
        ]

    def requires_second_reviewer(self) -> bool:
        return self.category == AdjudicationCategory.ACCEPTABLE and len(self.reviewers) < 2
