# Set up OpenVaultDB

Follow these steps in order. Run one command at a time.

## 1. Inspect the current setup

Run:

```sh
ovdb status --json
```

Read `.server.state`, `.server.address`, and `.databases`. Do not change anything yet.

If the command fails, stop. Report the command and its complete error.

## 2. Start the local server

Run:

```sh
ovdb server start --json
```

Starting an already running server is safe.

If you are in a sandbox and the error is `server_start_failed`, or its reason contains `operation not permitted` or `permission denied`, do not retry with another port. Ask the person to run `ovdb server start` in their own terminal. Stop until they confirm it succeeded.

For any other error, stop. Report the command and its complete error.

## 3. Verify real connectivity

Run:

```sh
ovdb server status --json
```

Continue only if `.server.state` is `running` and `.server.address` is not empty.

If it does not, stop. Report the complete output.

## 4. Choose the first database

Ask the person:

> Would you like the TODO demo, or an empty database? The TODO demo is recommended for a first try.

Do not choose for them. Wait for the answer.

### TODO demo

Tell the person that this creates a local database named `todo`. Ask for confirmation.

After they confirm, run:

```sh
ovdb demo install --yes --json
```

Then run:

```sh
ovdb demo status --json
```

Continue only if `.installed` is `true`, `.database` is not empty, and `.state` is `mounted`.

Ask whether to install the optional TODO AI skill. If the person says yes, run:

```sh
ovdb skills install todo-demo --yes --json
```

To try to give the person the TODO app links, run:

```sh
ovdb demo open --print-url --json
```

If `.url` and `.fallback_url` are returned, show both. Explain that `.url` is single-use and valid until `.expires_at`.

If the command reports that this build has no web console or TODO app, do not fail the setup. Report that the database is ready but this CLI build has no browser app. Show the install options from the error. Give this useful CLI example instead:

```sh
ovdb list /lists/to-buy/items --db todo --json
```

### Empty database

Ask for a short database name. Use lower-case letters, numbers, and hyphens only.

Tell the person that this creates files on this machine. Wait for confirmation.

Replace `NAME` below with the confirmed name. Run:

```sh
ovdb databases create NAME --engine ingitdb --json
```

Then run:

```sh
ovdb databases --json
```

In the root `.databases[]` array, select the item whose `.id` is the confirmed name. Continue only if that selected item's `.state` is `mounted`.

If any database or demo command fails, stop and report the command and its complete error. The missing-browser-app case described above is the only exception.

## 5. Complete one useful action

Ask permission to create one sample record in the chosen database. Explain that this verifies both writing and reading. If the person says no, skip the sample and report that database connectivity was verified but record read/write was not tested.

For the TODO demo, run:

```sh
ovdb add /lists/to-buy/items '{"title":"Try OpenVaultDB","done":false}' --db todo --json
```

Read `.key` from the result. Replace `KEY` below with that exact absolute path. Run:

```sh
ovdb get KEY --db todo --json
```

Continue only if `.path` equals `KEY`, `.data.title` is `Try OpenVaultDB`, and `.data.done` is `false`.

For an empty database, replace `NAME` with the confirmed database name. Run:

```sh
ovdb set /welcome/status '{"message":"OpenVaultDB is ready"}' --db NAME --json
```

Then run:

```sh
ovdb get /welcome/status --db NAME --json
```

Continue only if `.path` is `/welcome/status` and `.data.message` is `OpenVaultDB is ready`.

If a write or read fails, stop. Report the command and its complete error.

## 6. Final verification

Run:

```sh
ovdb status --json
```

Setup is successful only when:

- `.server.state` is `running`;
- `.server.address` is not empty;
- `.databases` contains at least one item; and
- the selected item from the root `.databases[]` array has `.state` equal to `mounted`.

Report `.server.address`, the selected database item's `.id` and `.location`, and a useful item from the root `.next[]` array.

Also report whether the sample record check passed or was declined.

Do not register with OpenVaultDB Cloud. Cloud registration is optional and is not part of this onboarding flow.

To change the local server port later, follow:

https://openvaultdb.com/agent-instructions/configure
