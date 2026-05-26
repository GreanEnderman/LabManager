"""Rules processing API endpoints.

NOTE: These endpoints are not directly used by the frontend.
Frontend accesses rules through the compatibility layer at /api/ai/rules/*.

These endpoints serve as:
1. Internal API for future direct integration
2. Reference implementation for the compatibility layer
3. Testing and development interface

See: docs/api-connection-analysis.md for connection mapping.
"""

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from app.core.errors import validation_error
from ..rules.models import EventInput, EventOutput
from ..rules.engine import RulesEngine
from ..gateway.adapter import ProtocolAdapter

router = APIRouter(prefix="/rules", tags=["rules"])

# Initialize engine and adapter
rules_engine = RulesEngine()
protocol_adapter = ProtocolAdapter()


@router.post("/process", response_model=dict)
async def process_event(event: dict) -> dict:
    """Process event through rules engine with protocol adaptation."""
    try:
        # Adapt TS input to Python format
        python_input = protocol_adapter.ts_to_python(event)

        # Parse and validate
        event_input = EventInput(**python_input)

        # Process through rules engine
        output = rules_engine.process_event(event_input)

        # Adapt Python output to TS format
        ts_output = protocol_adapter.python_to_ts(output.model_dump())

        return ts_output

    except ValidationError as e:
        raise validation_error("Event validation failed", {"errors": e.errors()})
    except ValueError as e:
        raise validation_error(str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": "internal_error", "message": str(e)})
