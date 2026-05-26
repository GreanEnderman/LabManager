from tests.regression.adjudication.models import Adjudication, AdjudicationCategory
from tests.regression.adjudication.storage import AdjudicationStorage

class ReviewerWorkflow:
    def __init__(self):
        self.storage = AdjudicationStorage()

    def validate_adjudication(self, adjudication: Adjudication) -> tuple[bool, str]:
        """Validate if adjudication meets requirements"""

        if adjudication.category == AdjudicationCategory.ACCEPTABLE:
            if len(adjudication.reviewers) < 2:
                return False, "Acceptable category requires two reviewers"

            reviewer_emails = [r.email for r in adjudication.reviewers]
            if len(set(reviewer_emails)) < 2:
                return False, "Two different reviewers required"

        if not adjudication.justification or len(adjudication.justification.strip()) < 10:
            return False, "Justification must be at least 10 characters"

        return True, "Valid"

    def can_approve_traffic_switch(self) -> tuple[bool, list[str]]:
        """Check if traffic switch can proceed"""
        blocking_issues = []

        all_adjudications = self.storage.list_all()

        for adj in all_adjudications:
            if adj.is_blocking():
                blocking_issues.append(f"{adj.diff_id}: {adj.category.value}")

            if adj.requires_second_reviewer():
                blocking_issues.append(f"{adj.diff_id}: needs second reviewer")

        return len(blocking_issues) == 0, blocking_issues
