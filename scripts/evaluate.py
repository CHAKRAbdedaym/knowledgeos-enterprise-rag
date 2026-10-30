#!/usr/bin/env python3
"""Measure retrieval against authored ground truth; never synthesize a score."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def request(base, path, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(base.rstrip('/') + path, data, {'Content-Type': 'application/json'} if data else {})
    with urllib.request.urlopen(req, timeout=300) as response:
        return json.loads(response.read())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api-url', default='http://localhost:8000/api')
    parser.add_argument('--dataset', type=Path, default=ROOT / 'data/synthetic/evaluation.json')
    parser.add_argument('--output', type=Path, default=ROOT / 'data/evaluation-results.json')
    parser.add_argument('--top-k', type=int, default=5)
    parser.add_argument('--score-threshold', type=float, default=0.3)
    args = parser.parse_args()
    if not 1 <= args.top_k <= 10 or not 0 <= args.score_threshold <= 1:
        parser.error('top-k must be between 1 and 10 and score-threshold between 0 and 1')
    dataset = json.loads(args.dataset.read_text())
    rows = []
    try:
        docs = request(args.api_url, '/documents')
        names = {doc['id']: doc['filename'] for doc in docs}
        indexed = {doc['filename'] for doc in docs if doc['status'] == 'indexed'}
        required = {name for case in dataset['questions'] for name in case['expected_sources']}
        missing = required - indexed
        if missing:
            raise ValueError('Seed indexed corpus first; missing: ' + ', '.join(sorted(missing)))
        for case in dataset['questions']:
            result = request(args.api_url, '/retrieval', {'question': case['question'], 'top_k': args.top_k, 'score_threshold': args.score_threshold})
            actual = sorted({names.get(source['document_id'], '<unknown-document>') for source in result['sources']})
            expected = case['expected_sources']
            hits = len(set(expected) & set(actual))
            rows.append({**case, 'retrieved_sources': actual, 'source_scores': [s['score'] for s in result['sources']], 'recall': hits / len(expected) if expected else None, 'abstained': not result['sources'], 'trace': result.get('trace')})
            print(f"{case['id']}: sources={actual} recall={rows[-1]['recall']}")
    except (OSError, ValueError, KeyError) as exc:
        print(f'Evaluation failed; no aggregate score written: {exc}', file=sys.stderr)
        return 1
    supported = [row for row in rows if row['expected_sources']]
    unsupported = [row for row in rows if not row['expected_sources']]
    report = {'executed_at': datetime.now(timezone.utc).isoformat(), 'api_url': args.api_url, 'top_k': args.top_k, 'score_threshold': args.score_threshold, 'dataset': str(args.dataset.relative_to(ROOT)) if args.dataset.is_relative_to(ROOT) else args.dataset.name, 'supported_questions': len(supported), 'mean_document_recall_at_k': sum(row['recall'] for row in supported) / len(supported) if supported else None, 'no_answer_questions': len(unsupported), 'no_answer_abstention_rate': sum(row['abstained'] for row in unsupported) / len(unsupported) if unsupported else None, 'interpretation': 'Measured retrieval only, document-level recall over authored sources; not answer correctness. Similarity threshold may return unrelated passages for unsupported questions.', 'results': rows}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'results'}, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
