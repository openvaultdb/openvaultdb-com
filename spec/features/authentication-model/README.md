---
format: https://specscore.md/feature-specification
status: Draft
---
# Feature: Authentication Model

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/authentication-model?op=explore) | [Edit](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/authentication-model?op=edit) | [Ask question](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/authentication-model?op=ask) | [Request change](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/authentication-model?op=request-change) |
**Status:** Draft
**Source Ideas:** user-owned-auth

## Summary

How users connect applications to vaults they own, and how applications prove
their identity. An optional OpenVaultDB account routes apps to the user's chosen
vault, which is the authority that issues the app's token — OpenVaultDB is never
in an app's data path. Apps are identified by a domain they control.

## Problem

Users want to grant any app access to data in a vault they own without
re-entering connection details in every app, and without a mandatory central
authority sitting between them and their data. Apps need a way to prove who they
are so users and vaults can scope access correctly.

## Behavior

### Authentication surfaces

#### REQ: surface-isolation

OpenVaultDB's own authentication (wallet login, owner login, and vault
registration) MUST be kept separate from an application's data authentication:
the system MUST NOT expose an OVDB session or identity to an application, and
OVDB MUST NOT see or hold the token an application uses to read or write vault
data.

#### REQ: wallet-login

A user MUST be able to authenticate to their wallet (their vault directory) with
any supported provider (e.g. email, Google, GitHub, passkey); the provider used
for wallet login MUST NOT be reused as, or exposed as, a data-access credential.

### Connection directory (optional account)

#### REQ: optional-account

The system MUST allow a user to connect an app to a vault without an OpenVaultDB
account by supplying a vault location directly; an account, when present, only
stores pointers to the user's vaults and brokers consent, and MUST NOT store the
user's vault data.

### Vault registration

#### REQ: vault-registration-manual

The system MUST allow a user to add a GitHub-backed vault by entering an
`[org/repo]` pointer (or a server vault URL) without signing in to GitHub; the
stored pointer MAY be unverified, since OVDB never accesses the vault's data.

#### REQ: vault-registration-picker

The system MAY offer an optional "Sign in with GitHub" repo picker that lists the
user's orgs and repositories; when used, the GitHub token MUST be used only to
enumerate repositories and then discarded, with only a pointer retained.

### Token issuance

#### REQ: vault-is-authority

The vault MUST be the authority that authenticates the user and issues the app's
data token; OpenVaultDB MUST NOT mint or broker that token in any mode. For a
server vault, OVDB Connect MAY route the app to the vault's authorize endpoint
and then leave the data path.

#### REQ: serverless-app-token

For a GitHub-backed vault, the application MUST obtain its repo-scoped token via
its own GitHub OAuth/App exchange or via a user-supplied fine-grained personal
access token; OpenVaultDB MUST NOT broker this exchange. Because GitHub requires
a client secret even with PKCE and its token endpoint is not CORS-enabled, a
backendless app MUST use the personal-access-token path.

#### REQ: cloud-needs-server

A user-owned raw cloud backend (e.g. Firestore, DynamoDB) MUST be fronted by an
OpenVaultDB vault server that exposes the authorize/token endpoint; the system
MUST NOT require cloud credentials to be held in the browser.

### App identity

#### REQ: domain-identity

An application's `client_id` MUST be the authoritative domain it controls, and
the namespaces it may access MUST be domain-bounded under that domain
(`<domain>/openvaultdb/<name>` — see Feature: Shared Namespaces), so an app
cannot claim a namespace it cannot prove it owns. Manifests are YAML
(`openvaultdb.yaml`); JSON MAY be accepted as an alias.

#### REQ: identity-proof

The system MUST verify app identity by requiring the OAuth redirect URI to live
on an origin authorized by the app's `/.well-known/openvaultdb.yaml` manifest on
the authoritative domain.

#### REQ: delegated-origins

The manifest MAY list additional origins in `allowed_origins`; a Connect or
authorize request from a listed origin claiming the authoritative domain's
namespace MUST be accepted, and a request from an origin not listed MUST be
rejected.

## Acceptance Criteria

### AC: wallet-login-any-provider (verifies REQ:wallet-login)

**Given** a user with no GitHub account
**When** they sign in to their wallet with email
**Then** they can view and manage their vault directory, and no data-access credential is created.

### AC: ovdb-session-not-exposed (verifies REQ:surface-isolation)

**Given** a user signed in to their wallet
**When** an app uses Connect to pick a vault
**Then** the app receives only the selected vault pointer and never the user's OVDB session or identity.

### AC: connect-without-account (verifies REQ:optional-account)

**Given** a user with no OpenVaultDB account
**When** an app requests access and the user supplies a vault location directly
**Then** the connection completes and the app receives a token from that vault, with OVDB uninvolved.

### AC: connect-via-directory (verifies REQ:optional-account)

**Given** a user with an account that has a registered vault
**When** an app opens the Connect widget and the user selects that vault
**Then** the app is routed to the vault and no vault data is stored by the account.

### AC: register-repo-manually (verifies REQ:vault-registration-manual)

**Given** a user signed in to their wallet with email
**When** they type `alice/my-data` into the vault `[org/repo]` input
**Then** the vault is added as a pointer with no GitHub sign-in required.

### AC: register-repo-via-picker (verifies REQ:vault-registration-picker)

**Given** a user who clicks "Sign in with GitHub to choose vault repo"
**When** they pick a repository from the listed orgs/repos
**Then** only a pointer is stored and the GitHub token used to list repos is discarded.

### AC: vault-mints-token (verifies REQ:vault-is-authority)

**Given** a self-hosted vault server
**When** an app completes the Connect flow
**Then** the access token is issued by the vault and OVDB Connect is absent from the subsequent data path.

### AC: serverless-app-self-brokers (verifies REQ:serverless-app-token)

**Given** a GitHub-backed vault
**When** an app obtains access
**Then** the repo-scoped token comes from the app's own GitHub OAuth/App exchange or a user-supplied fine-grained PAT, and OpenVaultDB never brokers it.

### AC: backendless-app-uses-pat (verifies REQ:serverless-app-token)

**Given** a backendless single-page app and a GitHub-backed vault
**When** the user provides a fine-grained personal access token scoped to the repo
**Then** the browser uses it directly against GitHub's REST API with no token-exchange backend.

### AC: cloud-requires-front-server (verifies REQ:cloud-needs-server)

**Given** a user-owned Firestore backend
**When** the user attempts to connect an app
**Then** the flow requires an OpenVaultDB vault server in front and never exposes cloud credentials to the browser.

### AC: namespace-derived-from-domain (verifies REQ:domain-identity)

**Given** an app with authoritative domain `sneat.app`
**When** it requests a namespace
**Then** it may only obtain namespaces under `sneat.app/openvaultdb/` and is denied any other namespace.

### AC: redirect-uri-must-match (verifies REQ:identity-proof)

**Given** an app whose manifest authorizes `https://sneat.app`
**When** the Connect flow uses a redirect URI on a different, unlisted origin
**Then** the request is rejected.

### AC: delegated-origin-accepted (verifies REQ:delegated-origins)

**Given** `sneat.app`'s manifest lists `https://datatug.app` in `allowed_origins`
**When** a Connect request originates from `datatug.app` claiming the `sneat.app` namespace
**Then** the request is accepted.

### AC: undelegated-origin-rejected (verifies REQ:delegated-origins)

**Given** `sneat.app`'s manifest does not list `https://evil.example`
**When** a Connect request originates from `evil.example` claiming the `sneat.app` namespace
**Then** the request is rejected.

## Open Questions

- Serverless token handling in the browser (session vs. localStorage)?
- Exact scope string vocabulary (`namespace:<domain>:read|write` is illustrative)?
- Manifest caching duration and how an owner revokes a delegated origin quickly?
- Token format and lifetime (JWT vs. opaque; refresh model) — per-vault or a minimum conformance profile?

---
*This document follows the https://specscore.md/feature-specification*
