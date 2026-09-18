#!/usr/bin/env bash
# Fails if any tracked text file contains the Unicode replacement
# character (U+FFFD), which is the signature of corrupted / mojibake
# text (e.g. Arabic text mangled by a bad encoding conversion).
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

echo "check-encoding: scanning tracked files for U+FFFD..."

# -I skips files git detects as binary; this only looks at tracked files,
# so node_modules/.next/.git are excluded automatically via .gitignore.
if matches="$(git grep -nI $'\xEF\xBF\xBD' -- . 2>/dev/null)"; then
  echo "error: found U+FFFD (replacement character) in the following lines:" >&2
  echo "$matches" >&2
  echo >&2
  echo "This usually means Arabic (or other non-ASCII) text was corrupted" >&2
  echo "during a save/encoding conversion. Fix the source text and re-run." >&2
  exit 1
fi

echo "check-encoding: OK, no U+FFFD found."
