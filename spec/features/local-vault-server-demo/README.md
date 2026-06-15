---
format: https://specscore.md/feature-specification
status: Draft
---
# Feature: Local Vault Server Demo

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/local-vault-server-demo?op=explore) | [Edit](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/local-vault-server-demo?op=edit) | [Ask question](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/local-vault-server-demo?op=ask) | [Request change](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/local-vault-server-demo?op=request-change) |
**Status:** Draft
**Source Ideas:** —

## Summary

The first end-to-end milestone: a user registers vaults (a private GitHub repo
and a private OVDB server on localhost), browses the vaults a server hosts, and
connects a demo to-do app to a vault on the local server via the connect flow.
The frontend (wallet) lives in openvaultdb-com, the server in openvaultdb-go, the
demo app in openvaultdb-todo-demo. The frontend↔server wire contract is the
TypeSpec at `interface/main.tsp`.

## Problem

OpenVaultDB has specs but no working path a user can touch. This milestone proves
the core loop — register a vault, see what a server holds, and let an app
read/write data in a vault through the connect flow.

## Behavior

### Vault registration

#### REQ: register-github-repo-vault

The wallet MUST let a user register a private GitHub repository as a vault by
choosing it from a list loaded via the GitHub API (repos the signed-in user can
access), storing it as a pointer in the user's wallet.

#### REQ: register-ovdb-server

The wallet MUST provide a `/my/servers` page where a user registers a private
OVDB server by base URL (localhost for now); the wallet MUST validate the server
by fetching `GET /.well-known/openvaultdb` (per `interface/main.tsp`) before
saving it.

### Vault discovery

#### REQ: list-server-vaults

For a registered OVDB server, the wallet MUST list the vaults the server hosts by
calling `GET /vaults` with the owner token, and MUST let the user drill into a
vault's namespaces (`GET /vaults/{vaultId}/namespaces`).

### App connect

#### REQ: connect-demo-app

The demo to-do app MUST obtain access to a namespace on a vault hosted by the
local OVDB server via the connect flow (`GET /authorize` → consent →
`POST /token` → scoped token), then read and write its to-do records through the
data endpoints, limited to its granted scope.

#### REQ: contract-conformance

The OVDB server and all callers MUST conform to the HTTP contract defined in
`interface/main.tsp` (server identity, vaults, connect, and record
endpoints); the contract is the single source of truth for the wire format.

## Acceptance Criteria

### AC: pick-github-repo (verifies REQ:register-github-repo-vault)

**Given** a user signed in with GitHub
**When** they open the add-vault flow and pick a private repo from the GitHub-API-loaded list
**Then** the repo is saved as a vault pointer in their wallet.

### AC: register-and-validate-server (verifies REQ:register-ovdb-server)

**Given** a local OVDB server running at `http://localhost:8088`
**When** the user enters that URL on `/my/servers`
**Then** the wallet fetches `/.well-known/openvaultdb`, shows the server identity, and saves the server on success (and rejects an unreachable/invalid URL).

### AC: list-vaults-and-namespaces (verifies REQ:list-server-vaults)

**Given** a registered local OVDB server hosting at least one vault
**When** the user opens that server in the wallet
**Then** the wallet shows the vaults from `GET /vaults` and the namespaces of a selected vault.

### AC: demo-app-connects-and-writes (verifies REQ:connect-demo-app)

**Given** the demo to-do app and a vault on the local server
**When** the user completes the connect flow and grants the app a namespace
**Then** the app receives a scoped token and can create, list, update, and delete to-do records within that namespace.

### AC: endpoints-match-contract (verifies REQ:contract-conformance)

**Given** the compiled contract at `interface/main.tsp`
**When** the server and frontend are exercised
**Then** every request/response matches the contract's paths, methods, and shapes.

## Open Questions

- Owner-token issuance for the local server (how the owner obtains/pastes it) vs. a future owner login.
- To-do namespace identifier and collection schema (an inGitDB `.ingitdb-collection.yaml` for `tasks`).
- Whether the demo app is served standalone or behind a dev proxy for the redirect_uri.

---
*This document follows the https://specscore.md/feature-specification*
