import json
from pathlib import Path


def generate_baseline_snapshots():
    """Generate baseline snapshots for contract tests"""
    snapshots_dir = Path("tests/api/contract/snapshots")
    snapshots_dir.mkdir(parents=True, exist_ok=True)

    baselines = {
        "task_create": {
            "status_code": 201,
            "required_fields": ["id", "title", "status", "created_at"]
        },
        "task_get": {
            "status_code": 200,
            "required_fields": ["id", "title", "status", "created_at"]
        },
        "approval_create": {
            "status_code": 201,
            "required_fields": ["id", "status", "created_at"]
        },
        "import_create": {
            "status_code": 201,
            "required_fields": ["id", "status"]
        },
        "report_create": {
            "status_code": 201,
            "required_fields": ["id", "status"]
        },
        "delivery_create": {
            "status_code": 201,
            "required_fields": ["id", "status", "tracking_number"]
        },
        "error_400": {
            "status_code": 400,
            "required_fields": ["error", "message"]
        },
        "error_404": {
            "status_code": 404,
            "required_fields": ["error", "message"]
        },
        "error_401": {
            "status_code": 401,
            "required_fields": ["error", "message"]
        }
    }

    for name, baseline in baselines.items():
        snapshot_path = snapshots_dir / f"{name}.json"
        with open(snapshot_path, "w") as f:
            json.dump(baseline, f, indent=2)


if __name__ == "__main__":
    generate_baseline_snapshots()
    print("Baseline snapshots generated successfully")
