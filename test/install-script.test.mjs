import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const installer = join(root, "public", "install.sh");
const windowsInstaller = join(root, "public", "install.ps1");
const skillInstaller = join(root, "public", "install-skill.sh");
const windowsSkillInstaller = join(root, "public", "install-skill.ps1");
const canonicalSkill = join(root, "public", "agent-skills", "openvaultdb", "SKILL.md");

function executable(path, source) {
  writeFileSync(path, source);
  chmodSync(path, 0o755);
}

function fakeRelease(t, actualChecksum) {
  const testRoot = mkdtempSync(join(tmpdir(), "ovdb-installer-test."));
  const tools = join(testRoot, "tools");
  const fixture = join(testRoot, "fixture");
  const home = join(testRoot, "home");
  const bin = join(testRoot, "installed");
  mkdirSync(tools);
  mkdirSync(fixture);
  mkdirSync(home);
  t.after(() => {
    spawnSync("rm", ["-rf", testRoot]);
  });

  const expected = "a".repeat(64);
  writeFileSync(join(fixture, "checksums.txt"), `${expected}  ovdb_1.2.3_darwin_arm64.tar.gz\n`);
  writeFileSync(join(fixture, "archive"), "fixture archive");
  executable(join(fixture, "ovdb"), "#!/bin/sh\nprintf 'ovdb fixture\\n'\n");

  executable(join(tools, "uname"), `#!/bin/sh
if [ "$1" = "-s" ]; then printf 'Darwin\\n'; else printf 'arm64\\n'; fi
`);
  executable(join(tools, "curl"), `#!/bin/sh
out=
url=
previous=
for value in "$@"; do
  if [ "$previous" = "output" ]; then out=$value; previous=; continue; fi
  case "$value" in
    -o|-fsSLo) previous=output ;;
    http*) url=$value ;;
  esac
done
case "$url" in
  */releases/latest) printf 'https://github.com/openvaultdb/ovdb/releases/tag/v1.2.3' ;;
  */checksums.txt) cp "$FIXTURE/checksums.txt" "$out" ;;
  *.tar.gz) cp "$FIXTURE/archive" "$out" ;;
  *) exit 2 ;;
esac
`);
  executable(join(tools, "shasum"), `#!/bin/sh
printf '%s  %s\\n' "$ACTUAL_CHECKSUM" "${4}"
`);
  executable(join(tools, "tar"), `#!/bin/sh
destination=
previous=
for value in "$@"; do
  if [ "$previous" = "destination" ]; then destination=$value; previous=; continue; fi
  [ "$value" = "-C" ] && previous=destination
done
cp "$FIXTURE/ovdb" "$destination/ovdb"
`);

  const result = spawnSync("sh", [installer], {
    encoding: "utf8",
    env: {
      ...process.env,
      ACTUAL_CHECKSUM: actualChecksum,
      FIXTURE: fixture,
      HOME: home,
      OVDB_INSTALL_DIR: bin,
      PATH: `${tools}:/usr/bin:/bin`,
    },
  });
  return { bin, expected, result };
}

test("direct installer has valid shell syntax and verifies releases", (t) => {
  const syntax = spawnSync("sh", ["-n", installer], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr);

  const source = readFileSync(installer, "utf8");
  assert.match(source, /checksums\.txt/);
  assert.match(source, /SHA-256 checksum verification failed/);
  assert.match(source, /OVDB_INSTALL_DIR/);
  assert.doesNotMatch(source, /\bgo install\b/);

  const expected = "a".repeat(64);
  const success = fakeRelease(t, expected);
  assert.equal(success.result.status, 0, success.result.stderr);
  assert.ok(existsSync(join(success.bin, "ovdb")));
  assert.match(success.result.stdout, /Installed ovdb v1\.2\.3/);
});

test("direct installer refuses a checksum mismatch", (t) => {
  const failed = fakeRelease(t, "b".repeat(64));
  assert.notEqual(failed.result.status, 0);
  assert.match(failed.result.stderr, /checksum verification failed/);
  assert.equal(existsSync(join(failed.bin, "ovdb")), false);
});

test("Windows direct installer verifies the canonical release before installing", () => {
  const source = readFileSync(windowsInstaller, "utf8");
  assert.match(source, /releases\/latest/);
  assert.match(source, /ovdb_\$\{AssetVersion\}_windows_amd64\.zip/);
  assert.match(source, /checksums\.txt/);
  assert.match(source, /Get-FileHash -Algorithm SHA256/);
  assert.match(source, /SHA-256 checksum verification failed/);
  assert.match(source, /OVDB_INSTALL_DIR/);
  assert.match(source, /OVDB_VERSION/);
  assert.match(source, /OpenVaultDB\\bin/);
  assert.match(source, /PROCESSOR_ARCHITEW6432/);
  assert.doesNotMatch(source, /\bgo install\b/);
});

test("Windows skill installer verifies canonical source and preserves changed files", () => {
  const source = readFileSync(windowsSkillInstaller, "utf8");
  const expected = createHash("sha256").update(readFileSync(canonicalSkill)).digest("hex");
  assert.match(source, /ValidateSet\("codex", "claude"\)/);
  assert.match(source, /Get-FileHash -Algorithm SHA256/);
  assert.match(source, new RegExp(expected));
  assert.match(source, /existing SKILL\.md differs.*-ReplaceChanged/);
  assert.match(source, /refusing reparse-point destination/);
  assert.doesNotMatch(source, /__SKILL_SHA256__/);
});

test("standalone skill installer verifies and installs the canonical source", (t) => {
  const syntax = spawnSync("sh", ["-n", skillInstaller], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr);

  const testRoot = mkdtempSync(join(tmpdir(), "ovdb-skill-installer-test."));
  const tools = join(testRoot, "tools");
  const home = join(testRoot, "home");
  mkdirSync(tools);
  mkdirSync(home);
  t.after(() => spawnSync("rm", ["-rf", testRoot]));

  executable(join(tools, "curl"), `#!/bin/sh
out=
previous=
for value in "$@"; do
  if [ "$previous" = "output" ]; then out=$value; previous=; continue; fi
  case "$value" in -o|-fsSLo) previous=output ;; esac
done
cp "$CANONICAL_SKILL" "$out"
`);
  executable(join(tools, "shasum"), `#!/bin/sh
/usr/bin/shasum -a 256 "$3"
`);

  const env = {
    ...process.env,
    CANONICAL_SKILL: canonicalSkill,
    HOME: home,
    PATH: `${tools}:/usr/bin:/bin`,
  };
  const result = spawnSync("sh", [skillInstaller, "--harness", "codex"], {
    encoding: "utf8",
    env,
  });
  assert.equal(result.status, 0, result.stderr);
  const installed = join(home, ".codex", "skills", "openvaultdb", "SKILL.md");
  assert.equal(readFileSync(installed, "utf8"), readFileSync(canonicalSkill, "utf8"));
  const expected = createHash("sha256").update(readFileSync(canonicalSkill)).digest("hex");
  assert.match(result.stdout, new RegExp(expected));
  assert.match(result.stdout, /Source: https:\/\/openvaultdb\.com\/agent-skills\/openvaultdb\/SKILL\.md/);

  chmodSync(installed, 0o444);
  const unchanged = spawnSync("sh", [skillInstaller, "--harness", "codex"], {
    encoding: "utf8",
    env,
  });
  assert.equal(unchanged.status, 0, unchanged.stderr);
  assert.match(unchanged.stdout, /already up to date/);
  assert.equal(readFileSync(installed, "utf8"), readFileSync(canonicalSkill, "utf8"));

  chmodSync(installed, 0o644);
  writeFileSync(installed, "local customization\n");
  const refused = spawnSync("sh", [skillInstaller, "--harness", "codex"], {
    encoding: "utf8",
    env,
  });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /differs from the official source.*--replace-changed/);
  assert.equal(readFileSync(installed, "utf8"), "local customization\n");

  const replaced = spawnSync("sh", [skillInstaller, "--harness", "codex", "--replace-changed"], {
    encoding: "utf8",
    env,
  });
  assert.equal(replaced.status, 0, replaced.stderr);
  assert.equal(readFileSync(installed, "utf8"), readFileSync(canonicalSkill, "utf8"));
});

test("standalone skill installer refuses symlinked destinations", (t) => {
  const testRoot = mkdtempSync(join(tmpdir(), "ovdb-skill-symlink-test."));
  const home = join(testRoot, "home");
  const outside = join(testRoot, "outside");
  mkdirSync(home);
  mkdirSync(outside);
  symlinkSync(outside, join(home, ".codex"));
  t.after(() => spawnSync("rm", ["-rf", testRoot]));

  const result = spawnSync("sh", [skillInstaller, "--harness", "codex"], {
    encoding: "utf8",
    env: { ...process.env, HOME: home },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refusing symlinked destination/);
  assert.equal(existsSync(join(outside, "skills", "openvaultdb", "SKILL.md")), false);
});

test("standalone skill installer rejects unsupported harnesses", () => {
  const result = spawnSync("sh", [skillInstaller, "--harness", "unknown"], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /supported harnesses: codex, claude/);
});
