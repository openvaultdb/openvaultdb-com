---
format: https://specscore.md/idea-specification
status: Approved
---

# Idea: Multi-User Vault Access

**Status:** Approved
**Date:** 2026-06-15
**Owner:** alexandertrakhimenok
**Promotes To:** —
**Supersedes:** —
**Related Ideas:** —

## Problem Statement

How might we let a vault owner grant other people access — scoped to specific apps and data — using one familiar, verifiable identifier format?

## Context

Builds on the auth model (domain-identity, wallet login via Google/GitHub/email) and shared-namespaces (per-app ACL). Those cover apps accessing a single owner's vault; they do not cover granting OTHER PEOPLE access. The user wants a commonly-used standard identifier (email@example.com, user-id@github.com, *@acme.com) to express who may use the vault and for which apps.

## Recommended Direction

Identify external principals with familiar, verifiable URI-shaped handles,
distinguishing two personas (RFC 7565 / WebFinger): an **email** principal
`someone@example.com` (≡ `mailto:`), verified by email control; and a
**provider-account** principal `acct:someone@github.com`, verified by OAuth at
that provider and stored by the provider's **immutable user-id** (the handle is
display only, so a username rename can't silently transfer access). This removes
the `someone@github.com` collision — that is an email (a github.com employee),
distinct from the GitHub account `acct:someone@github.com`.

The authority (domain) is whatever can verify the subject: github.com /
google.com / facebook.com built in as OAuth providers, plain email domains via
email control, and org domains declaring their method (email-domain match or an
OIDC issuer) in their `.well-known/openvaultdb.yaml`. Wildcards address everyone
an authority vouches for — `*@acme.com` (any verified acme.com email) or
`acct:*@acme.com` (any account under acme.com's declared IdP) — capped at lower
tiers (never co-admin).

Grants are `(principal, scope, role)` over three nested scopes: **vault** and
**namespace** (co-user / co-admin) and **app-on-namespace** (a named role from
the shared-namespaces catalog). Effective access for a user via an app is the
**intersection** of the user's grant and that app's namespace ACL. Owners and
co-admins manage grants in the wallet; access is checked at connect time by
mapping the authenticated login to its canonical principal and matching it
against grants.

## Alternatives Considered

- **Plain email only (RFC 5322).** Universal and familiar, but can't name a
  GitHub/Facebook account distinctly from a same-domain email, and loses
  provider-verified identity. Lost on the very collision that motivated this.
- **OAuth-provider handles only.** Names accounts cleanly, but can't address
  someone by a raw email or by an org's own IdP. Too narrow for the personal +
  public use cases.
- **Decentralized identity (DID / WebID / SPIFFE).** More "correct" for open
  federation, but heavyweight and unfamiliar; `acct:` / `mailto:` is the 80/20
  users already grasp and reuses the wallet's existing providers. Revisit later.

## MVP Scope

Named principals via OAuth providers and email, granted at all three tiers (vault/namespace co-user|co-admin; app+role), plus authority-vouched wildcards capped below co-admin; verification by mapping a wallet login to a canonical subject@authority and enforcing at connect time.

## Not Doing (and Why)

- Decentralized identity (DIDs / WebID / SPIFFE) — subject@authority is the familiar 80/20; revisit later
- Cross-vault federation / following users across vaults — out of scope
- Per-record (row-level) user permissions — collection-level only, per shared-namespaces
- Advanced public-tier abuse controls beyond basic rate limiting — later

## Key Assumptions to Validate

| Tier | Assumption | How to validate |
|------|------------|-----------------|
| Must-be-true | A wallet login maps to a canonical principal — a GitHub OAuth login yields `acct:<immutable-id>@github.com`; an email login yields the verified email | Prototype the login→principal mapping for GitHub, Google, and email in the reference wallet |
| Must-be-true | An org domain can declare a verifiable method (email-domain match or an OIDC issuer) so `*@acme.com` / `acct:*@acme.com` can be checked | Model an `acme.com` `.well-known/openvaultdb.yaml` principals/idp block and verify a token against it |
| Should-be-true | Users can grant correctly despite the acct-vs-email distinction (or the wallet hides it behind "add by GitHub / by email") | Usability test of the grant UI |
| Should-be-true | Co-admin re-granting does not create confusing privilege tangles | Walk delegation scenarios across the three tiers |
| Might-be-true | Public-tier use wants an "anyone authenticated" pseudo-principal | Probe with a public-dataset scenario |


## SpecScore Integration

- **New Features this would create:** Multi-User Vault Access (principal
  identifiers, the three grant tiers, and login→principal verification).
- **Existing Features affected:** Authentication Model (login→principal mapping;
  a principals/idp block in the identity manifest), Shared Namespaces
  (user-grant ∩ app-ACL composition; namespace co-admin vs. schema owner).
- **Dependencies:** Decision 0001 (auth architecture), Decision 0002 (shared
  namespaces).

## Open Questions

- Canonical subject per provider — immutable id vs. handle, and how renames are handled.
- How an org domain declares its verification method (email-domain vs. OIDC issuer) in the identity manifest.
- Precedence when a principal matches multiple grants (explicit named vs. wildcard; most-specific-wins vs. union of scopes).
- How user-grants compose with app-ACLs — confirm the intersection semantics, and what a namespace co-admin may do vs. the schema owner.
- Revocation propagation and grant expiry; offboarding when a wildcard authority's membership changes.
- Abuse resistance for the public tier (rate limits, "anyone authenticated").
