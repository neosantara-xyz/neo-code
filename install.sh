#!/usr/bin/env sh
# Install NAI Code from this source tree, or from GitHub release assets.
#
# Termux note: GitHub release binaries are built for normal Linux glibc/macos/windows.
# Android/Termux should use source mode so the CLI runs through Node.js.
#
# Examples:
#   ./install.sh
#   ./install.sh --dry-run
#   ./install.sh --bin-dir "$HOME/.local/bin"
#   NAI_CODE_REPO=owner/repo curl -fsSL https://your-domain.example/install.sh | sh -s -- --release

set -eu

DEFAULT_REPO="neosantara/nai-code"
REPO="${NAI_CODE_REPO:-$DEFAULT_REPO}"
VERSION="${NAI_CODE_VERSION:-latest}"
MODE="${NAI_CODE_INSTALL_MODE:-auto}"
PREFIX="${NAI_CODE_INSTALL_PREFIX:-$HOME/.local}"
BIN_DIR="${NAI_CODE_INSTALL_BIN_DIR:-}"
DRY_RUN=0
NO_BUILD=0
FORCE=0

log() { printf '%s\n' "$*"; }
err() { printf 'error: %s\n' "$*" >&2; }

usage() {
  cat <<USAGE
Install NAI Code

Usage:
  ./install.sh [options]
  curl -fsSL <install.sh-url> | sh -s -- [options]

Options:
  --source              Install from the current source tree.
  --release             Install from GitHub release assets.
  --repo owner/name     GitHub repo for release mode. Default: $DEFAULT_REPO
  --version vX.Y.Z      Release tag for release mode. Default: latest
  --prefix DIR          Install prefix for release mode. Default: ~/.local
  --bin-dir DIR         Directory for the nai command. Default: Termux \$PREFIX/bin or ~/.local/bin
  --no-build            In source mode, skip npm run build and only link existing dist.
  --force               Overwrite an existing nai command/symlink.
  --dry-run             Print commands without running them.
  -h, --help            Show this help.

Termux recommended:
  ./install.sh
  nai login
USAGE
}

run() {
  if [ "$DRY_RUN" = "1" ]; then
    printf '+ '
    printf '%s ' "$@"
    printf '\n'
  else
    "$@"
  fi
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    err "missing required command: $1"
    return 1
  }
}

is_termux() {
  [ -n "${TERMUX_VERSION:-}" ] || printf '%s' "${PREFIX:-}" | grep -q '/com.termux/'
}

is_source_tree() {
  [ -f package.json ] && [ -f packages/coding-agent/package.json ] && [ -d packages/coding-agent/src ]
}

node_major() {
  node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || printf '0'
}

resolve_bin_dir() {
  if [ -n "$BIN_DIR" ]; then
    printf '%s' "$BIN_DIR"
    return
  fi

  if is_termux && [ -n "${PREFIX:-}" ] && [ -d "${PREFIX}/bin" ] && [ -w "${PREFIX}/bin" ]; then
    printf '%s' "${PREFIX}/bin"
    return
  fi

  printf '%s' "$HOME/.local/bin"
}

install_source() {
  need_cmd node
  need_cmd npm

  major="$(node_major)"
  if [ "$major" -lt 20 ]; then
    err "Node.js >= 20 is required. Current: $(node -v 2>/dev/null || printf unknown)"
    if is_termux; then
      err "Termux hint: pkg install nodejs-lts"
    fi
    exit 1
  fi

  if ! is_source_tree; then
    err "source mode must be run from the repo root containing packages/coding-agent"
    err "for curl installs, use --release with NAI_CODE_REPO=owner/repo, or clone/unzip the repo first"
    exit 1
  fi

  log "==> Installing dependencies"
  run npm install --ignore-scripts

  if [ "$NO_BUILD" != "1" ]; then
    log "==> Building packages"
    run npm run build
  fi

  cli_path="$(pwd)/packages/coding-agent/dist/cli.js"
  if [ ! -f "$cli_path" ]; then
    err "missing built CLI: $cli_path"
    err "run npm run build or re-run installer without --no-build"
    exit 1
  fi

  bin="$(resolve_bin_dir)"
  log "==> Installing nai command to $bin"
  run mkdir -p "$bin"

  target="$bin/nai"
  if [ -e "$target" ] || [ -L "$target" ]; then
    if [ "$FORCE" = "1" ]; then
      run rm -f "$target"
    else
      err "$target already exists. Re-run with --force or choose --bin-dir."
      exit 1
    fi
  fi

  run chmod +x "$cli_path"
  run ln -s "$cli_path" "$target"

  log ""
  log "NAI Code installed."
  log "Run: nai login"
  if ! command -v nai >/dev/null 2>&1 && [ "$DRY_RUN" != "1" ]; then
    log ""
    log "Add this to your shell profile if nai is not found:"
    log "  export PATH=\"$bin:\$PATH\""
  fi
}

platform_asset() {
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"

  case "$os" in
    darwin) os_name="darwin" ;;
    linux) os_name="linux" ;;
    *) err "unsupported OS for release mode: $os"; exit 1 ;;
  esac

  case "$arch" in
    x86_64|amd64) arch_name="x64" ;;
    arm64|aarch64) arch_name="arm64" ;;
    *) err "unsupported architecture for release mode: $arch"; exit 1 ;;
  esac

  printf 'nai-%s-%s.tar.gz' "$os_name" "$arch_name"
}

latest_tag() {
  need_cmd sed
  url="https://api.github.com/repos/$REPO/releases/latest"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "$url" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1
  else
    err "curl or wget is required for release mode"
    exit 1
  fi
}

download() {
  url="$1"
  out="$2"
  if command -v curl >/dev/null 2>&1; then
    run curl -fL "$url" -o "$out"
  elif command -v wget >/dev/null 2>&1; then
    run wget -O "$out" "$url"
  else
    err "curl or wget is required for release mode"
    exit 1
  fi
}

install_release() {
  if is_termux; then
    err "release binaries are not recommended for Termux/Android; use source mode instead"
    err "run from the extracted repo: ./install.sh"
    exit 1
  fi

  need_cmd uname
  need_cmd tar

  asset="$(platform_asset)"
  tag="$VERSION"
  if [ "$tag" = "latest" ]; then
    tag="$(latest_tag)"
  fi
  if [ -z "$tag" ]; then
    err "could not resolve latest release tag for $REPO"
    exit 1
  fi

  url="https://github.com/$REPO/releases/download/$tag/$asset"
  tmp="${TMPDIR:-/tmp}/nai-code-install-$$"
  prefix="$PREFIX"
  bin="$(resolve_bin_dir)"

  log "==> Downloading $url"
  run mkdir -p "$tmp"
  download "$url" "$tmp/$asset"

  log "==> Installing to $prefix/nai"
  run rm -rf "$prefix/nai"
  run mkdir -p "$prefix"
  run tar -xzf "$tmp/$asset" -C "$prefix"

  run mkdir -p "$bin"
  target="$bin/nai"
  if [ -e "$target" ] || [ -L "$target" ]; then
    if [ "$FORCE" = "1" ]; then
      run rm -f "$target"
    else
      err "$target already exists. Re-run with --force or choose --bin-dir."
      exit 1
    fi
  fi
  run ln -s "$prefix/nai/nai" "$target"
  run rm -rf "$tmp"

  log ""
  log "NAI Code installed from $tag."
  log "Run: nai login"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --source) MODE="source"; shift ;;
    --release) MODE="release"; shift ;;
    --repo) REPO="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --prefix) PREFIX="$2"; shift 2 ;;
    --bin-dir) BIN_DIR="$2"; shift 2 ;;
    --no-build) NO_BUILD=1; shift ;;
    --force) FORCE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) err "unknown option: $1"; usage; exit 1 ;;
  esac
done

if [ "$MODE" = "auto" ]; then
  if is_source_tree; then
    MODE="source"
  else
    MODE="release"
  fi
fi

case "$MODE" in
  source) install_source ;;
  release) install_release ;;
  *) err "invalid mode: $MODE"; exit 1 ;;
esac
