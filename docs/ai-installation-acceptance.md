# AI installation acceptance runbook

Version 1 · 2026-09-19

This runbook validates the public OpenVaultDB installation journey with a
small, inexpensive agent. Use Luna unless the release owner names another
small-model baseline. Luna is the operator under test, not a reviewer with
repository context.

## Acceptance boundary

Give Luna exactly the short prompt published on the homepage and `/install`:

```text
Install and set up OpenVaultDB on this machine.

Follow the official instructions:
https://openvaultdb.com/agent-instructions/install
```

Do not add hints, repository paths, command names, expected JSON, or recovery
steps. Record every clarification Luna requests. The public instruction pages
are the only product instructions it may read.

The primary clean-user path assumes no Go toolchain. Do not add Go, `GOBIN`,
or `GOCACHE` to the test environment. Test `go install` only as a separate,
optional developer fallback; it is not public-install acceptance.

## Isolated environment

Use a disposable host when possible. Otherwise create one fresh temporary
root and keep every mutation inside it. Configure the test controller before
starting Luna:

```sh
export OVDB_ACCEPTANCE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ovdb-luna.XXXXXX")"
export HOME="$OVDB_ACCEPTANCE_ROOT/home"
export OVDB_HOME="$OVDB_ACCEPTANCE_ROOT/config"
export OVDB_DATA_HOME="$OVDB_ACCEPTANCE_ROOT/data"
export OVDB_RUNTIME_DIR="$OVDB_ACCEPTANCE_ROOT/run"
export OVDB_INSTALL_DIR="$OVDB_ACCEPTANCE_ROOT/bin"
export OVDB_PORT="REPLACE_WITH_RECORDED_UNUSED_PORT"
export PATH="$OVDB_ACCEPTANCE_ROOT/bin:/usr/bin:/bin:/usr/sbin:/sbin"
mkdir -p "$HOME" "$OVDB_INSTALL_DIR"
```

Choose and record an unused loopback port, replace the placeholder in
`OVDB_PORT`, and preserve that environment variable for Luna's commands. Do
not reuse a developer's normal OVDB port or directories. Before Luna receives
the prompt, record these
checks:

```sh
command -v ovdb
command -v go
```

Both commands must print no path. Keep the exact output and exit status as
evidence. Do not copy a developer's config, credentials, skills, or databases
into the temporary home.

## Pre-release-candidate variant

Use this variant before the compatible CLI release exists. It validates the
setup journey, not public binary distribution.

1. Start with the isolated environment and exact short prompt above.
2. Let Luna reach the explicit release-availability stop. Record its wording.
3. Outside Luna, have the test controller place the reviewed release-candidate
   `ovdb` binary at `$OVDB_INSTALL_DIR/ovdb` and make only that file
   executable. Building the candidate is maintainer setup and may use a Go
   toolchain outside the clean-user environment.
4. Tell Luna only: `A compatible release candidate is now available on PATH.
   Continue from the verification step.`
5. Continue with the common checks below.

Do not describe this as public-install acceptance. Do not publish the website
until the CLI capability checks pass against an actual release.

## Post-release public-install variant

Use this variant after the compatible CLI release is public.

1. Start with the isolated environment and exact short prompt above.
2. With Homebrew absent from the sanitized `PATH`, Luna must reach the public
   checksum-verified direct installer. It must install into
   `$OVDB_INSTALL_DIR`, verify the release checksum, and run `ovdb version`.
3. Separately test method choice on a disposable host where Homebrew is
   available. Luna must ask once using the four numbered choices: Homebrew CLI
   install/update, checksum-verified direct CLI install/update, standalone
   official-skill install/update, or abort. Homebrew is recommended for
   package-managed updates. Exercise Homebrew only on a disposable host where
   package-manager mutation is acceptable. Exercise direct install with an
   isolated `OVDB_INSTALL_DIR`. Verify that abort changes nothing.
4. Run the skills-only choice once with `ovdb` absent. Luna must select the
   current supported harness, use the public standalone installer, verify the
   canonical skill source and SHA-256, and write only inside the isolated
   agent configuration. It must then stop and say that CLI-dependent actions
   remain unavailable. Run it again with a compatible CLI; it may continue to
   onboarding after the skill is installed or already current.

Never install, upgrade, unlink, or uninstall a package in the maintainer's
global Homebrew state. Never globally uninstall an existing `ovdb`. A failed
isolated run is cleaned by discarding only its recorded temporary root.

## Common Luna checks

Observe Luna without coaching and record commands, outputs, durations, and
friction at each boundary:

1. **Install and capability verification.** Luna detects the initially missing
   CLI, obtains it by the allowed variant, runs `ovdb version`, and verifies the
   public command surface. It does not use `OVDB_PREVIEW`.
2. **Consent.** Luna asks before installing an AI skill. Accept once. If the
   skill is already current, Luna skips the question. Luna does not enable
   usage statistics without separate consent.
3. **Server and real connectivity.** Luna starts the local server on the
   recorded port. `ovdb server status --json` must report `.server.state` as
   `running`, and the reported `.server.address` must answer the CLI's real
   connectivity check. A PID file alone is not acceptance.
4. **Useful database.** Accept either the TODO demo or a newly created
   database. Capture its exact database id and require the matching JSON state
   to be `mounted`.
5. **Useful action.** Require one write and one read against that exact
   database using an absolute path and `--json`. For the TODO demo, adding an
   item and listing the same list is sufficient. Confirm the returned key or
   record is the value just written.
6. **Final verification.** `ovdb status --json` must show a running server and
   the accepted database. Luna's final report must name the database id, data
   location, useful action, and one next command.

A sandbox bind failure is evidence, not permission to fake success. Record the
structured error, then rerun on a disposable environment that permits a real
loopback listener.

## Evidence and friction record

For each run, save outside the product repository:

- CLI release tag, commit if known, OS, architecture, and Luna model label;
- the exact public short prompt and instruction-page revision;
- every command, exit status, and complete structured error;
- relevant JSON fields used for each decision;
- server address, database id, data location, and useful-action receipt;
- questions, retries, ambiguous wording, invented commands, or skipped gates;
- whether the run is pre-release-candidate or post-release-public-install;
- cleanup result.

Classify friction as instruction ambiguity, CLI behavior, environment policy,
release/distribution, or model behavior. Do not silently coach around it.

## Process ownership and cleanup

The acceptance controller owns every process started under the temporary
root. Before cleanup, record the server PID from
`$OVDB_RUNTIME_DIR/server.json` and the resolved executable path.

Ask Luna to run:

```sh
ovdb server stop --json
ovdb server status --json
```

The final state must be `not_running`. If graceful stop fails, terminate only
the recorded PID after verifying that its executable is the isolated
`$OVDB_INSTALL_DIR/ovdb`. Never use a broad process-name kill.

Finally, discard only the exact `$OVDB_ACCEPTANCE_ROOT` created for this run.
Do not remove any global binary, package, config directory, or unrelated
temporary directory. Record whether graceful cleanup succeeded.
