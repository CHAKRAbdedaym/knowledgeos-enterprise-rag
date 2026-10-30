#!/usr/bin/env python3
"""Upload the explicitly synthetic corpus through the public ingestion API."""
import argparse
import json
from pathlib import Path
import sys
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api-url', default='http://localhost:8000/api')
    parser.add_argument('--corpus', type=Path, default=ROOT / 'data/synthetic')
    args = parser.parse_args()
    manifest = json.loads((args.corpus / 'manifest.json').read_text())
    failures = 0
    for doc in manifest['documents']:
        path = args.corpus / doc['filename']
        boundary = 'knowledgeos-' + uuid.uuid4().hex
        parts = []
        for name, value in [('category', doc['category']), ('tags', ','.join(doc['tags']))]:
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{path.name}"\r\nContent-Type: text/markdown\r\n\r\n'.encode() + path.read_bytes() + b'\r\n')
        parts.append(f'--{boundary}--\r\n'.encode())
        req = urllib.request.Request(args.api_url.rstrip('/') + '/documents', b''.join(parts), {'Content-Type': f'multipart/form-data; boundary={boundary}'}, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=300) as response:
                result = json.loads(response.read())
                if response.status not in (200, 201) or result.get('status') != 'indexed':
                    raise RuntimeError(f'ingestion not indexed: {result}')
                print(f'INDEXED {path.name}')
        except urllib.error.HTTPError as exc:
            if exc.code == 409:
                print(f'SKIP duplicate {path.name}')
            else:
                failures += 1
                print(f'FAIL {path.name}: HTTP {exc.code}: {exc.read().decode()[:500]}', file=sys.stderr)
        except (OSError, ValueError, RuntimeError) as exc:
            failures += 1
            print(f'FAIL {path.name}: {exc}', file=sys.stderr)
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
