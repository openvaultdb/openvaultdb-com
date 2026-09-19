# Install OpenVaultDB

Follow these steps in order. Run one command at a time.

First determine the operating system. Remember `PLATFORM` as `windows` when running in Windows PowerShell. Otherwise remember it as `unix`. Where a step gives separate commands, run only the commands for `PLATFORM`.

## 1. Inspect the CLI state

On macOS or Linux, run:

```sh
command -v ovdb
```

On Windows, run in PowerShell:

```powershell
Get-Command ovdb -ErrorAction SilentlyContinue
```

If this prints no path, remember that the CLI state is `absent`. Continue to step 2.

If this prints a path, run:

```sh
ovdb version
```

If the command fails, stop. Report the command and its complete error.

Then run:

```sh
ovdb --help
```

The `COMMANDS` section must contain `server`, `config`, `demo`, and `skills`.

Then run:

```sh
ovdb status --help
```

The description must contain `Show the local OVDB setup`. The flags must contain `--json`.

Then run:

```sh
ovdb databases create --help
```

The flags must contain `--engine` and `--json`.

If all checks pass, remember that the CLI state is `compatible`. If any check is missing, remember that the CLI state is `outdated`.

## 2. Inspect available install methods

On macOS or Linux, run:

```sh
command -v brew
```

If this prints a path, Homebrew is available. If it prints no path, Homebrew is unavailable.

On Windows, remember that Homebrew is unavailable. Do not run the Homebrew command.

The checksum-verified direct installer is available on macOS, Linux, and Windows. On macOS and Linux it installs to `$HOME/.local/bin`. On Windows it installs to `%LOCALAPPDATA%\OpenVaultDB\bin`. It is independent of Homebrew and does not need Go.

The standalone official-skill installer supports Codex and Claude Code. It does not require `ovdb`. If you are Codex, remember `HARNESS` as `codex`. If you are Claude Code, remember `HARNESS` as `claude`. For another agent, skills-only is unavailable.

## 3. Ask for one action

Report the CLI state and whether Homebrew is available. If the CLI is `compatible`, say that no CLI update is required. Ask:

> Choose one:
> 1. Install or update the CLI with Homebrew, then offer the official skill.
> 2. Install or update the CLI with the checksum-verified direct script, then offer the official skill.
> 3. Install or update the official skill only. Do not change the CLI. This writes to the selected agent's skill configuration.
> 4. Abort setup.

Mark option 1 unavailable if Homebrew is unavailable. Mark option 3 unavailable unless `HARNESS` is `codex` or `claude`. Do not renumber the remaining options. Wait for the answer.

If the CLI state is `outdated`, also say that it predates AI onboarding. Option 3 can still install the skill, but CLI-dependent actions remain unavailable until a compatible CLI is installed.

If the person chooses abort, stop cleanly. Do not install a skill. Report that setup was not changed.

If the person chooses skills only, continue to the standalone skill subsection for `PLATFORM` below.

If the person chooses Homebrew, run:

```sh
brew install --cask openvaultdb/tap/ovdb
```

If Homebrew reports that the cask is already installed, run:

```sh
brew upgrade --cask ovdb
```

Then continue to step 4.

If the person chooses direct install, skip the standalone skill subsection and continue to the direct-install subsection for `PLATFORM` below.

### Standalone skill install on macOS or Linux

Run:

```sh
command -v curl
```

If this prints no path, stop. Say that the standalone skill installer needs `curl`.

Run:

```sh
mkdir -p "$HOME/.cache/openvaultdb"
```

Then run:

```sh
curl -fsSLo "$HOME/.cache/openvaultdb/install-skill.sh" https://openvaultdb.com/install-skill.sh
```

Replace `HARNESS` below with `codex` or `claude`, as selected in step 2. Run:

```sh
sh "$HOME/.cache/openvaultdb/install-skill.sh" --harness HARNESS
```

Continue only if the output says that the official OpenVaultDB skill was installed or is already up to date, and prints the canonical source URL plus its verified SHA-256 checksum.

If the installer says the existing `SKILL.md` differs from the official source, ask:

> The installed OpenVaultDB skill has local changes. Replace it with the checksum-verified official skill?

If the person says yes, run:

```sh
sh "$HOME/.cache/openvaultdb/install-skill.sh" --harness HARNESS --replace-changed
```

If the person says no, stop. Keep the existing skill unchanged.

After a successful or already-up-to-date result, run:

```sh
rm "$HOME/.cache/openvaultdb/install-skill.sh"
```

If the CLI state is `compatible`, continue to step 6. If it is `absent` or `outdated`, stop. Report that the skill is installed, but CLI-dependent setup remains unavailable until a compatible `ovdb` is installed.

### Standalone skill install on Windows

In PowerShell, run:

```powershell
$installer = Join-Path $env:TEMP "openvaultdb-install-skill.ps1"
Invoke-WebRequest https://openvaultdb.com/install-skill.ps1 -OutFile $installer
& $installer -Harness HARNESS
```

Replace `HARNESS` with `codex` or `claude`, as selected in step 2. Continue only if the output says that the official OpenVaultDB skill was installed or is already up to date, and prints the canonical source URL plus its verified SHA-256 checksum.

If the installer says the existing `SKILL.md` differs from the official source, ask:

> The installed OpenVaultDB skill has local changes. Replace it with the checksum-verified official skill?

If the person says yes, run:

```powershell
& $installer -Harness HARNESS -ReplaceChanged
```

If the person says no, stop. Keep the existing skill unchanged.

After a successful or already-up-to-date result, run:

```powershell
Remove-Item $installer
```

If the CLI state is `compatible`, continue to step 6. If it is `absent` or `outdated`, stop. Report that the skill is installed, but CLI-dependent setup remains unavailable until a compatible `ovdb` is installed.

### Direct install on macOS or Linux

Run:

```sh
command -v curl
```

If this prints no path, stop. Say that the direct installer needs `curl`. Do not install another package manager without permission.

Run:

```sh
mkdir -p "$HOME/.cache/openvaultdb"
```

Then run:

```sh
curl -fsSLo "$HOME/.cache/openvaultdb/install.sh" https://openvaultdb.com/install.sh
```

Then run:

```sh
sh "$HOME/.cache/openvaultdb/install.sh"
```

The installer downloads the matching official GitHub release archive and `checksums.txt`. It verifies the SHA-256 checksum before installing.

After it succeeds, run:

```sh
rm "$HOME/.cache/openvaultdb/install.sh"
```

Continue to step 4.

### Direct install on Windows

In PowerShell, run:

```powershell
$installer = Join-Path $env:TEMP "openvaultdb-install.ps1"
Invoke-WebRequest https://openvaultdb.com/install.ps1 -OutFile $installer
& $installer
Remove-Item $installer
```

The installer downloads the matching official GitHub release ZIP and `checksums.txt`. It verifies the SHA-256 checksum before installing. Continue to step 4.

## 4. Verify the installed CLI

On macOS or Linux, run:

```sh
command -v ovdb
```

If this prints no path after direct install, run:

```sh
export PATH="$HOME/.local/bin:$PATH"
```

This changes `PATH` only for the current shell. Do not change shell startup files without permission.

On Windows, run in PowerShell:

```powershell
Get-Command ovdb -ErrorAction SilentlyContinue
```

If this prints no command after direct install, run:

```powershell
$env:PATH = "$env:LOCALAPPDATA\OpenVaultDB\bin;$env:PATH"
```

This changes `PATH` only for the current PowerShell session. Do not change the persistent user or machine `PATH` without permission.

Run `ovdb version` and the three capability checks from step 1 again.

If any command fails or any capability is missing, stop. Report the command and its complete output. Say that a compatible CLI release must be published or installed before setup can continue. Do not build from source unless the person explicitly asks.

## 5. Offer the official AI skill

Run:

```sh
ovdb skills list --json
```

In the root `.skills[]` array, select the item whose `.id` is `openvaultdb`. In that selected item's `.targets[]` array, select the target whose `.harness` names the AI agent you are using now.

If that agent is not listed or the selected target's `.detected` is not `true`, report that skills are not supported for this agent. Skip the skill. Continue to step 6.

If the selected target's `.installed` is `true` and its `.state` is `installed`, say the skill is already up to date. Do not ask to install it again. Continue to step 6.

Ask the person:

> Install the official OpenVaultDB skill for this AI agent? This writes to the agent's skill configuration.

If the person says yes, take the selected target's `.harness` value. Replace `HARNESS` below with that value. Run:

```sh
ovdb skills install openvaultdb --harness HARNESS --yes --json
```

If the person says no, skip this step. The web instructions work without the skill.

If skill installation reports that the agent is unsupported or not detected, report it and continue. If it reports another error, stop and report the complete error.

## 6. Continue

If these are the full copied instructions, continue to the `Set up OpenVaultDB` section below.

Otherwise, follow the onboarding instructions:

https://openvaultdb.com/agent-instructions/onboarding

Installation is successful only when `ovdb version` succeeds, all capability checks pass, and the person's selected CLI action is complete.
