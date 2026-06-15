---
format: https://specscore.md/feature-specification
status: Under Review
---
# Feature: Multi-User Vault Access

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/multi-user-vault-access?op=explore) | [Edit](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/multi-user-vault-access?op=edit) | [Ask question](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/multi-user-vault-access?op=ask) | [Request change](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/multi-user-vault-access?op=request-change) |
**Status:** Under Review
**Source Ideas:** multi-user-vault-access

## Summary

How a vault owner grants other people access — scoped to specific apps and data —
using familiar, verifiable principal identifiers (email and provider accounts)
and three nested grant tiers (vault, namespace, app-on-namespace). Collections
referenced by a scope are those defined by the namespace's inGitDB collection
schema.

## Problem

OpenVaultDB binds a vault to one owner and grants apps scoped access. There is no
way to grant *other people* access to a vault — for migration, cooperative work,
or shared/interchange datasets — with each person limited to specific apps and
data, using an identifier scheme people already understand.

## Behavior

### Principal identifiers

#### REQ: principal-personas

The system MUST support two distinct principal kinds: an **email principal**
written `someone@example.com` (equivalently `mailto:someone@example.com`), and a
**provider-account principal** written `acct:someone@github.com`. The two MUST be
treated as different principals even when the domain string matches, and account
principals MUST be stored by the provider's immutable user-id (the handle is
display-only).

#### REQ: authority-verification

A principal's authority (its domain) MUST determine how it is verified: built-in
OAuth providers (github.com, google.com, facebook.com) via OAuth login; plain
email domains via proof of email control; and other domains via a verification
method (email-domain match or an OIDC issuer) declared in that domain's
`/.well-known/openvaultdb.yaml`. A grant MUST resolve only for a principal whose
authority can verify the authenticated user.

### Grants

#### REQ: grant-tiers

A grant MUST bind a principal to a `(scope, role)` at one of three nested scopes:
**vault** (role `co-user` or `co-admin`), **namespace** (role `co-user` or
`co-admin`), or **app-on-namespace** (a named role from the Shared Namespaces
role catalog). Collections named by a role's scope MUST be those defined by the
namespace's inGitDB collection schema.

#### REQ: role-semantics

At the vault and namespace scopes, `co-user` MUST grant access only, and
`co-admin` MUST additionally allow administering and re-granting within that
scope and narrower scopes; namespace `co-admin` MUST NOT by itself confer schema
ownership (schema creation/migration remains governed by Shared Namespaces).

#### REQ: effective-access

A user's effective access through an application MUST be the **intersection** of
the user's grant and that application's namespace ACL — the user may do only what
both permit.

#### REQ: grant-precedence

When a principal matches more than one grant (e.g. a named-principal grant and a
wildcard grant), the system MUST apply the **union** of the matching grants'
scopes, subject to the wildcard co-admin cap (REQ: authority-wildcards).

### Wildcards

#### REQ: authority-wildcards

A wildcard principal (`*@authority` or `acct:*@authority`) MUST match any subject
the authority vouches for, and MUST NOT be grantable at the `co-admin` role —
wildcards are limited to `co-user` and named app roles.

### Management & enforcement

#### REQ: manage-grants

The vault owner and any `co-admin` at a scope MUST be able to add, scope, and
revoke grants within that scope from the wallet; revoking a grant MUST invalidate
the affected principal's access.

#### REQ: connect-time-enforcement

At connect time the vault MUST map the authenticated login to its canonical
principal, resolve the matching grants, and issue access limited to the resulting
scope intersected with the app's ACL; an unauthenticated or unmatched principal
MUST receive no access.

## Acceptance Criteria

### AC: persona-distinction (verifies REQ:principal-personas)

**Given** a vault with a grant to `acct:someone@github.com`
**When** a user signs in whose email is `someone@github.com` (a github.com employee) but who is not the GitHub account `someone`
**Then** they do not match the grant and receive no access.

### AC: account-verified-by-oauth (verifies REQ:authority-verification)

**Given** a grant to `acct:alice@github.com`
**When** Alice signs in via GitHub OAuth as that account
**Then** the authority github.com verifies her and the grant resolves.

### AC: org-domain-declared-method (verifies REQ:authority-verification)

**Given** `acme.com` declares an OIDC issuer in its `/.well-known/openvaultdb.yaml`
**When** a user authenticated by that issuer is matched against an `acct:*@acme.com` grant
**Then** the authority is able to verify them and the grant resolves.

### AC: namespace-grant-saved (verifies REQ:grant-tiers)

**Given** the owner grants `bob@example.com` `co-user` at the namespace scope on `sneat.app/openvaultdb/calendar`
**When** the grant is saved
**Then** Bob holds a namespace co-user grant scoped to that namespace's inGitDB-defined collections.

### AC: coadmin-can-grant-not-migrate (verifies REQ:role-semantics)

**Given** Bob holds namespace `co-admin` on a namespace he does not own
**When** he adds a grant for `carol@example.com` on that namespace, then attempts to migrate its schema
**Then** the grant is allowed and the schema migration is denied (schema owner only).

### AC: intersection-wins (verifies REQ:effective-access)

**Given** Bob has namespace `co-user` with read+write and opens an app whose ACL on that namespace is `reader`
**When** Bob writes a record via that app
**Then** the write is denied — effective access is the intersection (read only).

### AC: union-of-matching-grants (verifies REQ:grant-precedence)

**Given** `*@acme.com` is granted `reader` on a namespace and `bob@acme.com` is additionally granted `writer`
**When** Bob accesses the namespace
**Then** he receives the union (writer), within the wildcard cap.

### AC: wildcard-coadmin-rejected (verifies REQ:authority-wildcards)

**Given** an attempt to grant `*@acme.com` `co-admin` at the vault scope
**When** the grant is created
**Then** it is rejected, while granting `*@acme.com` `co-user` is accepted.

### AC: revoke-invalidates (verifies REQ:manage-grants)

**Given** the owner revokes Bob's grant
**When** Bob next connects
**Then** his access is denied and any issued token is invalidated.

### AC: enforced-at-connect (verifies REQ:connect-time-enforcement)

**Given** a user with no matching grant and another with a matching namespace grant
**When** each connects to the vault through an app
**Then** the unmatched user receives no access and the matched user receives access limited to (grant ∩ app ACL).

## Open Questions

- Canonical subject per provider — immutable id vs. handle, and how renames are surfaced.
- Exact shape of the org-domain verification declaration (email-domain vs. OIDC issuer) in the identity manifest.
- Revocation propagation vs. token lifetime; grant expiry; offboarding when a wildcard authority's membership changes.
- Abuse resistance for the public tier (rate limits, an "anyone authenticated" pseudo-principal).
- Alignment of the namespace `schema` block in Shared Namespaces with inGitDB collection schemas (`.ingitdb-collection.yaml`).

---
*This document follows the https://specscore.md/feature-specification*
