---
format: https://specscore.md/idea-specification
status: Specifying
---
# Idea: User Owned Auth

**Status:** Specifying
**Date:** 2026-06-15
**Owner:** alexandertrakhimenok
**Promotes To:** authentication-model
**Supersedes:** —
**Related Ideas:** —

## Problem Statement

How might we let a user connect any app to a vault they own — without forcing
them to re-enter connection details in every app, and without reintroducing a
central authority the project exists to avoid?

## Context

OpenVaultDB's core principle is that applications do not own user data; users
own their data and grant apps permission. The site already commits to one
central touch point: serverless mode states "openvaultdb.com handles the GitHub
OAuth flow." That raises the question of how central openvaultdb.com should be
across all four deployment modes (self-hosted, OVDB-hosted, user-owned cloud,
serverless browser-to-Git). Prior art: Solid Pods, remoteStorage, OAuth/OIDC.

## Recommended Direction

Provide an **optional** OpenVaultDB account that acts as a *connection directory*
("vault wallet"): the user registers their providers once and apps reuse them
through a Connect widget. The account stores pointers and brokers consent — it
never holds the user's data and never becomes a mandatory login. The bare
protocol must keep working for self-hosters who never visit openvaultdb.com.

Crucially, the directory does not mint tokens: **the vault is the authority and
OVDB only routes** to it. This is what keeps the account genuinely optional
rather than a dependency.

## Alternatives Considered

- **No account, pure protocol** — every app shows its own connection form and
  the user re-enters provider details everywhere. Most decentralized, worst UX.
- **Full identity provider (OIDC broker)** — "Sign in with OpenVaultDB" in the
  data path. Best UX, but makes OVDB the central authority the project reacts
  against. Lost on principle.

## MVP Scope

Define the auth model: an optional connection directory, vault-as-authority
token issuance, and domain-based app identity — enough that one app can connect
to one self-hosted vault and read/write its own namespace.

## Not Doing (and Why)

- Central app registry / verified directory — conflicts with "optional"; deferred to a convenience layer later.
- Browser-direct-to-cloud as a first-class mode — would force a second, weaker auth path.
- Table/row-level permission scopes — namespace-level scopes are enough for MVP.

## Key Assumptions to Validate

| Tier | Assumption | How to validate |
|------|------------|-----------------|
| Must-be-true | Every vault deployment can expose an OAuth-style authorize/token endpoint (or be fronted by one) | Prototype the endpoint on the reference Go server and the GitHub broker |
| Should-be-true | App owners will host a `/.well-known/openvaultdb.yaml` manifest on a domain they control | Validate with the existing sneat.app / datatug.app apps |
| Might-be-true | Users accept picking a vault from a directory as the consent step | Usability check on the Connect widget |

## SpecScore Integration

- **New Features this would create:** Authentication Model
- **Existing Features affected:** none
- **Dependencies:** Decision 0001 (Auth Architecture); Encryption model (separate) for multi-device keys

## Open Questions

- Serverless token handling in the browser (session vs. localStorage)?
- Exact scope string vocabulary?
- Manifest caching / delegated-origin revocation speed?

---
*This document follows the https://specscore.md/idea-specification*
