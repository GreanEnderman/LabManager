"""Rules engine orchestrating classification and audit."""

from pydantic import ValidationError
from .models import EventInput, EventOutput, AuditContext
from .classifier import EventClassifier


class RulesEngine:
    """Main rules engine for event processing."""

    def __init__(self):
        self.classifier = EventClassifier()

    def _validate_audit(self, audit: AuditContext) -> None:
        """Validate audit context has required fields."""
        if not audit.run_id or not audit.operator:
            raise ValueError("Missing required audit fields: runId and operator")

    def process_event(self, event: EventInput) -> EventOutput:
        """Process event with classification and audit."""
        # Validate audit context
        self._validate_audit(event.audit)

        # Classify and extract metadata
        metadata = self.classifier.route_event(event)

        # Build output with audit context propagated
        return EventOutput(
            event_type=event.event_type,
            metadata=metadata,
            audit=event.audit,
            deduplicated=False,
        )
