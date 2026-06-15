---
format: https://specscore.md/plan-specification
status: Approved
---
# Plan: Multi User Vault Access

**Status:** Approved
**Source Feature:** multi-user-vault-access
**Date:** 2026-06-15
**Owner:** alexandertrakhimenok
**Supersedes:** —

## Summary

Implements Multi-User Vault Access: a federated principal-identifier scheme
(email vs `acct:` accounts), login→principal verification, a three-tier grant
ACL (vault / namespace / app-on-namespace) with co-user/co-admin and named roles,
union/intersection grant resolution, authority wildcards capped below co-admin,
grant management, and connect-time enforcement. The enforcing engine lives in the
reference vault (`openvaultdb-go`); this plan decomposes the behavior regardless
of host repo.

## Approach

Linear, dependency-ordered. Build the identity primitives first (the principal
model, then login→principal verification), then the grant data model, then
resolution (intersection + union), then wildcards, then management, and finally
connect-time enforcement that composes everything. Each task maps to one or more
acceptance criteria from the source Feature; all ten ACs are covered, none
deferred.

## Tasks

### Task 1: Principal identifier model

**Verifies:** multi-user-vault-access#ac:persona-distinction
**Depends-On:** —
**Status:** pending

Define and parse the two principal kinds — email principal (`someone@example.com`
≡ `mailto:`) and provider-account principal (`acct:someone@github.com`) — as
distinct identifiers, storing account principals by the provider's immutable
user-id with the handle as display only. This is the type every grant references.

### Task 2: Login→principal verification

**Verifies:** multi-user-vault-access#ac:account-verified-by-oauth, multi-user-vault-access#ac:org-domain-declared-method
**Depends-On:** 1
**Status:** pending

Map an authenticated wallet login to its canonical principal and verify it
against the principal's authority: OAuth for built-in providers, email control
for email domains, and the method an org domain declares in its
`/.well-known/openvaultdb.yaml`. Includes parsing that declaration block.

### Task 3: Grant model & storage (tiers + roles)

**Verifies:** multi-user-vault-access#ac:namespace-grant-saved, multi-user-vault-access#ac:coadmin-can-grant-not-migrate
**Depends-On:** 1
**Status:** pending

Define the grant record `(principal, scope, role)` across the three nested scopes
(vault / namespace / app-on-namespace), with co-user/co-admin at the broad tiers
and named roles at the app tier; scopes name inGitDB-defined collections. Enforce
that namespace co-admin may re-grant but is not the schema owner (no migrate).

### Task 4: Grant resolution — intersection & precedence

**Verifies:** multi-user-vault-access#ac:intersection-wins, multi-user-vault-access#ac:union-of-matching-grants
**Depends-On:** 2, 3
**Status:** pending

Resolve all grants matching a principal as the union of their scopes, then
compute a user's effective access through an app as the intersection of that
union with the app's namespace ACL.

### Task 5: Authority wildcards & co-admin cap

**Verifies:** multi-user-vault-access#ac:wildcard-coadmin-rejected
**Depends-On:** 3, 4
**Status:** pending

Support wildcard principals (`*@authority`, `acct:*@authority`) that match any
subject the authority vouches for, and reject any attempt to grant a wildcard the
co-admin role (cap to co-user / named roles).

### Task 6: Grant management & revocation

**Verifies:** multi-user-vault-access#ac:revoke-invalidates
**Depends-On:** 3
**Status:** pending

Let the vault owner and scope co-admins add, scope, and revoke grants from the
wallet, with revocation invalidating the affected principal's access (and any
issued token).

### Task 7: Connect-time enforcement

**Verifies:** multi-user-vault-access#ac:enforced-at-connect
**Depends-On:** 2, 4, 5
**Status:** pending

At connect time, map the authenticated login to its canonical principal, resolve
its grants, and issue access limited to the resolved scope intersected with the
app's ACL; deny unauthenticated or unmatched principals.

## Open Questions

- Canonical subject encoding per provider and how renames surface (affects Tasks 1–2).
- Exact org-domain verification declaration shape in the identity manifest (Task 2).
- Revocation propagation vs. token lifetime and grant expiry (Tasks 6–7).
- Alignment of the Shared Namespaces `schema` block with inGitDB collection schemas (cross-feature).

---
*This document follows the https://specscore.md/plan-specification*
