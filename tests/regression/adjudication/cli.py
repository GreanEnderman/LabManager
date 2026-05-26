import json
import click
from pathlib import Path
from datetime import datetime
from tests.regression.adjudication.models import AdjudicationCategory, Adjudication, Reviewer
from tests.regression.adjudication.storage import AdjudicationStorage

@click.group()
def cli():
    """Regression test adjudication CLI"""
    pass

@cli.command()
def list_pending():
    """List all unadjudicated differences"""
    diffs_dir = Path("tests/regression/diffs")
    storage = AdjudicationStorage()

    for diff_file in diffs_dir.glob("*.json"):
        with open(diff_file) as f:
            diff = json.load(f)

        adj = storage.get(diff_file.stem)
        if not adj or adj.category == AdjudicationCategory.UNADJUDICATED:
            click.echo(f"\n{diff_file.stem}")
            click.echo(f"  Endpoint: {diff['endpoint']}")
            click.echo(f"  Method: {diff['method']}")
            click.echo(f"  Differences: {len(diff['differences'])}")

@cli.command()
@click.argument('diff_id')
def show(diff_id):
    """Show details of a specific difference"""
    diff_file = Path(f"tests/regression/diffs/{diff_id}.json")
    if not diff_file.exists():
        click.echo(f"Diff not found: {diff_id}", err=True)
        return

    with open(diff_file) as f:
        diff = json.load(f)

    click.echo(json.dumps(diff, indent=2))

@cli.command()
@click.argument('diff_id')
@click.option('--category', type=click.Choice(['acceptable', 'python-correct', 'ts-correct', 'needs-discussion']), required=True)
@click.option('--justification', required=True)
@click.option('--reviewer-name', required=True)
@click.option('--reviewer-email', required=True)
def adjudicate(diff_id, category, justification, reviewer_name, reviewer_email):
    """Adjudicate a difference"""
    storage = AdjudicationStorage()

    reviewer = Reviewer(
        name=reviewer_name,
        email=reviewer_email,
        timestamp=datetime.utcnow()
    )

    existing = storage.get(diff_id)
    if existing:
        existing.category = AdjudicationCategory(category)
        existing.justification = justification
        existing.reviewers.append(reviewer)
        existing.updated_at = datetime.utcnow()
        storage.save(existing)
    else:
        adj = Adjudication(
            diff_id=diff_id,
            category=AdjudicationCategory(category),
            justification=justification,
            reviewers=[reviewer],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        storage.save(adj)

    click.echo(f"Adjudicated {diff_id} as {category}")

@cli.command()
def status():
    """Show adjudication status summary"""
    storage = AdjudicationStorage()
    diffs_dir = Path("tests/regression/diffs")

    total = len(list(diffs_dir.glob("*.json")))
    adjudications = storage.list_all()

    by_category = {}
    for adj in adjudications:
        cat = adj.category.value
        by_category[cat] = by_category.get(cat, 0) + 1

    click.echo(f"Total differences: {total}")
    click.echo(f"Adjudicated: {len(adjudications)}")
    click.echo(f"Pending: {total - len(adjudications)}")
    click.echo("\nBy category:")
    for cat, count in by_category.items():
        click.echo(f"  {cat}: {count}")

if __name__ == '__main__':
    cli()
