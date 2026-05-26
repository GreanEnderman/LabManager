import click
import json
from datetime import datetime
from pathlib import Path
from tests.regression.adjudication.workflow import ReviewerWorkflow
from tests.regression.adjudication.storage import AdjudicationStorage

@click.group()
def cli():
    """Traffic switch readiness tools"""
    pass

@cli.command()
def check():
    """Check if traffic switch can proceed"""
    workflow = ReviewerWorkflow()
    can_proceed, blocking_issues = workflow.can_approve_traffic_switch()

    if can_proceed:
        click.echo("✓ Traffic switch READY")
        click.echo("  All differences adjudicated")
        click.echo("  No blocking issues")
        return 0
    else:
        click.echo("✗ Traffic switch BLOCKED")
        click.echo(f"  {len(blocking_issues)} blocking issues:")
        for issue in blocking_issues:
            click.echo(f"    - {issue}")
        return 1

@cli.command()
@click.option('--output', default='traffic_switch_report.json', help='Output file path')
def report(output):
    """Generate traffic switch readiness report"""
    workflow = ReviewerWorkflow()
    storage = AdjudicationStorage()

    can_proceed, blocking_issues = workflow.can_approve_traffic_switch()
    all_adjudications = storage.list_all()

    by_category = {}
    for adj in all_adjudications:
        cat = adj.category.value
        by_category[cat] = by_category.get(cat, 0) + 1

    report_data = {
        'timestamp': datetime.utcnow().isoformat(),
        'ready': can_proceed,
        'blocking_count': len(blocking_issues),
        'blocking_issues': blocking_issues,
        'total_adjudications': len(all_adjudications),
        'by_category': by_category
    }

    with open(output, 'w') as f:
        json.dump(report_data, f, indent=2)

    click.echo(f"Report written to {output}")

@cli.command()
@click.option('--archive-dir', default='tests/regression/archive', help='Archive directory')
def archive():
    """Archive regression results for audit trail"""
    archive_dir = Path(archive_dir)
    archive_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    archive_path = archive_dir / timestamp

    archive_path.mkdir()

    import shutil
    shutil.copytree('tests/regression/diffs', archive_path / 'diffs')
    shutil.copytree('tests/regression/adjudication/data', archive_path / 'adjudications')

    click.echo(f"Archived to {archive_path}")

@cli.command()
@click.option('--output', default='audit_trail.json', help='Output file path')
def export_audit():
    """Export audit trail for compliance"""
    storage = AdjudicationStorage()
    all_adjudications = storage.list_all()

    audit_trail = []
    for adj in all_adjudications:
        audit_trail.append({
            'diff_id': adj.diff_id,
            'category': adj.category.value,
            'justification': adj.justification,
            'reviewers': [
                {
                    'name': r.name,
                    'email': r.email,
                    'timestamp': r.timestamp.isoformat()
                } for r in adj.reviewers
            ],
            'created_at': adj.created_at.isoformat(),
            'updated_at': adj.updated_at.isoformat()
        })

    with open(output, 'w') as f:
        json.dump(audit_trail, f, indent=2)

    click.echo(f"Audit trail exported to {output}")

if __name__ == '__main__':
    cli()
