#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/dist/install"
PACK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/neo-termux-pack-XXXXXX")"
STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/neo-termux-bundle-XXXXXX")"

cleanup() {
  rm -rf "$STAGE_DIR" "$PACK_DIR"
}
trap cleanup EXIT

cd "$ROOT_DIR"

mkdir -p "$OUT_DIR"

# Build if dist does not exist yet (skip when called after a prior build step)
if [ ! -d "$ROOT_DIR/packages/coding-agent/dist" ]; then
  npm run build >/dev/null
fi

# Pack only the packages needed for the Termux bundle (excludes @neosantara/web).
npm pack --pack-destination "$PACK_DIR" \
  -w @neosantara/ai \
  -w @neosantara/agent-core \
  -w @neosantara/tui \
  -w @neosantara/code >/dev/null

cp "$PACK_DIR"/neosantara-ai-*.tgz "$STAGE_DIR/neosantara-ai.tgz"
cp "$PACK_DIR"/neosantara-agent-core-*.tgz "$STAGE_DIR/neosantara-agent-core.tgz"
cp "$PACK_DIR"/neosantara-tui-*.tgz "$STAGE_DIR/neosantara-tui.tgz"
cp "$PACK_DIR"/neosantara-code-*.tgz "$STAGE_DIR/neosantara-code.tgz"

tar -czf "$OUT_DIR/neo-termux-bundle.tar.gz" -C "$STAGE_DIR" .
printf '%s\n' "$OUT_DIR/neo-termux-bundle.tar.gz"
