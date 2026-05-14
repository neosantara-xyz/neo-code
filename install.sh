#!/usr/bin/env sh
# Install Neo Code from this source tree, GitHub release assets, or a release
# source archive for environments like Termux that need a local Node.js build.
#
# Termux note: GitHub release binaries are built for normal Linux glibc/macos/windows.
# On Android/Termux, this installer automatically falls back to a release source
# archive and builds the CLI locally with Node.js.
#
# Examples:
#   ./install.sh
#   ./install.sh --dry-run
#   ./install.sh --bin-dir "$HOME/.local/bin"
#   curl -fsSL https://code.neosantara.xyz/install.sh | sh

set -eu

DEFAULT_REPO="neosantara/neo-code"
DEFAULT_DOWNLOAD_BASE_URL="https://code.neosantara.xyz"
REPO="${NEO_CODE_REPO:-$DEFAULT_REPO}"
if [ "${NEO_CODE_DOWNLOAD_BASE_URL+x}" = "x" ]; then
  DOWNLOAD_BASE_URL="${NEO_CODE_DOWNLOAD_BASE_URL}"
else
  DOWNLOAD_BASE_URL="$DEFAULT_DOWNLOAD_BASE_URL"
fi
VERSION="${NEO_CODE_VERSION:-latest}"
MODE="${NEO_CODE_INSTALL_MODE:-auto}"
TERMUX_PREFIX="${PREFIX:-}"
PREFIX="${NEO_CODE_INSTALL_PREFIX:-$HOME/.local}"
BIN_DIR="${NEO_CODE_INSTALL_BIN_DIR:-}"
DRY_RUN=0
NO_BUILD=0
FORCE=0

print_header() {
  printf '\n%s\n' '========================================'
  printf '%s\n' '  Neo Code Installer'
  printf '%s\n' '========================================'
}

bundle_install_url() {
  release_ref="$1"
  if [ -n "$DOWNLOAD_BASE_URL" ]; then
    printf '%s/releases/%s/neo-termux-npm-bundle.tar.gz' "$DOWNLOAD_BASE_URL" "$release_ref"
  else
    printf 'https://github.com/%s/releases/download/%s/neo-termux-npm-bundle.tar.gz' "$REPO" "$release_ref"
  fi
}

log() { printf '%s\n' "$*"; }
err() { printf 'error: %s\n' "$*" >&2; }

usage() {
  cat <<USAGE
Install Neo Code

Usage:
  ./install.sh [options]
  curl -fsSL <install.sh-url> | sh -s -- [options]

Options:
  --source              Install from the current source tree.
  --release             Install from release assets, or source archive on Termux.
  --repo owner/name     GitHub repo for GitHub fallback mode. Default: $DEFAULT_REPO
  --version vX.Y.Z      Release tag for release mode. Default: latest
  --prefix DIR          Install prefix for release mode. Default: ~/.local
  --bin-dir DIR         Directory for the neo command. Default: Termux \$PREFIX/bin or ~/.local/bin
  --no-build            In source mode, skip npm run build and only link existing dist.
  --force               Overwrite an existing neo command/symlink.
  --dry-run             Print commands without running them.
  -h, --help            Show this help.

Recommended:
  curl -fsSL https://code.neosantara.xyz/install.sh | sh

Termux recommended:
  curl -fsSL https://code.neosantara.xyz/install.sh | sh
  neo login
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
  [ -n "${TERMUX_VERSION:-}" ] || printf '%s' "${TERMUX_PREFIX:-}" | grep -q '/com.termux/'
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

  if is_termux && [ -n "${TERMUX_PREFIX:-}" ]; then
    printf '%s' "${TERMUX_PREFIX}/bin"
    return
  fi

  printf '%s' "$HOME/.local/bin"
}

prepare_npm_cache() {
  if [ -n "${NPM_CONFIG_CACHE:-}" ]; then
    return
  fi

  cache_root="${TMPDIR:-/tmp}/neo-code-npm-cache"
  run mkdir -p "$cache_root"
  export NPM_CONFIG_CACHE="$cache_root"
}

install_source_tree() {
  source_dir="$1"
  install_kind="${2:-source}"
  need_cmd node
  need_cmd npm
  prepare_npm_cache

  major="$(node_major)"
  if [ "$major" -lt 20 ]; then
    err "Node.js >= 20 is required. Current: $(node -v 2>/dev/null || printf unknown)"
    if is_termux; then
      err "Termux hint: pkg install nodejs-lts"
    fi
    exit 1
  fi

  if [ "$install_kind" = "archive" ]; then
    log "    Preparing portable workspace install"
    run rm -f "$source_dir/package-lock.json"
    log "    Installing dependencies"
    run sh -c "cd \"$source_dir\" && npm install --ignore-scripts"
  else
    log "    Installing dependencies"
    run sh -c "cd \"$source_dir\" && npm ci --ignore-scripts"
  fi

  if [ "$NO_BUILD" != "1" ]; then
    log "    Building packages"
    run sh -c "cd \"$source_dir\" && npm run build"
  fi

  cli_path="$source_dir/packages/coding-agent/dist/cli.js"
  if [ "$DRY_RUN" != "1" ] && [ ! -f "$cli_path" ]; then
    err "missing built CLI: $cli_path"
    err "run npm run build or re-run installer without --no-build"
    exit 1
  fi

  bin="$(resolve_bin_dir)"
  log "    Installing neo command to $bin"
  run mkdir -p "$bin"

  target="$bin/neo"
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
  log "    Neo Code installed."
  log "    Run: neo login"
  if ! command -v neo >/dev/null 2>&1 && [ "$DRY_RUN" != "1" ]; then
    log ""
    log "Add this to your shell profile if neo is not found:"
    log "  export PATH=\"$bin:\$PATH\""
  fi
}

install_source() {
  if ! is_source_tree; then
    err "source mode must be run from the repo root containing packages/coding-agent"
    err "for curl installs, use --release so the installer can fetch a release asset or source archive"
    exit 1
  fi

  print_header
  install_source_tree "$(pwd)" source
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

  printf 'neo-%s-%s.tar.gz' "$os_name" "$arch_name"
}

source_archive_url() {
  tag="$1"
  if [ -n "$DOWNLOAD_BASE_URL" ]; then
    printf '%s/releases/%s/neo-code-source.tar.gz' "$DOWNLOAD_BASE_URL" "$tag"
  else
    printf 'https://github.com/%s/archive/refs/tags/%s.tar.gz' "$REPO" "$tag"
  fi
}

release_asset_url() {
  release_ref="$1"
  asset="$2"
  if [ -n "$DOWNLOAD_BASE_URL" ]; then
    printf '%s/releases/%s/%s' "$DOWNLOAD_BASE_URL" "$release_ref" "$asset"
  else
    printf 'https://github.com/%s/releases/download/%s/%s' "$REPO" "$release_ref" "$asset"
  fi
}

resolve_release_ref() {
  if [ "$VERSION" = "latest" ] && [ -n "$DOWNLOAD_BASE_URL" ]; then
    printf 'latest'
    return
  fi

  if [ "$VERSION" = "latest" ]; then
    latest_tag
    return
  fi

  printf '%s' "$VERSION"
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

install_release_source_archive() {
  need_cmd tar

  release_ref="$(resolve_release_ref)"
  if [ -z "$release_ref" ]; then
    err "could not resolve release reference"
    exit 1
  fi

  url="$(source_archive_url "$release_ref")"
  tmp="${TMPDIR:-/tmp}/neo-code-install-$$"
  src_dir="$tmp/src"

  log "[1/4] Downloading $url"
  run mkdir -p "$tmp"
  download "$url" "$tmp/source.tar.gz"

  log "[2/4] Extracting source archive"
  run mkdir -p "$src_dir"
  run tar -xzf "$tmp/source.tar.gz" -C "$src_dir" --strip-components=1

  install_source_tree "$src_dir" archive

  log "    Cleaning up temporary source archive"
  run rm -rf "$tmp"
}

install_termux_bundle() {
  need_cmd tar

  release_ref="$(resolve_release_ref)"
  if [ -z "$release_ref" ]; then
    err "could not resolve release reference"
    exit 1
  fi

  if [ -z "${TERMUX_PREFIX:-}" ]; then
    err "could not detect Termux prefix"
    exit 1
  fi

  url="$(bundle_install_url "$release_ref")"
  tmp="${TMPDIR:-/tmp}/neo-code-install-$$"
  bundle_dir="$tmp/bundle"

  log "[1/3] Downloading $url"
  run mkdir -p "$bundle_dir"
  run mkdir -p "$TERMUX_PREFIX/bin"
  download "$url" "$tmp/neo-termux-npm-bundle.tar.gz"

  log "[2/3] Extracting installer bundle"
  run tar -xzf "$tmp/neo-termux-npm-bundle.tar.gz" -C "$bundle_dir"

  prepare_npm_cache
  log "[3/3] Installing Neo Code into $TERMUX_PREFIX"
  run sh -c "cd \"$bundle_dir\" && npm_config_prefix=\"$TERMUX_PREFIX\" npm install -g --no-fund --no-audit ./neosantara-ai.tgz ./neosantara-agent-core.tgz ./neosantara-tui.tgz ./neosantara-code.tgz"

  log ""
  log "    Neo Code installed for Termux."
  log "    Run: neo login"
  log "    Cleaning up temporary installer bundle"
  run rm -rf "$tmp"
}

install_release() {
  if is_termux; then
    print_header
    log "==> Termux detected; using prebuilt npm bundle"
    install_termux_bundle
    return
  fi

  need_cmd uname
  need_cmd tar

  asset="$(platform_asset)"
  release_ref="$(resolve_release_ref)"
  if [ -z "$release_ref" ]; then
    err "could not resolve release reference"
    exit 1
  fi

  url="$(release_asset_url "$release_ref" "$asset")"
  tmp="${TMPDIR:-/tmp}/neo-code-install-$$"
  prefix="$PREFIX"
  bin="$(resolve_bin_dir)"

  print_header
  log "[1/3] Downloading $url"
  run mkdir -p "$tmp"
  if ! download "$url" "$tmp/$asset"; then
    log "==> Binary asset unavailable; falling back to source archive build"
    run rm -rf "$tmp"
    print_header
    install_release_source_archive
    return
  fi

  log "[2/3] Installing to $prefix/neo"
  run rm -rf "$prefix/neo"
  run mkdir -p "$prefix"
  run tar -xzf "$tmp/$asset" -C "$prefix"

  run mkdir -p "$bin"
  target="$bin/neo"
  if [ -e "$target" ] || [ -L "$target" ]; then
    if [ "$FORCE" = "1" ]; then
      run rm -f "$target"
    else
      err "$target already exists. Re-run with --force or choose --bin-dir."
      exit 1
    fi
  fi
  run ln -s "$prefix/neo/neo" "$target"
  run rm -rf "$tmp"

  log ""
  log "[3/3] Neo Code installed from $release_ref."
  log "    Run: neo login"
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
