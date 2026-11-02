#!/usr/bin/env python3
"""Destructive only to this script's unique synthetic fixture; exercises a running stack."""
import json
import os
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

from admin_session import authenticate

BASE = os.environ.get('API_URL', 'http://localhost:8000/api').rstrip('/')
QDRANT = os.environ.get('QDRANT_URL', 'http://localhost:6333').rstrip('/')
COLLECTION = os.environ.get('QDRANT_COLLECTION', 'knowledgeos')
checks = []


def request(method, path, body=None, headers=None, expected=(200, 201, 204), absolute=False):
    if isinstance(body, dict):
        body = json.dumps(body).encode()
        headers = {'Content-Type': 'application/json', **(headers or {})}
    req = urllib.request.Request(path if absolute else BASE + path, body, headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read()
    assert status in expected, (method, path, status, raw[:500])
    return json.loads(raw) if raw else None


def check(name, assertion):
    assert assertion, name
    checks.append(name)
    print('PASS', name)


def upload(name, data, mime='text/markdown', expected=(200, 201)):
    boundary = 'knowledgeos-' + uuid.uuid4().hex
    raw = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\n'
           f'Content-Type: {mime}\r\n\r\n').encode() + data + f'\r\n--{boundary}--\r\n'.encode()
    return request('POST', '/documents', raw, {'Content-Type': f'multipart/form-data; boundary={boundary}'}, expected)


def vector_count(document_id):
    result = request('POST', f'{QDRANT}/collections/{COLLECTION}/points/count',
                     {'filter': {'must': [{'key': 'metadata.document_id', 'match': {'value': document_id}}]}, 'exact': True}, absolute=True)
    return result['result']['count']


def main():
    authenticate(BASE)
    document_id = conversation_id = None
    try:
        request('GET', '/readiness')
        check('Real PostgreSQL and Qdrant readiness', True)
        docs = request('GET', '/documents')
        check('Seeded corpus contains at least 20 documents', len(docs) >= 20)
        before = request('GET', '/dashboard')
        check('Dashboard reports persisted corpus and chunks', before['documents'] >= 20 and before['chunks'] > 0)
        check('Sanitized configuration omits API key', 'api_key' not in json.dumps(request('GET', '/config')).lower())
        conversation = request('POST', '/conversations', {'title': 'Acceptance verification'})
        conversation_id = conversation['id']
        request('PATCH', f'/conversations/{conversation_id}', {'title': 'Acceptance renamed'})
        check('Conversation rename persists', request('GET', f'/conversations/{conversation_id}')['title'] == 'Acceptance renamed')
        answer = request('POST', f'/conversations/{conversation_id}/messages', {'question': 'How many remote-work days are allowed per week?', 'top_k': 5, 'score_threshold': 0.3})
        check('Supported corpus question retrieves traceable citations', bool(answer['sources']) and all(s['chunk_id'] and s['document_id'] for s in answer['sources']))
        unsupported = request('POST', f'/conversations/{conversation_id}/messages', {'question': 'How do I bake a sourdough loaf with rye flour?', 'top_k': 5, 'score_threshold': 0.4})
        check('Unsupported question abstains', unsupported['mode'] == 'abstained')
        check('Conversation history persists on independent GET', len(request('GET', f'/conversations/{conversation_id}')['messages']) == 4)
        marker = uuid.uuid4().hex[:8]
        content = (f'# Synthetic acceptance beacon {marker}\n\nSYNTHETIC portfolio test fixture. '
                   'The Zephyr lighthouse maintenance team uses the violet compass authorization phrase. '
                   'The Zephyr lighthouse opens at 06:35 every Tuesday. '
                   'Maintenance approval belongs to the fictional Navigation department.').encode()
        doc = upload(f'acceptance-{marker}.md', content)
        document_id = doc['id']
        check('New upload is genuinely indexed', doc['status'] == 'indexed' and doc['chunk_count'] > 0)
        initial_vectors = vector_count(document_id)
        check('Qdrant contains the uploaded document vectors', initial_vectors == doc['chunk_count'])
        upload(f'acceptance-duplicate-{marker}.md', content, expected=(409,))
        check('Content duplicate rejected with 409', True)
        upload('unsafe.exe', b'MZ\x00binary', 'application/octet-stream', expected=(400, 415, 422))
        check('Unsupported file rejected', True)
        answer = request('POST', f'/conversations/{conversation_id}/messages', {'question': 'What authorization phrase does the Zephyr lighthouse maintenance team use?', 'top_k': 3, 'score_threshold': 0.3})
        check('New content is retrieved with its original source ID', any(s['document_id'] == document_id and 'violet compass' in s['text'] for s in answer['sources']))
        detail = request('GET', f'/documents/{document_id}')
        check('Document preview returns extracted text', 'violet compass' in detail['text'])
        request('POST', f'/documents/{document_id}/reindex')
        check('Reindex does not duplicate vector entries', vector_count(document_id) == initial_vectors)
        request('DELETE', f'/documents/{document_id}')
        check('Delete removes vector entries', vector_count(document_id) == 0)
        request('GET', f'/documents/{document_id}', expected=(404,))
        document_id = None
        check('Delete removes document metadata', True)
        after = request('GET', '/dashboard')
        check('Analytics increments for actual queries', after['queries'] >= before['queries'] + 3)
        analytics = request('GET', '/analytics?days=30')
        check('Analytics has real timing and source references', analytics['average_latency_ms'] > 0 and bool(analytics['most_referenced']))
    finally:
        if document_id:
            request('DELETE', f'/documents/{document_id}')
        if conversation_id:
            request('DELETE', f'/conversations/{conversation_id}')
    report = {'executed_at': datetime.now(timezone.utc).isoformat(), 'api_url': BASE,
              'passed_checks': checks, 'scope': 'Real local Docker stack; no live external LLM invocation'}
    Path('docs/acceptance-results.json').write_text(json.dumps(report, indent=2) + '\n')
    print(f'{len(checks)} acceptance checks passed.')


if __name__ == '__main__':
    main()
