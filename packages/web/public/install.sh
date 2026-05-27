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

DEFAULT_REPO="neosantara-xyz/neo-code"
DEFAULT_DOWNLOAD_BASE_URL=""
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

# --- Terminal styling ---
if [ -t 1 ]; then
  BOLD='\033[1m'
  DIM='\033[2m'
  GREEN='\033[1;32m'
  CYAN='\033[1;36m'
  YELLOW='\033[1;33m'
  BLUE='\033[1;34m'
  RED='\033[1;31m'
  RESET='\033[0m'
else
  BOLD=''; DIM=''; GREEN=''; CYAN=''; YELLOW=''; BLUE=''; RED=''; RESET=''
fi

# --- Output helpers ---
info()    { printf "${BLUE}::${RESET} %s\n" "$*"; }
success() { printf "${GREEN}==>${RESET} %s\n" "$*"; }
warn()    { printf "${YELLOW}!!${RESET} %s\n" "$*"; }
err()     { printf "${RED}error:${RESET} %s\n" "$*" >&2; }
step()    { printf "  ${CYAN}[%s]${RESET} ${BOLD}%s${RESET}\n" "$1" "$2"; }
ok()      { printf "  ${GREEN}[%s]${RESET} ${DIM}ok${RESET}\n" "$1"; }

print_header() {
  ref="${1:-latest}"
  printf '\n'
  printf "  ${CYAN}[o_o]${RESET} ${BOLD}Neo Code${RESET}\n"
  printf "  ${CYAN}/|_|\\${RESET} ${DIM}installer ${ref}${RESET}\n"
  printf '\n'
}

print_summary() {
  cmd="${1:-neo}"
  printf '\n'
  printf "  ${GREEN}[o_o]${RESET} ${BOLD}Neo Code installed${RESET}\n"
  if [ -n "${INSTALLED_VERSION:-}" ]; then
    printf "  ${GREEN}/|_|\\${RESET} ${DIM}version %s${RESET}\n" "$INSTALLED_VERSION"
  fi
  printf '\n'
  success "Run: ${BOLD}neo${RESET} login"
  if ! command -v neo >/dev/null 2>&1 && [ "$DRY_RUN" != "1" ] && [ "$cmd" = "neo" ]; then
    bin="$(resolve_bin_dir)"
    printf '\n'
    warn "Add this to your shell profile if ${BOLD}neo${RESET} is not found:"
    printf "  ${CYAN}export PATH=\"%s:\$PATH\"${RESET}\n" "$bin"
  fi
  printf '\n'
}

bundle_install_url() {
  release_ref="$1"
  cache_buster="$(date +%s 2>/dev/null || printf '%s' "$release_ref")"
  if [ -n "$DOWNLOAD_BASE_URL" ]; then
    printf '%s/releases/%s/neo-termux-bundle.tar.gz?neo_code_cache=%s' "$DOWNLOAD_BASE_URL" "$release_ref" "$cache_buster"
  else
    printf 'https://github.com/%s/releases/download/%s/neo-termux-bundle.tar.gz?neo_code_cache=%s' "$REPO" "$release_ref" "$cache_buster"
  fi
}

log() { printf '%s\n' "$*"; }

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
  need_cmd node || return 1
  need_cmd npm || return 1
  prepare_npm_cache

  major="$(node_major)"
  if [ "$major" -lt 20 ]; then
    err "Node.js >= 20 is required. Current: $(node -v 2>/dev/null || printf unknown)"
    if is_termux; then
      err "Termux hint: pkg install nodejs-lts"
    fi
    return 1
  fi

  step "deps" "Installing dependencies"
  if [ "$install_kind" = "archive" ]; then
    run rm -f "$source_dir/package-lock.json"
    run sh -c "cd \"$source_dir\" && npm install --ignore-scripts"
  else
    run sh -c "cd \"$source_dir\" && npm ci --ignore-scripts"
  fi
  ok "deps"

  if [ "$NO_BUILD" != "1" ]; then
    step "build" "Building packages"
    run sh -c "cd \"$source_dir\" && npm run build"
    ok "build"
  fi

  cli_path="$source_dir/packages/coding-agent/dist/cli.js"
  if [ "$DRY_RUN" != "1" ] && [ ! -f "$cli_path" ]; then
    err "missing built CLI: $cli_path"
    err "run npm run build or re-run installer without --no-build"
    return 1
  fi

  INSTALLED_VERSION="$(detect_source_version "$source_dir")"

  bin="$(resolve_bin_dir)"
  step "link" "Installing neo command to $bin"
  run mkdir -p "$bin"

  target="$bin/neo"
  if [ -e "$target" ] || [ -L "$target" ]; then
    if [ "$FORCE" = "1" ]; then
      run rm -f "$target"
    else
      err "$target already exists. Re-run with --force or choose --bin-dir."
      return 1
    fi
  fi

  run chmod +x "$cli_path"
  run ln -s "$cli_path" "$target"
  ok "link"
}

detect_source_version() {
  dir="$1"
  if [ -f "$dir/packages/coding-agent/package.json" ]; then
    sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
      "$dir/packages/coding-agent/package.json" 2>/dev/null | head -1
  fi
}

detect_bundle_version() {
  dir="$1"
  pkg="$dir/neosantara-code.tgz"
  if [ -f "$pkg" ] && command -v tar >/dev/null 2>&1; then
    # Stream just package/package.json out of the tarball instead of extracting
    # the entire archive. -O writes to stdout, the trailing path filter limits
    # the entries actually decoded.
    ver="$(tar -xzOf "$pkg" package/package.json 2>/dev/null | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
    if [ -n "$ver" ]; then
      printf '%s' "$ver"
      return
    fi
  fi
  printf 'unknown'
}

install_source() {
  if ! is_source_tree; then
    err "source mode must be run from the repo root containing packages/coding-agent"
    err "for curl installs, use --release so the installer can fetch a release asset or source archive"
    return 1
  fi

  print_header "$VERSION"
  install_source_tree "$(pwd)" source
}

platform_asset() {
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"

  case "$os" in
    darwin) os_name="darwin" ;;
    linux) os_name="linux" ;;
    *) err "unsupported OS for release mode: $os"; return 1 ;;
  esac

  case "$arch" in
    x86_64|amd64) arch_name="x64" ;;
    arm64|aarch64) arch_name="arm64" ;;
    *) err "unsupported architecture for release mode: $arch"; return 1 ;;
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
  if [ "$VERSION" = "latest" ]; then
    tag="$(fetch_latest_version)"
    if [ -n "$tag" ]; then
      printf '%s' "$tag"
      return
    fi
    # Could not resolve latest version from API or version.txt
    return
  fi

  printf '%s' "$VERSION"
}

fetch_latest_version() {
  # If a custom download base URL is configured, try its version.txt first.
  if [ -n "$DOWNLOAD_BASE_URL" ]; then
    if command -v curl >/dev/null 2>&1; then
      ver="$(curl -fsSL "${DOWNLOAD_BASE_URL}/releases/version.txt" 2>/dev/null)"
    elif command -v wget >/dev/null 2>&1; then
      ver="$(wget -qO- "${DOWNLOAD_BASE_URL}/releases/version.txt" 2>/dev/null)"
    fi
    if [ -n "${ver:-}" ]; then
      printf '%s' "$ver"
      return
    fi
  fi

  # Fallback: resolve latest tag via GitHub API.
  api_url="https://api.github.com/repos/${REPO}/releases/latest"
  if command -v curl >/dev/null 2>&1; then
    tag="$(curl -fsSL "$api_url" 2>/dev/null | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
  elif command -v wget >/dev/null 2>&1; then
    tag="$(wget -qO- "$api_url" 2>/dev/null | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
  fi
  if [ -n "${tag:-}" ]; then
    printf '%s' "$tag"
  fi
}

download() {
  url="$1"
  out="$2"
  if [ "$DRY_RUN" = "1" ]; then
    # In dry-run we never call curl/wget, so subsequent steps would be unable to
    # operate on $out. Short-circuit with success and let the caller print
    # the would-be command.
    printf '+ download %s -> %s\n' "$url" "$out"
    return 0
  fi
  if command -v curl >/dev/null 2>&1; then
    run curl -fL --progress-bar "$url" -o "$out"
  elif command -v wget >/dev/null 2>&1; then
    run wget -O "$out" "$url"
  else
    err "curl or wget is required for release mode"
    return 1
  fi
}

install_release_source_archive() {
  need_cmd tar || return 1

  release_ref="$(resolve_release_ref)"
  if [ -z "$release_ref" ]; then
    err "could not resolve release reference"
    return 1
  fi

  url="$(source_archive_url "$release_ref")"
  tmp="${TMPDIR:-/tmp}/neo-code-install-$$"
  src_dir="$tmp/src"

  step "fetch" "Downloading source archive"
  run mkdir -p "$tmp"
  download "$url" "$tmp/source.tar.gz" || return 1
  ok "fetch"

  step "extract" "Extracting source archive"
  run mkdir -p "$src_dir"
  run tar -xzf "$tmp/source.tar.gz" -C "$src_dir" --strip-components=1
  ok "extract"

  install_source_tree "$src_dir" archive

  run rm -rf "$tmp"
}

install_termux_bundle() {
  need_cmd tar || return 1

  release_ref="$(resolve_release_ref)"
  if [ -z "$release_ref" ]; then
    err "could not resolve release reference"
    return 1
  fi

  if [ -z "${TERMUX_PREFIX:-}" ]; then
    err "could not detect Termux prefix"
    return 1
  fi

  url="$(bundle_install_url "$release_ref")"
  tmp="${TMPDIR:-/tmp}/neo-code-install-$$"
  bundle_dir="$tmp/bundle"

  step "fetch" "Downloading Termux bundle"
  run mkdir -p "$bundle_dir"
  run mkdir -p "$TERMUX_PREFIX/bin"
  download "$url" "$tmp/neo-termux.tar.gz" || return 1
  ok "fetch"

  step "extract" "Extracting installer bundle"
  run tar -xzf "$tmp/neo-termux.tar.gz" -C "$bundle_dir"
  ok "extract"

  INSTALLED_VERSION="$(detect_bundle_version "$bundle_dir")"

  prepare_npm_cache
  step "install" "Installing Neo Code into $TERMUX_PREFIX"
  run sh -c "cd \"$bundle_dir\" && npm_config_prefix=\"$TERMUX_PREFIX\" npm install -g --no-fund --no-audit ./neosantara-ai.tgz ./neosantara-agent-core.tgz ./neosantara-tui.tgz ./neosantara-code.tgz"
  ok "install"

  run rm -rf "$tmp"
}

install_release() {
  if is_termux; then
    print_header "$VERSION"
    info "Termux detected; using prebuilt npm bundle"
    install_termux_bundle && return
    return 1
  fi

  need_cmd uname || return 1
  need_cmd tar || return 1

  asset="$(platform_asset)" || return 1
  release_ref="$(resolve_release_ref)"
  if [ -z "$release_ref" ]; then
    err "could not resolve release reference"
    return 1
  fi

  url="$(release_asset_url "$release_ref" "$asset")"
  tmp="${TMPDIR:-/tmp}/neo-code-install-$$"
  prefix="$PREFIX"
  bin="$(resolve_bin_dir)"

  print_header "$release_ref"
  step "fetch" "Downloading ${asset}"
  run mkdir -p "$tmp"
  if ! download "$url" "$tmp/$asset"; then
    info "Binary asset unavailable; falling back to source archive build"
    run rm -rf "$tmp"
    print_header "$release_ref"
    install_release_source_archive || return 1
    return
  fi
  ok "fetch"

  step "extract" "Installing to $prefix/neo"
  run rm -rf "$prefix/neo"
  run mkdir -p "$prefix"
  run tar -xzf "$tmp/$asset" -C "$prefix"
  ok "extract"

  run mkdir -p "$bin"
  target="$bin/neo"
  if [ -e "$target" ] || [ -L "$target" ]; then
    if [ "$FORCE" = "1" ]; then
      run rm -f "$target"
    else
      err "$target already exists. Re-run with --force or choose --bin-dir."
      return 1
    fi
  fi
  run ln -s "$prefix/neo/neo" "$target"
  step "verify" "Detecting installed version"
  if command -v neo >/dev/null 2>&1; then
    INSTALLED_VERSION="$(neo --version 2>/dev/null || printf '%s' "$release_ref")"
  else
    INSTALLED_VERSION="$release_ref"
  fi
  ok "verify"

  run rm -rf "$tmp"
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
  source)
    install_source && print_summary neo
    ;;
  release)
    install_release && print_summary neo
    ;;
  *) err "invalid mode: $MODE"; exit 1 ;;
esac
