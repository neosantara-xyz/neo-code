#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/dist/install"
STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/nai-termux-bundle-XXXXXX")"

cleanup() {
  rm -rf "$STAGE_DIR"
}
trap cleanup EXIT

cd "$ROOT_DIR"

mkdir -p "$OUT_DIR"
rm -f neosantara-ai-*.tgz neosantara-agent-core-*.tgz neosantara-code-*.tgz neosantara-tui-*.tgz
npm run build >/dev/null
npm pack --workspaces >/dev/null

cp neosantara-ai-*.tgz "$STAGE_DIR/neosantara-ai.tgz"
cp neosantara-agent-core-*.tgz "$STAGE_DIR/neosantara-agent-core.tgz"
cp neosantara-tui-*.tgz "$STAGE_DIR/neosantara-tui.tgz"
cp neosantara-code-*.tgz "$STAGE_DIR/neosantara-code.tgz"

tar -czf "$OUT_DIR/nai-termux-npm-bundle.tar.gz" -C "$STAGE_DIR" .
printf '%s\n' "$OUT_DIR/nai-termux-npm-bundle.tar.gz"
