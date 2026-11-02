#!/usr/bin/env python3
"""Set a Gemini key locally without echo, command arguments or modifying provider mode."""

import getpass
import os
import sys
import tempfile
import warnings
from pathlib import Path


def main():
    if not sys.stdin.isatty():
        raise SystemExit("Use your interactive local terminal; no piped secrets.")
    path = Path(__file__).resolve().parents[1] / ".env"
    with warnings.catch_warnings():
        warnings.simplefilter("error", getpass.GetPassWarning)
        key = getpass.getpass("Gemini API key (hidden; never paste into chat): ")
    if not key or any(c.isspace() or c in "'\"\\" for c in key):
        raise SystemExit("Invalid key format; no file changed.")
    content = path.read_text() if path.exists() else ""
    lines = content.splitlines()
    found = False
    for i, line in enumerate(lines):
        if line.strip().startswith("GEMINI_API_KEY="):
            lines[i] = "GEMINI_API_KEY=" + key
            found = True
    if not found:
        lines.append("GEMINI_API_KEY=" + key)
    # Preserve all other variables. Provider activation/model verification is a separate step.
    fd, name = tempfile.mkstemp(prefix=".env.", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            stream.write("\n".join(lines) + "\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
        os.chmod(path, 0o600)
    finally:
        if os.path.exists(name):
            os.unlink(name)
    del key
    print(
        "Gemini key saved to local .env with mode 0600. Provider selection was preserved."
    )


if __name__ == "__main__":
    main()
