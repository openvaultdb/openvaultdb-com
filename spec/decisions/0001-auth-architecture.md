---
format: https://specscore.md/decision-specification
status: Proposed
---
# Decision: Auth Architecture

**Status:** Proposed
**Date:** 2026-06-15
**Owner:** alexandertrakhimenok
**Tags:** authentication, architecture
**Source Idea:** user-owned-auth
**Supersedes:** —
**Superseded By:** —

## Context

OpenVaultDB must let users connect apps to vaults they own while honoring the
core principle that no mandatory central authority sits between a user and their
data. openvaultdb.com is already committed as a convenience for serverless
GitHub OAuth, which forces a choice about how central it should be everywhere
else, who issues app tokens, and how an app proves its identity.

## Decision

1. **The OpenVaultDB account is an optional connection directory, not an
   identity provider.** It stores pointers to a user's vaults and brokers
   consent; the bare protocol works without it.
2. **The vault is the authority; OVDB Connect only routes.** OVDB never mints
   the app's access token. It routes the app to the vault's own authorize
   endpoint, then leaves the data path.
3. **App identity is its domain.** `client_id` is the app's authoritative
   domain, proven by the OAuth redirect URI plus a `/.well-known/openvaultdb.json`
   manifest. The namespace derives from the verified domain.
4. **A manifest may delegate additional origins** via `allowed_origins`, letting
   sibling apps (e.g. sharing one Firebase Auth project) act under the
   authoritative domain's namespace.

## Rationale

Keeping the account optional and the vault as the authority is the only
combination that preserves decentralization while improving UX: if OVDB minted
tokens, apps would depend on it and it would cease to be optional. Domain
identity needs no central registry, is self-verifying, and maps 1:1 onto the
existing namespace tree, so an app can only claim a namespace it can prove it
owns. `allowed_origins` is safe because only the controller of the authoritative
domain can edit its manifest — a domain can pull other origins into *its own*
namespace but cannot claim a namespace it is not named by.

## Declined Alternatives

### No account (pure protocol)

Re-enter provider details in every app. Maximum decentralization, unacceptable UX.

### Full identity provider (OIDC broker)

OVDB as central login and token minter. Best UX, but becomes the central
authority the project exists to avoid.

### Central app registry / per-vault app approval

A registry makes OVDB a gatekeeper every app must register with; per-vault
approval makes users whitelist every app against every vault. Both rejected —
the first conflicts with "optional," the second is unusable.

## Consequences at Decision Time

- One auth model across backends, with two explicit carve-outs:
  - **Serverless (browser→GitHub):** GitHub is the authority and OVDB
    necessarily brokers OAuth (holds the client secret) — the single
    acknowledged exception where OVDB sits in the auth path.
  - **User-owned cloud:** raw cloud DBs have no namespace/consent concept, so
    this mode requires a vault server in front (reducing to the self-hosted case).
- Each vault deployment must implement (or be fronted by) an OAuth-style
  authorize/token endpoint.
- App owners must control a domain and host a manifest — a small barrier, but it
  removes any central registration step.

## Observed Consequences

None observed yet.

## Affected Features

- Authentication Model

---
*This document follows the https://specscore.md/decision-specification*
