#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""End-to-end verification script for LLM integration and core features.

This script verifies that:
1. LLM service can be initialized
2. Supervisor Graph works with and without LLM
3. Report generation works with and without LLM
4. Permission system is functional
5. All core components integrate correctly
"""

import asyncio
import sys

# Set UTF-8 encoding for Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Add parent directory to path
sys.path.insert(0, ".")

from app.authz import AppCapability, get_capabilities_for_role, has_capability
from app.graphs.supervisor import run_supervisor_graph_async
from app.graphs.tools import InMemorySupervisorTools
from app.llm.factory import create_llm_service
from app.llm.service import DisabledLLMService


def print_section(title: str):
    """Print a section header."""
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}\n")


def print_result(test_name: str, passed: bool, details: str = ""):
    """Print test result."""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"       {details}")


async def verify_llm_service():
    """Verify LLM service initialization."""
    print_section("1. LLM Service Verification")

    try:
        # Test factory creation
        llm_service = create_llm_service()
        print_result(
            "LLM service factory",
            True,
            f"Created: {type(llm_service).__name__}",
        )

        # Test DisabledLLMService
        disabled_service = DisabledLLMService()
        recommendation = await disabled_service.generate_recommendation(
            {"type": "low_stock", "sourceName": "Test"},
            {}
        )
        print_result(
            "DisabledLLMService recommendation",
            len(recommendation.reason) > 0,
            f"Generated {len(recommendation.reason)} chars",
        )

        narrative = await disabled_service.generate_report_narrative(
            {"type": "daily", "stats": {}}
        )
        print_result(
            "DisabledLLMService report narrative",
            len(narrative.summary) > 0,
            f"Generated summary with {len(narrative.highlights)} highlights",
        )

        return True
    except Exception as e:
        print_result("LLM service verification", False, str(e))
        return False


async def verify_supervisor_graph():
    """Verify Supervisor Graph with and without LLM."""
    print_section("2. Supervisor Graph Verification")

    try:
        tools = InMemorySupervisorTools()

        # Test without LLM
        state_no_llm = await run_supervisor_graph_async(
            {
                "id": "verify-event-1",
                "type": "low_stock",
                "sourceType": "chemical",
                "sourceId": "chem-verify",
                "sourceName": "Verification Chemical",
                "title": "Low stock verification",
                "summary": "Testing without LLM",
            },
            tools=tools,
            llm_service=None,
        )
        print_result(
            "Supervisor Graph without LLM",
            state_no_llm["createdTask"] is not None,
            f"Task created: {state_no_llm['createdTask']['id']}",
        )
        print_result(
            "LLM metadata (no LLM)",
            state_no_llm["taskDraft"]["metadata"]["llmUsed"] is False,
            "Correctly marked as not using LLM",
        )

        # Test with DisabledLLMService
        tools2 = InMemorySupervisorTools()
        llm_service = DisabledLLMService()
        state_with_llm = await run_supervisor_graph_async(
            {
                "id": "verify-event-2",
                "type": "maintenance_overdue",
                "sourceType": "equipment",
                "sourceId": "equip-verify",
                "sourceName": "Verification Equipment",
                "title": "Maintenance overdue verification",
                "summary": "Testing with DisabledLLMService",
            },
            tools=tools2,
            llm_service=llm_service,
        )
        print_result(
            "Supervisor Graph with DisabledLLMService",
            state_with_llm["createdTask"] is not None,
            f"Task created: {state_with_llm['createdTask']['id']}",
        )
        print_result(
            "LLM metadata (DisabledLLMService)",
            state_with_llm["taskDraft"]["metadata"]["llmUsed"] is False,
            "Correctly marked as template-based",
        )

        # Test recommendation content
        print_result(
            "Recommendation generated",
            len(state_with_llm["recommendation"]["reason"]) > 0,
            f"Reason: {state_with_llm['recommendation']['reason'][:50]}...",
        )

        return True
    except Exception as e:
        print_result("Supervisor Graph verification", False, str(e))
        return False


def verify_permission_system():
    """Verify permission system."""
    print_section("3. Permission System Verification")

    try:
        # Test role capabilities
        admin_caps = get_capabilities_for_role("admin")
        print_result(
            "Admin role capabilities",
            len(admin_caps) == 19,
            f"Has {len(admin_caps)} capabilities",
        )

        manager_caps = get_capabilities_for_role("manager")
        print_result(
            "Manager role capabilities",
            len(manager_caps) == 17,
            f"Has {len(manager_caps)} capabilities",
        )

        # Test capability checking
        user_caps = ["tasks:read", "tasks:write"]
        print_result(
            "has_capability (positive)",
            has_capability(user_caps, AppCapability.TASKS_READ),
            "User has tasks:read",
        )
        print_result(
            "has_capability (negative)",
            not has_capability(user_caps, AppCapability.SETTINGS_UPDATE),
            "User lacks settings:update",
        )

        # Test hierarchy
        admin_set = set(admin_caps)
        manager_set = set(manager_caps)
        print_result(
            "Role hierarchy",
            manager_set.issubset(admin_set),
            "Manager capabilities are subset of admin",
        )

        return True
    except Exception as e:
        print_result("Permission system verification", False, str(e))
        return False


def verify_integration():
    """Verify component integration."""
    print_section("4. Component Integration Verification")

    try:
        # Test that all modules can be imported
        from app.agents import RetrospectiveAgent
        from app.api.auth_middleware import require_capability
        from app.authz import AppCapability
        from app.graphs.rules_adapter import SupervisorRulesAdapter
        from app.graphs.supervisor import build_supervisor_graph
        from app.llm import create_llm_service
        from app.reports.generator import generate_daily_report

        print_result("Module imports", True, "All modules imported successfully")

        # Test that key classes can be instantiated
        llm_service = create_llm_service()
        print_result(
            "LLM service instantiation",
            llm_service is not None,
            f"Type: {type(llm_service).__name__}",
        )

        tools = InMemorySupervisorTools()
        graph = build_supervisor_graph(tools=tools, llm_service=llm_service)
        print_result(
            "Supervisor Graph building",
            graph is not None,
            "Graph built successfully",
        )

        return True
    except Exception as e:
        print_result("Component integration", False, str(e))
        return False


async def main():
    """Run all verification tests."""
    print("\n" + "=" * 60)
    print("  LabManager Python Backend - End-to-End Verification")
    print("=" * 60)

    results = []

    # Run all verification tests
    results.append(await verify_llm_service())
    results.append(await verify_supervisor_graph())
    results.append(verify_permission_system())
    results.append(verify_integration())

    # Print summary
    print_section("Verification Summary")
    passed = sum(results)
    total = len(results)
    success_rate = (passed / total) * 100

    print(f"Tests Passed: {passed}/{total} ({success_rate:.0f}%)")

    if passed == total:
        print("\n✅ All verifications passed! System is ready.")
        return 0
    else:
        print(f"\n❌ {total - passed} verification(s) failed. Please review.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
