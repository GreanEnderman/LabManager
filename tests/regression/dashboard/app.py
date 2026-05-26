from flask import Flask, render_template, jsonify
from tests.regression.adjudication.storage import AdjudicationStorage
from tests.regression.adjudication.workflow import ReviewerWorkflow
from pathlib import Path
import json

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('dashboard.html')

@app.route('/api/pending')
def pending_differences():
    """Get all pending (unadjudicated) differences"""
    storage = AdjudicationStorage()
    diffs_dir = Path("tests/regression/diffs")

    pending = []
    for diff_file in diffs_dir.glob("*.json"):
        with open(diff_file) as f:
            diff = json.load(f)

        adj = storage.get(diff_file.stem)
        if not adj or adj.category.value == "unadjudicated":
            pending.append({
                'id': diff_file.stem,
                'endpoint': diff['endpoint'],
                'method': diff['method'],
                'timestamp': diff['timestamp'],
                'difference_count': len(diff['differences'])
            })

    return jsonify(pending)

@app.route('/api/history')
def adjudication_history():
    """Get all adjudicated differences"""
    storage = AdjudicationStorage()
    adjudications = storage.list_all()

    history = []
    for adj in adjudications:
        if adj.category.value != "unadjudicated":
            history.append({
                'diff_id': adj.diff_id,
                'category': adj.category.value,
                'justification': adj.justification,
                'reviewers': [{'name': r.name, 'email': r.email} for r in adj.reviewers],
                'updated_at': adj.updated_at.isoformat()
            })

    return jsonify(history)

@app.route('/api/status')
def blocking_status():
    """Get blocking status for traffic switch"""
    workflow = ReviewerWorkflow()
    can_proceed, blocking_issues = workflow.can_approve_traffic_switch()

    return jsonify({
        'can_proceed': can_proceed,
        'blocking_count': len(blocking_issues),
        'blocking_issues': blocking_issues
    })

@app.route('/api/metrics')
def category_metrics():
    """Get category distribution metrics"""
    storage = AdjudicationStorage()
    adjudications = storage.list_all()

    by_category = {}
    for adj in adjudications:
        cat = adj.category.value
        by_category[cat] = by_category.get(cat, 0) + 1

    return jsonify(by_category)

if __name__ == '__main__':
    app.run(debug=True, port=5001)
