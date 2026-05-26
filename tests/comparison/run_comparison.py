"""Main comparison test runner."""

import asyncio
from .test_data import TestDataGenerator
from .callers import TSCaller, PythonCaller
from .comparator import OutputComparator, ComparisonReporter


async def run_comparison():
    """Run comparison between TS and Python implementations."""
    generator = TestDataGenerator()
    ts_caller = TSCaller()
    python_caller = PythonCaller()
    comparator = OutputComparator()
    reporter = ComparisonReporter()

    results = []

    # Test single events
    test_events = [
        ("task-001", generator.generate_task_event()),
        ("approval-001", generator.generate_approval_event()),
        ("activity-001", generator.generate_activity_event()),
    ]

    for event_id, event in test_events:
        try:
            ts_output = await ts_caller.process_event(event)
            python_output = await python_caller.process_event(event)
            result = comparator.compare(ts_output, python_output, event_id)
            results.append(result)
        except Exception as e:
            print(f"Error processing {event_id}: {e}")

    # Test deduplication sequence
    dup_sequence = generator.generate_duplicate_sequence()
    for idx, event in enumerate(dup_sequence):
        event_id = f"dup-{idx}"
        try:
            ts_output = await ts_caller.process_event(event)
            python_output = await python_caller.process_event(event)
            result = comparator.compare(ts_output, python_output, event_id)
            results.append(result)
        except Exception as e:
            print(f"Error processing {event_id}: {e}")

    # Generate report
    report = reporter.generate_report(results)
    print(report)

    # Return exit code
    return 0 if all(r.matches for r in results) else 1


if __name__ == "__main__":
    exit_code = asyncio.run(run_comparison())
    exit(exit_code)
