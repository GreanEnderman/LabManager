from app.graphs.supervisor import run_supervisor_graph
from app.graphs.tools import InMemorySupervisorTools


def test_supervisor_graph_routes_low_stock_to_inventory_agent() -> None:
    tools = InMemorySupervisorTools()
    state = run_supervisor_graph(
        {
            "id": "event-low-stock-test",
            "type": "low_stock",
            "sourceType": "chemical",
            "sourceId": "chem-001",
            "sourceName": "Hydrochloric acid",
            "title": "Low stock detected",
            "summary": "Quantity is below threshold.",
            "priority": "medium",
            "riskLevel": "medium",
            "evidence": [{"label": "Current quantity", "value": 1}],
        },
        actor={"id": "tester", "name": "Tester", "type": "user"},
        tools=tools,
    )

    assert state["supervisorDecision"]["handler"] == "inventory_agent"
    assert state["handlerResult"]["handler"] == "inventory_agent"
    assert state["taskDraft"]["type"] == "restock"
    assert state["createdTask"]["id"].startswith("task-")
    assert state["approvalDraft"] is None
    assert state["output"]["taskId"] == state["createdTask"]["id"]
    assert state["output"]["activityLogCount"] > 0
    assert tools.tasks[0]["id"] == state["createdTask"]["id"]
    assert any(log["actionType"] == "task_created" for log in state["persistedActivityLogs"])
    assert all(log["taskId"] == state["createdTask"]["id"] for log in state["persistedActivityLogs"])


def test_supervisor_graph_routes_fault_to_approval_path() -> None:
    tools = InMemorySupervisorTools()
    state = run_supervisor_graph(
        {
            "id": "event-fault-test",
            "type": "equipment_fault",
            "sourceType": "equipment",
            "sourceId": "equip-001",
            "sourceName": "HPLC",
            "title": "Equipment abnormal",
            "summary": "Equipment reported abnormal status.",
            "priority": "high",
            "riskLevel": "high",
        },
        actor={"id": "tester", "name": "Tester", "type": "user"},
        tools=tools,
    )

    assert state["supervisorDecision"]["handler"] == "fault_agent"
    assert state["taskDraft"]["type"] == "anomaly_review"
    assert state["taskDraft"]["requiresApproval"] is True
    assert state["approvalDecision"]["requiresApproval"] is True
    assert state["createdApproval"]["status"] == "pending"
    assert state["output"]["approval"]["id"] == state["createdApproval"]["id"]
    assert tools.approvals[0]["id"] == state["createdApproval"]["id"]
    assert all(log["taskId"] == state["createdTask"]["id"] for log in state["persistedActivityLogs"])
    assert any(
        log["actionType"] == "approval_requested" and log["approvalId"] == state["createdApproval"]["id"]
        for log in state["persistedActivityLogs"]
    )


def test_supervisor_graph_ignores_unknown_event_type() -> None:
    tools = InMemorySupervisorTools()
    state = run_supervisor_graph(
        {
            "id": "event-unknown-test",
            "type": "unknown",
            "sourceName": "Unknown source",
        },
        tools=tools,
    )

    assert state["ruleDecision"]["isValidEvent"] is False
    assert "Unsupported event type" in state["output"]["errors"][0]
    assert "taskDraft" not in state
    assert state["output"]["activityLogCount"] > 0
    assert tools.tasks == []


def test_supervisor_graph_reuses_existing_open_task() -> None:
    existing_task = {
        "id": "task-existing-001",
        "eventId": "event-dup-test",
        "type": "restock",
        "status": "open",
        "sourceId": "chem-dup",
    }
    tools = InMemorySupervisorTools(tasks=[existing_task])

    state = run_supervisor_graph(
        {
            "id": "event-dup-test",
            "type": "low_stock",
            "sourceType": "chemical",
            "sourceId": "chem-dup",
            "sourceName": "Duplicate chemical",
            "title": "Duplicate low stock",
            "summary": "Should reuse open task.",
        },
        tools=tools,
    )

    assert state["ruleDecision"]["dedupeHit"] is True
    assert state["output"]["taskId"] is None
    assert state["output"]["context"]["existingOpenTask"]["id"] == "task-existing-001"


def test_supervisor_graph_routes_maintenance_overdue_to_maintenance_agent() -> None:
    """Test that maintenance_overdue events are routed to maintenance agent."""
    tools = InMemorySupervisorTools()
    state = run_supervisor_graph(
        {
            "id": "event-maintenance-test",
            "type": "maintenance_overdue",
            "sourceType": "equipment",
            "sourceId": "equip-002",
            "sourceName": "Centrifuge",
            "title": "Maintenance overdue",
            "summary": "Equipment maintenance is 5 days overdue.",
            "priority": "high",
            "riskLevel": "medium",
            "evidence": [{"label": "Days overdue", "value": 5}],
        },
        actor={"id": "tester", "name": "Tester", "type": "user"},
        tools=tools,
    )

    assert state["supervisorDecision"]["handler"] == "maintenance_agent"
    assert state["handlerResult"]["handler"] == "maintenance_agent"
    assert state["taskDraft"]["type"] == "maintenance"
    assert state["taskDraft"]["assigneeRole"] == "equipment-manager"
    assert state["createdTask"]["id"].startswith("task-")
    assert state["output"]["taskId"] == state["createdTask"]["id"]
    assert tools.tasks[0]["type"] == "maintenance"


def test_supervisor_graph_creates_approval_for_high_risk_events() -> None:
    """Test that high-risk events trigger approval creation."""
    tools = InMemorySupervisorTools()
    state = run_supervisor_graph(
        {
            "id": "event-high-risk-test",
            "type": "equipment_fault",
            "sourceType": "equipment",
            "sourceId": "equip-critical",
            "sourceName": "Critical Equipment",
            "title": "Critical equipment fault",
            "summary": "Critical equipment reported failure.",
            "priority": "high",
            "riskLevel": "high",
        },
        actor={"id": "tester", "name": "Tester", "type": "user"},
        tools=tools,
    )

    # Verify approval was created
    assert state["approvalDecision"]["requiresApproval"] is True
    assert state["createdApproval"] is not None
    assert state["createdApproval"]["status"] == "pending"
    assert state["createdApproval"]["taskId"] == state["createdTask"]["id"]
    assert state["createdApproval"]["riskLevel"] == "high"

    # Verify approval is in tools storage
    assert len(tools.approvals) == 1
    assert tools.approvals[0]["id"] == state["createdApproval"]["id"]


def test_supervisor_graph_activity_logs_contain_all_required_fields() -> None:
    """Test that activity logs contain all required fields."""
    tools = InMemorySupervisorTools()
    state = run_supervisor_graph(
        {
            "id": "event-log-test",
            "type": "low_stock",
            "sourceType": "chemical",
            "sourceId": "chem-log",
            "sourceName": "Test Chemical",
            "title": "Test event for logging",
            "summary": "Testing activity log completeness.",
        },
        actor={"id": "test-user", "name": "Test User", "type": "user"},
        tools=tools,
    )

    logs = state["persistedActivityLogs"]
    assert len(logs) > 0

    # Check each log has required fields
    for log in logs:
        assert "id" in log
        assert "actionType" in log
        assert "detail" in log
        assert "node" in log
        assert "actor" in log
        assert log["actor"]["id"] == "test-user"
        assert log["actor"]["name"] == "Test User"
        assert "reasonCodes" in log
        assert "toolName" in log
        assert "snapshot" in log
        assert "createdAt" in log

        # Logs should have taskId after task creation
        if log["actionType"] in ["task_created", "recommendation_built"]:
            assert "taskId" in log
            assert log["taskId"] == state["createdTask"]["id"]


def test_supervisor_graph_handles_invalid_event_gracefully() -> None:
    """Test that invalid events are handled without crashing."""
    tools = InMemorySupervisorTools()
    state = run_supervisor_graph(
        {
            "id": "event-invalid-test",
            "type": "invalid_type",
            "sourceName": "Invalid Event",
        },
        tools=tools,
    )

    assert state["ruleDecision"]["isValidEvent"] is False
    assert len(state["errors"]) > 0
    assert "Unsupported event type" in state["errors"][0]
    assert state["output"]["activityLogCount"] > 0
    assert len(tools.tasks) == 0
    assert len(tools.approvals) == 0


def test_supervisor_graph_recommendation_builder_generates_content() -> None:
    """Test that recommendation builder generates proper content."""
    tools = InMemorySupervisorTools()
    state = run_supervisor_graph(
        {
            "id": "event-recommendation-test",
            "type": "low_stock",
            "sourceType": "chemical",
            "sourceId": "chem-rec",
            "sourceName": "Test Chemical",
            "title": "Low stock",
            "summary": "Stock below threshold.",
        },
        tools=tools,
    )

    # Verify recommendation was built
    assert "recommendation" in state
    assert "reason" in state["recommendation"]
    assert "riskSummary" in state["recommendation"]
    assert "actionSummary" in state["recommendation"]

    # Verify recommendation content is not empty
    assert len(state["recommendation"]["reason"]) > 0
    assert len(state["recommendation"]["riskSummary"]) > 0
    assert len(state["recommendation"]["actionSummary"]) > 0


def test_supervisor_graph_task_draft_has_correct_metadata() -> None:
    """Test that task draft contains correct metadata."""
    tools = InMemorySupervisorTools()
    state = run_supervisor_graph(
        {
            "id": "event-metadata-test",
            "type": "maintenance_overdue",
            "sourceType": "equipment",
            "sourceId": "equip-meta",
            "sourceName": "Test Equipment",
            "title": "Maintenance overdue",
            "summary": "Testing metadata.",
            "evidence": [
                {"label": "Days overdue", "value": 3},
                {"label": "Last maintenance", "value": "2024-01-01"},
            ],
        },
        tools=tools,
    )

    task_draft = state["taskDraft"]

    # Verify basic fields
    assert task_draft["eventId"] == "event-metadata-test"
    assert task_draft["type"] == "maintenance"
    assert task_draft["sourceType"] == "equipment"
    assert task_draft["sourceId"] == "equip-meta"
    assert task_draft["sourceName"] == "Test Equipment"

    # Verify metadata contains evidence
    assert "metadata" in task_draft
    assert "evidence" in task_draft["metadata"]
    assert len(task_draft["metadata"]["evidence"]) == 2


def test_supervisor_graph_queue_assignment_based_on_priority() -> None:
    """Test that supervisor assigns correct queue based on priority and risk."""
    tools = InMemorySupervisorTools()

    # Test urgent queue for high risk
    state_urgent = run_supervisor_graph(
        {
            "id": "event-urgent",
            "type": "equipment_fault",
            "sourceType": "equipment",
            "sourceId": "equip-urgent",
            "sourceName": "Urgent Equipment",
            "title": "Critical fault",
            "summary": "High risk event.",
            "priority": "high",
            "riskLevel": "high",
        },
        tools=tools,
    )
    assert state_urgent["supervisorDecision"]["queue"] == "urgent"

    # Test routine queue for low priority
    tools2 = InMemorySupervisorTools()
    state_routine = run_supervisor_graph(
        {
            "id": "event-routine",
            "type": "low_stock",
            "sourceType": "chemical",
            "sourceId": "chem-routine",
            "sourceName": "Routine Chemical",
            "title": "Low stock",
            "summary": "Low priority event.",
            "priority": "low",
            "riskLevel": "low",
        },
        tools=tools2,
    )
    assert state_routine["supervisorDecision"]["queue"] == "routine"


def test_supervisor_graph_preserves_actor_context() -> None:
    """Test that actor context is preserved throughout the graph execution."""
    tools = InMemorySupervisorTools()
    actor = {"id": "actor-123", "name": "Test Actor", "type": "agent"}

    state = run_supervisor_graph(
        {
            "id": "event-actor-test",
            "type": "low_stock",
            "sourceType": "chemical",
            "sourceId": "chem-actor",
            "sourceName": "Test Chemical",
            "title": "Actor test",
            "summary": "Testing actor preservation.",
        },
        actor=actor,
        tools=tools,
    )

    # Verify actor is preserved in logs
    for log in state["persistedActivityLogs"]:
        assert log["actor"]["id"] == "actor-123"
        assert log["actor"]["name"] == "Test Actor"
        assert log["actor"]["type"] == "agent"
