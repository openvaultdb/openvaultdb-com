#!/bin/sh

# Install an official OpenVaultDB CLI release without a language toolchain.
# OVDB_INSTALL_DIR may override the default per-user destination.
# OVDB_VERSION may pin a release tag such as v0.4.0.
set -eu

repo="https://github.com/openvaultdb/ovdb"
install_dir=${OVDB_INSTALL_DIR:-"$HOME/.local/bin"}
version=${OVDB_VERSION:-}
destination_tmp=

fail() {
  printf 'ovdb install: %s\n' "$1" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || fail "curl is required"

case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *) fail "unsupported operating system: $(uname -s)" ;;
esac

case "$(uname -m)" in
  x86_64|amd64) arch=amd64 ;;
  arm64|aarch64) arch=arm64 ;;
  *) fail "unsupported architecture: $(uname -m)" ;;
esac

if [ -z "$version" ]; then
  latest_url=$(curl -fsSIL -o /dev/null -w '%{url_effective}' "$repo/releases/latest") ||
    fail "could not resolve the latest release"
  version=${latest_url##*/}
fi

case "$version" in
  v[0-9]*) ;;
  *) fail "release version must be a tag such as v0.4.0" ;;
esac

asset_version=${version#v}
archive="ovdb_${asset_version}_${os}_${arch}.tar.gz"
release_url="$repo/releases/download/$version"
work_dir=$(mktemp -d "${TMPDIR:-/tmp}/ovdb-install.XXXXXX") ||
  fail "could not create a temporary directory"

cleanup() {
  rm -rf "$work_dir"
  if [ -n "$destination_tmp" ]; then
    rm -f "$destination_tmp"
  fi
}
trap cleanup EXIT HUP INT TERM

curl -fsSLo "$work_dir/checksums.txt" "$release_url/checksums.txt" ||
  fail "could not download checksums for $version"
curl -fsSLo "$work_dir/$archive" "$release_url/$archive" ||
  fail "could not download $archive"

expected=$(awk -v file="$archive" '$2 == file || $2 == "*" file { print $1; exit }' "$work_dir/checksums.txt")
[ -n "$expected" ] || fail "$archive is missing from checksums.txt"

if command -v shasum >/dev/null 2>&1; then
  actual=$(shasum -a 256 "$work_dir/$archive" | awk '{ print $1 }')
elif command -v sha256sum >/dev/null 2>&1; then
  actual=$(sha256sum "$work_dir/$archive" | awk '{ print $1 }')
else
  fail "shasum or sha256sum is required"
fi

[ "$actual" = "$expected" ] || fail "SHA-256 checksum verification failed"

tar -xzf "$work_dir/$archive" -C "$work_dir" || fail "could not extract $archive"
[ -f "$work_dir/ovdb" ] || fail "release archive does not contain ovdb"

mkdir -p "$install_dir" || fail "could not create $install_dir"
destination_tmp="$install_dir/.ovdb.install.$$"
cp "$work_dir/ovdb" "$destination_tmp" || fail "could not copy ovdb to $install_dir"
chmod 755 "$destination_tmp" || fail "could not make ovdb executable"
mv "$destination_tmp" "$install_dir/ovdb" || fail "could not install ovdb in $install_dir"
destination_tmp=

printf 'Installed ovdb %s at %s/ovdb\n' "$version" "$install_dir"
case ":$PATH:" in
  *":$install_dir:"*) ;;
  *) printf 'Add %s to PATH for this shell: export PATH="%s:$PATH"\n' "$install_dir" "$install_dir" ;;
esac
