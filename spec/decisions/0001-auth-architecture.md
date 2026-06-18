---
format: https://specscore.md/decision-specification
status: In Review
---
# Decision: Auth Architecture

**Status:** In Review
**Date:** 2026-06-15
**Owner:** alexandertrakhimenok
**Tags:** authentication, architecture
**Source Idea:** user-owned-auth
**Supersedes:** —
**Superseded By:** —

## Context

OpenVaultDB must let users connect apps to vaults they own while honoring the
core principle that no mandatory central authority sits between a user and their
data. The question is how central openvaultdb.com should be, who issues the
app's data token, how an app proves its identity, and — given GitHub-backed
("serverless") vaults — whether openvaultdb.com must broker GitHub OAuth.

## Decision

1. **The OpenVaultDB account is an optional connection directory, not an
   identity provider.** It stores pointers to a user's vaults and brokers
   consent; the bare protocol works without it.
2. **OpenVaultDB is never in any application's data-access path.** The vault is
   the authority that issues the app's data token; OVDB Connect at most routes
   the app to the vault and then steps out. OVDB's own GitHub OAuth is used only
   on the account/management side (see surfaces below) and is never exposed to
   an app.
3. **App identity is its domain.** `client_id` is the app's authoritative
   domain, proven by the OAuth redirect URI plus a `/.well-known/openvaultdb.yaml`
   manifest (YAML; JSON alias). Namespaces are domain-bounded under the verified
   domain (`<domain>/openvaultdb/<name>` — see Decision 0002).
4. **A manifest may delegate additional origins** via `allowed_origins`, letting
   sibling apps (e.g. sharing one Firebase Auth project) act under the
   authoritative domain's namespace.

### Four authentication surfaces (strictly isolated)

| # | Surface | Who → whom | Providers | Exposed to app? |
|---|---------|-----------|-----------|-----------------|
| 1 | Wallet login | User → openvaultdb.com | Any (email, Google, GitHub, passkey…) | Never |
| 2 | Owner login | App owner → openvaultdb.com | Any (optional; not a registry) | Never |
| 3 | Vault registration | Adding a vault to the wallet | Wallet login for the entry; GitHub optional, only to list repos | Never |
| 4 | App data access | User → the vault authority | OpenVaultDB host · app's own GitHub OAuth/App · user PAT | This **is** the app's token |

Surface 3 has two paths: **manual** — type `[org/repo]` (or an OpenVaultDB host
URL), no GitHub auth, pointer stored unverified; and **picker** — an optional
"Sign in with GitHub" that lists the user's orgs/repos, then discards the token
and keeps only a pointer. The wallet exposes this through a single **My Vaults**
tab; see Decision 0003 (Host / Vault / Namespace Model) for the terminology and
information architecture.

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

- The invariant is now absolute: no "serverless exception." OVDB never brokers
  an app's data token in any mode.
- **Serverless (GitHub-backed vault):** GitHub is the authority. The app obtains
  a repo-scoped token via **its own GitHub OAuth/App**, or the user supplies a
  **fine-grained PAT**. Verified GitHub constraints (2025–2026) shape this:
  - GitHub supports **PKCE** (since 2025-07-14) and recommends it, but still
    **requires `client_secret` for every client** — it does not distinguish
    public from confidential clients, so PKCE alone does not enable a secretless
    browser exchange.
  - The token endpoint `https://github.com/login/oauth/access_token` sends **no
    CORS headers**, so a browser cannot redeem a code (or poll the device flow)
    directly.
  - Therefore "app's own GitHub OAuth" **requires the app to run a minimal
    server-side exchange** (its own secret; should use PKCE). The only **fully
    backendless** path is a **user-pasted fine-grained PAT** used directly
    against GitHub's CORS-enabled REST data API.
  - Apps should prefer a **GitHub App** over a classic OAuth App for **per-repo**
    scoping (`repository_id` / selected-repo install) — true least privilege.
- **User-owned cloud:** raw cloud DBs have no namespace/consent concept, so this
  mode requires an OpenVaultDB host in front (reducing to the self-hosted case).
- Each OpenVaultDB host must implement (or be fronted by) an OAuth-style
  authorize/token endpoint.
- App owners must control a domain and host a manifest — a small barrier, but it
  removes any central registration step.
- The homepage's serverless copy ("no backend to run — OpenVaultDB handles
  GitHub sign-in") is no longer accurate and must be revised.

## Observed Consequences

None observed yet.

## Affected Features

- Authentication Model

---
*This document follows the https://specscore.md/decision-specification*
