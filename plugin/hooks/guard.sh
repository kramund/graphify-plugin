#!/bin/sh
# Runs `graphify hook-guard <search|read|compact>`, the same hooks `graphify install` sets up for Claude Code.
# graphify is often installed but not on PATH (pip --user on Windows), so fall back to `python -m graphify`.
# If Graphify isn't installed at all, exit 0 silently: a missing tool must never block Bash/Grep/Read/Glob.
if command -v graphify >/dev/null 2>&1; then exec graphify hook-guard "$@"; fi
for py in python3 python; do
  if command -v "$py" >/dev/null 2>&1 &&
    "$py" -c "import importlib.util,sys; sys.exit(importlib.util.find_spec('graphify') is None)" >/dev/null 2>&1; then
    exec "$py" -m graphify hook-guard "$@"
  fi
done
exit 0
