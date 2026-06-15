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
vault, which authenticates the user and issues scoped tokens. Apps are
identified by a domain they control.

## Problem

Users want to grant any app access to data in a vault they own without
re-entering connection details in every app, and without a mandatory central
authority sitting between them and their data. Apps need a way to prove who they
are so users and vaults can scope access correctly.

## Behavior

### Connection directory (optional account)

#### REQ: optional-account

The system MUST allow a user to connect an app to a vault without an OpenVaultDB
account by supplying a vault location directly; an account, when present, only
stores pointers to the user's vaults and brokers consent, and MUST NOT store the
user's vault data.

### Token issuance

#### REQ: vault-is-authority

The vault MUST be the authority that authenticates the user and issues the app's
scoped access token; OpenVaultDB Connect MUST only route the app to the vault's
authorize endpoint and MUST NOT mint the app's access token, except in
serverless mode where GitHub is the authority and OVDB brokers the GitHub OAuth
exchange.

#### REQ: cloud-needs-server

A user-owned raw cloud backend (e.g. Firestore, DynamoDB) MUST be fronted by an
OpenVaultDB vault server that exposes the authorize/token endpoint; the system
MUST NOT require cloud credentials to be held in the browser.

### App identity

#### REQ: domain-identity

An application's `client_id` MUST be the authoritative domain it controls, and
the namespace it may access MUST derive from that domain, so an app cannot claim
a namespace it cannot prove it owns.

#### REQ: identity-proof

The system MUST verify app identity by requiring the OAuth redirect URI to live
on an origin authorized by the app's `/.well-known/openvaultdb.json` manifest on
the authoritative domain.

#### REQ: delegated-origins

The manifest MAY list additional origins in `allowed_origins`; a Connect or
authorize request from a listed origin claiming the authoritative domain's
namespace MUST be accepted, and a request from an origin not listed MUST be
rejected.

## Acceptance Criteria

### AC: connect-without-account (verifies REQ:optional-account)

**Given** a user with no OpenVaultDB account
**When** an app requests access and the user supplies a vault location directly
**Then** the connection completes and the app receives a scoped token from that vault.

### AC: connect-via-directory (verifies REQ:optional-account)

**Given** a user with an account that has a registered vault
**When** an app opens the Connect widget and the user selects that vault
**Then** the app is routed to the vault and no vault data is stored by the account.

### AC: vault-mints-token (verifies REQ:vault-is-authority)

**Given** a self-hosted vault server
**When** an app completes the Connect flow
**Then** the access token is issued by the vault and OVDB Connect is absent from the subsequent data path.

### AC: serverless-broker-exception (verifies REQ:vault-is-authority)

**Given** serverless mode with a GitHub-backed vault
**When** an app completes the Connect flow
**Then** OVDB brokers the GitHub OAuth exchange and the app receives a repo-scoped GitHub token used directly against the GitHub API.

### AC: cloud-requires-front-server (verifies REQ:cloud-needs-server)

**Given** a user-owned Firestore backend
**When** the user attempts to connect an app
**Then** the flow requires an OpenVaultDB vault server in front and never exposes cloud credentials to the browser.

### AC: namespace-derived-from-domain (verifies REQ:domain-identity)

**Given** an app with authoritative domain `sneat.app`
**When** it requests a namespace
**Then** it may only obtain the `sneat.app` namespace and is denied any other namespace.

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
