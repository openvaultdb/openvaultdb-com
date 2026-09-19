# Configure OpenVaultDB

For this MVP, change only the local server port. The server stays bound to the local machine.

Follow these steps in order. Run one command at a time.

## 1. Inspect the server

Run:

```sh
ovdb server status --json
```

Then run:

```sh
ovdb config get server.port --json
```

Read `.config.server.port`. If it is missing, the current configured value is the default port, `6832`.

If either command fails, stop. Report the command and its complete error.

## 2. Ask for the new port

Ask the person for a port from 1024 to 65535.

Do not choose a port for them. Do not change firewall, router, or public network settings.

Replace `PORT` below with the confirmed number. Run:

```sh
ovdb config set server.port PORT --json
```

Continue only if `.config.server.port` equals the confirmed number. `.changed` is `true` when the file changed and `false` when it already had that value.

If the command fails, stop. Report the command and its complete error.

## 3. Apply and verify

Run:

```sh
ovdb server restart --json
```

If you are in a sandbox and the error is `server_start_failed`, or its reason contains `operation not permitted` or `permission denied`, do not retry with another port. Ask the person to run `ovdb server restart` in their own terminal. Stop until they confirm it succeeded.

Then run:

```sh
ovdb server status --json
```

Configuration is successful only when `.server.state` is `running`, `.server.port` equals the confirmed number, and `.server.address` uses that port.

Report the new address.
