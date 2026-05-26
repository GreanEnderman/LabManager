"""Supervisor graph V1 for LabManager AI event orchestration."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, TypedDict
from uuid import uuid4

from langgraph.graph import END, START, StateGraph

from app.core.event_mappings import EventMappings
from app.graphs.tools import InMemorySupervisorTools, SupervisorTools


HandlerName = Literal["inventory_agent", "maintenance_agent", "fault_agent", "ignore"]


class SupervisorState(TypedDict, total=False):
    event: dict[str, Any]
    actor: dict[str, Any]
    normalizedEvent: dict[str, Any]
    ruleDecision: dict[str, Any]
    supervisorDecision: dict[str, Any]
    handlerResult: dict[str, Any]
    recommendation: dict[str, Any]
    approvalDecision: dict[str, Any]
    taskDraft: dict[str, Any]
    approvalDraft: dict[str, Any] | None
    createdTask: dict[str, Any] | None
    createdApproval: dict[str, Any] | None
    persistedActivityLogs: list[dict[str, Any]]
    activityLogDrafts: list[dict[str, Any]]
    retrievedMemories: list[dict[str, Any]]  # Memory integration
    output: dict[str, Any]
    errors: list[str]
    lastStep: str


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def append_log(
    state: SupervisorState,
    action_type: str,
    detail: str,
    node: str,
    task_id: str | None = None,
    approval_id: str | None = None,
) -> None:
    logs = state.setdefault("activityLogDrafts", [])
    logs.append(
        {
            "id": f"action-{uuid4()}",
            "actionType": action_type,
            "detail": detail,
            "node": node,
            "taskId": task_id,
            "approvalId": approval_id,
            "actor": state.get("actor") or {"id": "system", "name": "System", "type": "system"},
            "reasonCodes": [action_type],
            "toolName": "supervisor_graph_v1",
            "snapshot": {"node": node, "result": detail},
            "createdAt": utc_now(),
        }
    )


def finalize_activity_log_drafts(state: SupervisorState) -> list[dict[str, Any]]:
    task_id = (state.get("createdTask") or {}).get("id")
    approval_id = (state.get("createdApproval") or {}).get("id")
    finalized: list[dict[str, Any]] = []
    for draft in state.get("activityLogDrafts", []):
        record = dict(draft)
        if task_id and not record.get("taskId"):
            record["taskId"] = task_id
        if approval_id and not record.get("approvalId") and record.get("actionType", "").startswith("approval_"):
            record["approvalId"] = approval_id
        snapshot = dict(record.get("snapshot") or {})
        snapshot.setdefault("node", record.get("node"))
        snapshot.setdefault("result", record.get("detail"))
        snapshot.setdefault("lastStep", state.get("lastStep"))
        record["snapshot"] = snapshot
        finalized.append(record)
    return finalized


def event_ingestor(state: SupervisorState) -> SupervisorState:
    state["lastStep"] = "event_ingestor"
    state.setdefault("errors", [])
    state.setdefault("activityLogDrafts", [])
    state.setdefault("actor", {"id": "system", "name": "System", "type": "system"})
    append_log(state, "event_ingested", "AI event accepted by supervisor graph.", "event_ingestor")
    return state


def normalize_event(state: SupervisorState) -> SupervisorState:
    raw = state.get("event") or {}
    event_type = raw.get("type")
    normalized = {
        "id": raw.get("id") or f"event-{uuid4()}",
        "type": event_type,
        "sourceType": raw.get("sourceType") or "system",
        "sourceId": raw.get("sourceId") or "unknown",
        "sourceName": raw.get("sourceName") or "Unknown source",
        "title": raw.get("title") or "AI event",
        "summary": raw.get("summary") or "Event submitted to AI supervisor.",
        "priority": raw.get("priority") or "medium",
        "riskLevel": raw.get("riskLevel") or "medium",
        "createdAt": raw.get("createdAt") or utc_now(),
        "evidence": raw.get("evidence") or [],
        "metadata": raw.get("metadata") or {},
    }
    if event_type not in {"low_stock", "maintenance_overdue", "equipment_fault"}:
        state.setdefault("errors", []).append(f"Unsupported event type: {event_type}")
    state["normalizedEvent"] = normalized
    state["lastStep"] = "normalize_event"
    append_log(state, "event_normalized", f"Normalized event {normalized['id']}.", "normalize_event")
    return state


def build_rule_gate_node(tools: SupervisorTools):
    """Factory function for rule_gate node with injected RulesEngine."""

    async def rule_gate(state: SupervisorState) -> SupervisorState:
        event = state["normalizedEvent"]
        errors = state.get("errors", [])
        actor = state.get("actor", {})

        # Use injected rules_adapter to evaluate rule (async)
        decision = await tools.rules_adapter.evaluate_rule_async(event, actor, errors)
        state["ruleDecision"] = decision
        state["lastStep"] = "rule_gate"

        append_log(state, "rule_gate_evaluated", decision["reason"], "rule_gate")
        return state

    return rule_gate


def should_continue_after_rule_gate(state: SupervisorState) -> str:
    decision = state["ruleDecision"]
    if not decision["isValidEvent"] or decision["route"] == "ignore":
        return "write_activity_log"
    return "memory_retrieval"


def supervisor_router(state: SupervisorState) -> SupervisorState:
    event = state["normalizedEvent"]
    decision = state["ruleDecision"]
    route = decision["route"]
    handler: HandlerName = "ignore"
    if route == "inventory":
        handler = "inventory_agent"
    elif route == "maintenance":
        handler = "maintenance_agent"
    elif route == "fault":
        handler = "fault_agent"

    queue = "urgent" if event["riskLevel"] in {"high", "critical"} else "priority"
    if event["priority"] in {"low", "P2"}:
        queue = "routine"

    state["supervisorDecision"] = {
        "handler": handler,
        "queue": queue,
        "reason": f"Supervisor routed {event['type']} to {handler}.",
        "escalationTarget": "supervisor" if decision["requiresApproval"] else None,
    }
    state["lastStep"] = "supervisor_router"
    append_log(state, "supervisor_routed", state["supervisorDecision"]["reason"], "supervisor_router")
    return state


def choose_handler(state: SupervisorState) -> str:
    return state["supervisorDecision"]["handler"]


def inventory_agent(state: SupervisorState) -> SupervisorState:
    event = state["normalizedEvent"]
    task_type = EventMappings.event_to_compat_task_type(event["type"])
    task = build_task_draft(event, task_type, "Review stock and prepare a restock request.", "warehouse-manager")
    state["taskDraft"] = task
    state["handlerResult"] = {
        "handler": "inventory_agent",
        "summary": f"Inventory agent prepared restock follow-up for {event['sourceName']}.",
        "suggestedAssigneeRole": "warehouse-manager",
        "followUpActions": ["verify_stock", "prepare_restock_request"],
        "metadata": {},
    }
    state["lastStep"] = "inventory_agent"
    append_log(state, "handler_completed", state["handlerResult"]["summary"], "inventory_agent")
    return state


def maintenance_agent(state: SupervisorState) -> SupervisorState:
    event = state["normalizedEvent"]
    task_type = EventMappings.event_to_compat_task_type(event["type"])
    task = build_task_draft(event, task_type, "Schedule maintenance and confirm equipment availability.", "equipment-manager")
    state["taskDraft"] = task
    state["handlerResult"] = {
        "handler": "maintenance_agent",
        "summary": f"Maintenance agent prepared maintenance follow-up for {event['sourceName']}.",
        "suggestedAssigneeRole": "equipment-manager",
        "followUpActions": ["schedule_maintenance", "confirm_maintenance_record"],
        "metadata": {},
    }
    state["lastStep"] = "maintenance_agent"
    append_log(state, "handler_completed", state["handlerResult"]["summary"], "maintenance_agent")
    return state


def fault_agent(state: SupervisorState) -> SupervisorState:
    event = state["normalizedEvent"]
    task_type = EventMappings.event_to_compat_task_type(event["type"])
    task = build_task_draft(event, task_type, "Repair the equipment and upload a repair report before completion.", "equipment-manager")
    state["taskDraft"] = task
    state["handlerResult"] = {
        "handler": "fault_agent",
        "summary": f"Fault agent prepared repair follow-up for {event['sourceName']}.",
        "suggestedAssigneeRole": "equipment-manager",
        "followUpActions": ["isolate_if_needed", "repair_equipment", "upload_repair_report"],
        "metadata": {},
    }
    state["lastStep"] = "fault_agent"
    append_log(state, "handler_completed", state["handlerResult"]["summary"], "fault_agent")
    return state


def build_task_draft(event: dict[str, Any], task_type: str, recommendation: str, assignee_role: str) -> dict[str, Any]:
    now = utc_now()
    return {
        "id": f"task-draft-{uuid4()}",
        "eventId": event["id"],
        "type": task_type,
        "title": event["title"],
        "summary": event["summary"],
        "recommendation": recommendation,
        "status": "open",
        "priority": event["priority"],
        "riskLevel": event["riskLevel"],
        "sourceType": event["sourceType"],
        "sourceId": event["sourceId"],
        "sourceName": event["sourceName"],
        "assigneeRole": assignee_role,
        "requiresApproval": False,
        "dueAt": (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat().replace("+00:00", "Z"),
        "createdAt": now,
        "updatedAt": now,
        "metadata": {"evidence": event.get("evidence", [])},
    }


def build_recommendation_builder_node(tools: SupervisorTools, llm_service: Any = None):
    """Factory function for recommendation_builder node with optional LLM service.

    Args:
        tools: Supervisor tools for task/approval/audit operations
        llm_service: Optional LLM service for generating recommendations

    Returns:
        Async recommendation_builder node function
    """
    async def recommendation_builder(state: SupervisorState) -> SupervisorState:
        handler_result = state["handlerResult"]
        task = state["taskDraft"]
        event = state["normalizedEvent"]

        # Try to use LLM if available
        if llm_service is not None:
            try:
                # Prepare context for LLM
                context = {
                    "handlerResult": handler_result,
                    "taskDraft": task,
                    "event": event,
                }

                # Call LLM to generate recommendation
                llm_result = await llm_service.generate_recommendation(event, context)

                state["recommendation"] = {
                    "reason": llm_result.reason,
                    "riskSummary": llm_result.risk_summary,
                    "actionSummary": llm_result.action_summary,
                }

                # Record LLM metadata in task draft
                task["metadata"]["llmUsed"] = llm_result.meta.get("llmUsed", True)
                task["metadata"]["llmProvider"] = llm_result.meta.get("provider")
                task["metadata"]["llmModel"] = llm_result.meta.get("model")

            except Exception as e:
                # Fallback to template-based recommendation on error
                state["recommendation"] = {
                    "reason": handler_result["summary"],
                    "riskSummary": f"Risk level is {task['riskLevel']}.",
                    "actionSummary": task["recommendation"],
                }
                task["metadata"]["llmUsed"] = False
                task["metadata"]["llmFallbackReason"] = str(e)
        else:
            # No LLM service provided, use template
            state["recommendation"] = {
                "reason": handler_result["summary"],
                "riskSummary": f"Risk level is {task['riskLevel']}.",
                "actionSummary": task["recommendation"],
            }
            task["metadata"]["llmUsed"] = False

        state["lastStep"] = "recommendation_builder"
        append_log(state, "recommendation_built", state["recommendation"]["actionSummary"], "recommendation_builder")
        return state

    return recommendation_builder


def approval_gate(state: SupervisorState) -> SupervisorState:
    event = state["normalizedEvent"]
    rule_decision = state["ruleDecision"]
    task = state["taskDraft"]
    needs_approval = bool(rule_decision["requiresApproval"])
    task["requiresApproval"] = needs_approval
    state["approvalDecision"] = {
        "requiresApproval": needs_approval,
        "reason": "High-risk event requires supervisor approval." if needs_approval else "Approval not required.",
    }
    state["approvalDraft"] = (
        {
            "id": f"approval-draft-{uuid4()}",
            "taskId": task["id"],
            "title": f"{event['title']} approval",
            "reason": state["approvalDecision"]["reason"],
            "status": "pending",
            "riskLevel": event["riskLevel"],
            "createdAt": utc_now(),
            "metadata": {},
        }
        if needs_approval
        else None
    )
    state["lastStep"] = "approval_gate"
    append_log(state, "approval_gate_evaluated", state["approvalDecision"]["reason"], "approval_gate")
    return state


def needs_approval_branch(state: SupervisorState) -> str:
    return "create_approval" if state["approvalDecision"]["requiresApproval"] else "write_activity_log"


def build_create_or_update_task_node(tools: SupervisorTools):
    async def create_or_update_task(state: SupervisorState) -> SupervisorState:
        task_draft = state.get("taskDraft")
        rule_decision = state.get("ruleDecision", {})

        # Check if deduplication already happened in rule_gate
        if rule_decision.get("dedupeHit"):
            # Use the existing task ID from rule_decision
            existing_task_id = rule_decision.get("existingTaskId")
            if existing_task_id:
                # Create a minimal task representation for the existing task
                existing = {
                    "id": existing_task_id,
                    "status": "open",  # Assume open since it was found by dedup logic
                }
                state["createdTask"] = existing
                state["output"] = {
                    "taskId": None,
                    "task": existing,
                    "context": {"existingOpenTask": {"id": existing_task_id}},
                    "approval": None,
                }
                append_log(
                    state,
                    "task_deduplicated",
                    f"Existing open task {existing_task_id} reused (detected by RulesEngine).",
                    "create_or_update_task",
                    task_id=existing_task_id,
                )
            else:
                # Dedup flag was set but no existing task ID - create new one
                created = await tools.task_tool.create_task(task_draft, actor=state.get("actor"))
                state["createdTask"] = created
                state["output"] = {
                    "taskId": created["id"],
                    "task": created,
                    "context": {"existingOpenTask": None},
                    "approval": None,
                }
                append_log(
                    state,
                    "task_created",
                    f"Task {created['id']} created (dedup flag set but no existing task ID).",
                    "create_or_update_task",
                    task_id=created["id"],
                )
        else:
            # No deduplication - create new task
            created = await tools.task_tool.create_task(task_draft, actor=state.get("actor"))
            state["createdTask"] = created
            state["output"] = {
                "taskId": created["id"],
                "task": created,
                "context": {"existingOpenTask": None},
                "approval": None,
            }
            append_log(
                state,
                "task_created",
                f"Task {created['id']} created from supervisor graph.",
                "create_or_update_task",
                task_id=created["id"],
            )
        state["lastStep"] = "create_or_update_task"
        return state

    return create_or_update_task


def build_create_approval_node(tools: SupervisorTools):
    async def create_approval(state: SupervisorState) -> SupervisorState:
        approval_draft = dict(state.get("approvalDraft") or {})
        task = state.get("createdTask")
        if task:
            approval_draft["taskId"] = task["id"]
        created = await tools.approval_tool.create_approval(approval_draft, actor=state.get("actor"))
        state["createdApproval"] = created
        state["output"]["approval"] = created
        append_log(
            state,
            "approval_requested",
            f"Approval {created['id']} created from supervisor graph.",
            "create_approval",
            task_id=approval_draft.get("taskId"),
            approval_id=created["id"],
        )
        state["lastStep"] = "create_approval"
        return state

    return create_approval


def build_write_activity_log_node(tools: SupervisorTools):
    async def write_activity_log(state: SupervisorState) -> SupervisorState:
        finalized_drafts = finalize_activity_log_drafts(state)
        state["activityLogDrafts"] = finalized_drafts
        persisted = await tools.audit_log_tool.write_many(finalized_drafts)
        state["persistedActivityLogs"] = persisted
        output = state.setdefault("output", {})
        output["activityLogs"] = persisted
        output["activityLogCount"] = len(persisted)
        output["errors"] = state.get("errors", [])
        state["lastStep"] = "write_activity_log"
        return state

    return write_activity_log


def build_memory_retrieval_node(tools: SupervisorTools):
    """Factory function for memory_retrieval node."""

    async def memory_retrieval(state: SupervisorState) -> SupervisorState:
        """Retrieve relevant memories based on the event context."""
        event = state["normalizedEvent"]

        # Skip if no memory tool available
        if not tools.memory_tool:
            state["retrievedMemories"] = []
            state["lastStep"] = "memory_retrieval"
            return state

        # Build context key from event
        event_type = event.get("type", "unknown")
        source_id = event.get("sourceId", "unknown")
        context_key = f"{event_type}_{source_id}"

        # Query relevant memories
        try:
            memories = await tools.memory_tool.query_memories(
                context_key=context_key,
                category="task_execution",
                min_confidence=0.3
            )
            state["retrievedMemories"] = memories

            append_log(
                state,
                "memory_retrieved",
                f"Retrieved {len(memories)} relevant memories for context '{context_key}'",
                "memory_retrieval"
            )
        except Exception as e:
            # Gracefully handle memory retrieval failures
            state["retrievedMemories"] = []
            state.setdefault("errors", []).append(f"Memory retrieval failed: {str(e)}")
            append_log(
                state,
                "memory_retrieval_failed",
                f"Failed to retrieve memories: {str(e)}",
                "memory_retrieval"
            )

        state["lastStep"] = "memory_retrieval"
        return state

    return memory_retrieval


def build_supervisor_graph(tools: SupervisorTools | None = None, llm_service: Any = None) -> StateGraph:
    """Build the supervisor graph with optional LLM service.

    Args:
        tools: Supervisor tools for task/approval/audit operations
        llm_service: Optional LLM service for generating recommendations

    Returns:
        Compiled StateGraph ready for execution
    """
    toolset = tools or InMemorySupervisorTools()
    graph = StateGraph(SupervisorState)

    graph.add_node("event_ingestor", event_ingestor)
    graph.add_node("normalize_event", normalize_event)
    graph.add_node("rule_gate", build_rule_gate_node(toolset))
    graph.add_node("memory_retrieval", build_memory_retrieval_node(toolset))
    graph.add_node("supervisor_router", supervisor_router)
    graph.add_node("inventory_agent", inventory_agent)
    graph.add_node("maintenance_agent", maintenance_agent)
    graph.add_node("fault_agent", fault_agent)
    graph.add_node("recommendation_builder", build_recommendation_builder_node(toolset, llm_service))
    graph.add_node("approval_gate", approval_gate)
    graph.add_node("create_or_update_task", build_create_or_update_task_node(toolset))
    graph.add_node("create_approval", build_create_approval_node(toolset))
    graph.add_node("write_activity_log", build_write_activity_log_node(toolset))

    graph.add_edge(START, "event_ingestor")
    graph.add_edge("event_ingestor", "normalize_event")
    graph.add_edge("normalize_event", "rule_gate")
    graph.add_conditional_edges(
        "rule_gate",
        should_continue_after_rule_gate,
        {
            "memory_retrieval": "memory_retrieval",
            "write_activity_log": "write_activity_log",
        },
    )
    graph.add_edge("memory_retrieval", "supervisor_router")
    graph.add_conditional_edges(
        "supervisor_router",
        choose_handler,
        {
            "inventory_agent": "inventory_agent",
            "maintenance_agent": "maintenance_agent",
            "fault_agent": "fault_agent",
            "ignore": "write_activity_log",
        },
    )
    graph.add_edge("inventory_agent", "recommendation_builder")
    graph.add_edge("maintenance_agent", "recommendation_builder")
    graph.add_edge("fault_agent", "recommendation_builder")
    graph.add_edge("recommendation_builder", "approval_gate")
    graph.add_edge("approval_gate", "create_or_update_task")
    graph.add_conditional_edges(
        "create_or_update_task",
        needs_approval_branch,
        {
            "create_approval": "create_approval",
            "write_activity_log": "write_activity_log",
        },
    )
    graph.add_edge("create_approval", "write_activity_log")
    graph.add_edge("write_activity_log", END)
    return graph


def build_supervisor_preview_graph(tools: SupervisorTools | None = None, llm_service: Any = None) -> StateGraph:
    """Build a read-only supervisor graph for recommendation previews.

    The preview graph stops before task, approval, and audit-log persistence.
    It still runs rule evaluation, routing, handlers, recommendation building,
    and approval gating so the UI can show the same draft content that execute
    would use.
    """
    toolset = tools or InMemorySupervisorTools()
    graph = StateGraph(SupervisorState)

    graph.add_node("event_ingestor", event_ingestor)
    graph.add_node("normalize_event", normalize_event)
    graph.add_node("rule_gate", build_rule_gate_node(toolset))
    graph.add_node("memory_retrieval", build_memory_retrieval_node(toolset))
    graph.add_node("supervisor_router", supervisor_router)
    graph.add_node("inventory_agent", inventory_agent)
    graph.add_node("maintenance_agent", maintenance_agent)
    graph.add_node("fault_agent", fault_agent)
    graph.add_node("recommendation_builder", build_recommendation_builder_node(toolset, llm_service))
    graph.add_node("approval_gate", approval_gate)

    graph.add_edge(START, "event_ingestor")
    graph.add_edge("event_ingestor", "normalize_event")
    graph.add_edge("normalize_event", "rule_gate")
    graph.add_conditional_edges(
        "rule_gate",
        should_continue_after_rule_gate,
        {
            "memory_retrieval": "memory_retrieval",
            "write_activity_log": END,
        },
    )
    graph.add_edge("memory_retrieval", "supervisor_router")
    graph.add_conditional_edges(
        "supervisor_router",
        choose_handler,
        {
            "inventory_agent": "inventory_agent",
            "maintenance_agent": "maintenance_agent",
            "fault_agent": "fault_agent",
            "ignore": END,
        },
    )
    graph.add_edge("inventory_agent", "recommendation_builder")
    graph.add_edge("maintenance_agent", "recommendation_builder")
    graph.add_edge("fault_agent", "recommendation_builder")
    graph.add_edge("recommendation_builder", "approval_gate")
    graph.add_edge("approval_gate", END)
    return graph


async def run_supervisor_graph_async(
    event: dict[str, Any],
    actor: dict[str, Any] | None = None,
    tools: SupervisorTools | None = None,
    llm_service: Any = None,
) -> SupervisorState:
    """Run the supervisor graph asynchronously.

    Args:
        event: The AI event to process
        actor: The actor triggering the event
        tools: Supervisor tools for task/approval/audit operations
        llm_service: Optional LLM service for generating recommendations

    Returns:
        Final SupervisorState after graph execution
    """
    compiled = build_supervisor_graph(tools=tools, llm_service=llm_service).compile()
    return await compiled.ainvoke(
        {"event": event, "actor": actor or {"id": "system", "name": "System", "type": "system"}}
    )


async def run_supervisor_preview_graph_async(
    event: dict[str, Any],
    actor: dict[str, Any] | None = None,
    tools: SupervisorTools | None = None,
    llm_service: Any = None,
) -> SupervisorState:
    """Run the read-only supervisor graph for previewing recommendations."""
    compiled = build_supervisor_preview_graph(tools=tools, llm_service=llm_service).compile()
    return await compiled.ainvoke(
        {"event": event, "actor": actor or {"id": "system", "name": "System", "type": "system"}}
    )


def run_supervisor_graph(
    event: dict[str, Any],
    actor: dict[str, Any] | None = None,
    tools: SupervisorTools | None = None,
    llm_service: Any = None,
) -> SupervisorState:
    """Run the supervisor graph synchronously.

    Args:
        event: The AI event to process
        actor: The actor triggering the event
        tools: Supervisor tools for task/approval/audit operations
        llm_service: Optional LLM service for generating recommendations

    Returns:
        Final SupervisorState after graph execution
    """
    return asyncio.run(run_supervisor_graph_async(event=event, actor=actor, tools=tools, llm_service=llm_service))
