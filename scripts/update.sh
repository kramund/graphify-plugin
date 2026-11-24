#!/bin/sh
# Re-copies Graphify's Claude skill files and licences from Graphify-Labs/graphify (branch v8, or $1),
# unchanged, and records the commit and version in UPSTREAM. Review the diff, run `npm test`, then open a PR.
set -eu
REF="${1:-v8}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

SHA="$(curl -fsSL -H 'Accept: application/vnd.github.sha' "https://api.github.com/repos/Graphify-Labs/graphify/commits/$REF")"
curl -fsSL "https://codeload.github.com/Graphify-Labs/graphify/tar.gz/$SHA" | tar xz -C "$TMP"
SRC="$(ls -d "$TMP"/graphify-*)"

SKILL="$ROOT/plugin/skills/graphify"
rm -rf "$SKILL/references"
mkdir -p "$SKILL/references"
cp "$SRC/graphify/skill.md" "$SKILL/SKILL.md"
cp "$SRC/graphify/skills/claude/references/"*.md "$SKILL/references/"
cp "$SRC/LICENSE" "$SRC/LICENSE-MIT" "$SRC/NOTICE" "$ROOT/"

VERSION="$(sed -n 's/^version = "\(.*\)"/\1/p' "$SRC/pyproject.toml" | head -n1)"
printf 'repo: Graphify-Labs/graphify\nref: %s\ncommit: %s\nversion: %s\n' "$REF" "$SHA" "$VERSION" > "$ROOT/UPSTREAM"
echo "Copied Graphify $VERSION ($SHA). Bump the plugin version, then run npm test."
