#!/bin/sh

# Install the canonical public OpenVaultDB skill without requiring ovdb.
set -eu

source_url="https://openvaultdb.com/agent-skills/openvaultdb/SKILL.md"
expected_sha256="__SKILL_SHA256__"
harness=
replace_changed=false
destination_tmp=

fail() {
  printf 'OpenVaultDB skill install: %s\n' "$1" >&2
  exit 1
}

if [ "${1:-}" = "--harness" ] && [ -n "${2:-}" ] && { [ "$#" -eq 2 ] || { [ "$#" -eq 3 ] && [ "$3" = "--replace-changed" ]; }; }; then
  harness=$2
  [ "$#" -eq 3 ] && replace_changed=true
else
  fail "usage: install-skill.sh --harness codex|claude [--replace-changed]"
fi

case "$harness" in
  codex) agent_root=${CODEX_HOME:-"$HOME/.codex"} ;;
  claude) agent_root=${CLAUDE_CONFIG_DIR:-"$HOME/.claude"} ;;
  *) fail "unsupported harness '$harness'; supported harnesses: codex, claude" ;;
esac
skills_root="$agent_root/skills"
target="$skills_root/openvaultdb"

for path in "$agent_root" "$skills_root" "$target" "$target/SKILL.md"; do
  [ ! -L "$path" ] || fail "refusing symlinked destination: $path"
done

command -v curl >/dev/null 2>&1 || fail "curl is required"

work_dir=$(mktemp -d "${TMPDIR:-/tmp}/openvaultdb-skill.XXXXXX") ||
  fail "could not create a temporary directory"
cleanup() {
  rm -rf "$work_dir"
  if [ -n "$destination_tmp" ]; then
    rm -f "$destination_tmp"
  fi
}
trap cleanup EXIT HUP INT TERM

downloaded="$work_dir/SKILL.md"
curl -fsSLo "$downloaded" "$source_url" || fail "could not download $source_url"

sha256() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{ print $1 }'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{ print $1 }'
  else
    fail "shasum or sha256sum is required"
  fi
}

actual_sha256=$(sha256 "$downloaded")

[ "$actual_sha256" = "$expected_sha256" ] || fail "canonical skill SHA-256 verification failed"

if [ -e "$target/SKILL.md" ]; then
  installed_sha256=$(sha256 "$target/SKILL.md") || fail "could not hash the installed skill"
  if [ "$installed_sha256" = "$expected_sha256" ]; then
    printf 'Official OpenVaultDB skill is already up to date for %s at %s/SKILL.md\n' "$harness" "$target"
    printf 'Source: %s\nSHA-256: %s\n' "$source_url" "$expected_sha256"
    exit 0
  fi
  [ "$replace_changed" = true ] ||
    fail "installed SKILL.md differs from the official source; rerun with --replace-changed only after explicit approval"
fi

mkdir -p "$target" || fail "could not create $target"
destination_tmp="$target/.SKILL.md.install.$$"
cp "$downloaded" "$destination_tmp" || fail "could not copy the skill to $target"
chmod 644 "$destination_tmp" || fail "could not set skill permissions"
mv "$destination_tmp" "$target/SKILL.md" || fail "could not install the skill in $target"
destination_tmp=

printf 'Installed official OpenVaultDB skill for %s at %s/SKILL.md\n' "$harness" "$target"
printf 'Source: %s\nSHA-256: %s\n' "$source_url" "$expected_sha256"
