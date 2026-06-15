---
format: https://specscore.md/feature-specification
status: Draft
---
# Feature: Shared Namespaces

> [SpecScore.**Studio**](https://specscore.studio): | [Explore](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/shared-namespaces?op=explore) | [Edit](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/shared-namespaces?op=edit) | [Ask question](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/shared-namespaces?op=ask) | [Request change](https://specscore.studio/app/github.com/openvaultdb/openvaultdb-com/spec/features/shared-namespaces?op=request-change) |
**Status:** Draft
**Source Ideas:** shared-namespaces

## Summary

A single namespace can be accessed by multiple applications, each with its own
role and collection-level scope, governed by a vault-held access control list.
Supports migration handoffs, cooperative work, and interchange formats.
Namespaces are domain-bounded, dereferenceable identifiers.

## Problem

Users need more than one app to work with the same dataset — to migrate from one
app to another, to use several apps cooperatively, or to share a common
interchange format — while each app keeps a dedicated, limited scope and the user
stays in control of their data.

## Behavior

### Namespace identifiers

#### REQ: domain-bounded-namespace

A namespace identifier MUST have the form `<owner-domain>/openvaultdb/<name>`,
where the owner-domain prefix is the schema owner; a namespace MAY only be
defined by a party that controls that domain.

#### REQ: resolvable-manifest

A namespace identifier MUST resolve to a namespace manifest by appending
`/manifest.yaml`; manifests MUST be YAML (JSON MAY be accepted as an alias), with
a per-domain identity manifest at `/.well-known/openvaultdb.yaml` and a
per-namespace manifest at the namespace path.

#### REQ: pinned-manifest

At grant time the vault MUST cache (pin) the manifest version it enforces into
the user's vault, so the user's data does not depend on the owner's domain being
reachable; a new schema version MUST be adopted only via an owner-published
migration, with user awareness.

### Access control

#### REQ: per-namespace-acl

The vault MUST maintain, per namespace, an access list binding each app identity
to a role that resolves to a scope, and MUST mint each app a token limited to its
scope.

#### REQ: collection-scope

A scope MUST be expressed as a set of operations drawn from `{read, write,
delete}` per collection; field-level and row-level scoping are out of scope.

#### REQ: owner-and-user-roles

The owner MUST be able to publish a role catalog in the namespace manifest, and
the user MUST be able to assign apps to those roles and to define custom roles
within the grantable data-scope space.

#### REQ: schema-owner-only

Only the namespace's schema owner MAY create, alter, or migrate the schema;
schema administration MUST NOT be grantable to guest apps.

#### REQ: transferable-ownership

Schema ownership of a namespace MUST be transferable to another identity with
user consent, enabling migration handoff.

### Consent

#### REQ: user-consent-per-grant

The vault MUST require explicit user consent before granting any app access to a
namespace, MUST show the exact scope and the requesting app's identity, and MUST
let the user revoke any grant at any time.

#### REQ: suggestions-not-authorization

A namespace manifest MAY list `suggested_grants` and a `successor`; these MUST
only pre-fill the consent screen and MUST NOT grant access without explicit user
consent. An owner MAY only suggest grants for its own namespace.

## Acceptance Criteria

### AC: namespace-id-shape (verifies REQ:domain-bounded-namespace)

**Given** an owner controlling `example.com`
**When** it defines a calendar namespace
**Then** the identifier is `example.com/openvaultdb/calendar` and no party lacking control of `example.com` can define it.

### AC: manifest-resolves (verifies REQ:resolvable-manifest)

**Given** the namespace `example.com/openvaultdb/calendar`
**When** a vault resolves it
**Then** it fetches `https://example.com/openvaultdb/calendar/manifest.yaml` and reads the schema, roles, and suggested grants.

### AC: pinned-manifest-survives-outage (verifies REQ:pinned-manifest)

**Given** a granted namespace whose manifest the vault has pinned
**When** the owner's domain becomes unreachable
**Then** the user's data and the existing grants keep working from the pinned version.

### AC: per-app-scope-enforced (verifies REQ:per-namespace-acl)

**Given** `reporter.app` is granted the `reader` role on a calendar namespace
**When** it attempts to write to `events`
**Then** the vault rejects the write and allows only reads within its scope.

### AC: collection-level-role (verifies REQ:collection-scope)

**Given** a role `scheduler` defined as `events: rw, contacts: r`
**When** the role is applied
**Then** the app may read/write `events`, read `contacts`, and access no other collection.

### AC: user-custom-role (verifies REQ:owner-and-user-roles)

**Given** an owner-published catalog
**When** the user defines a custom role narrower than any catalog role
**Then** the user can assign an app to that custom role and the vault enforces it.

### AC: guest-cannot-migrate (verifies REQ:schema-owner-only)

**Given** a guest app with a writer role
**When** it attempts to alter the schema
**Then** the operation is rejected; only the owner may migrate.

### AC: ownership-transfer (verifies REQ:transferable-ownership)

**Given** `sneat.app` owns a namespace and proposes `togethered.app` as successor
**When** the user consents to the transfer
**Then** `togethered.app` becomes the schema owner and `sneat.app` retains only its granted guest role (or none).

### AC: consent-and-revoke (verifies REQ:user-consent-per-grant)

**Given** an app requests access to a namespace
**When** the user has not consented
**Then** no token is issued; after consent a scoped token is issued, and the user can later revoke it to invalidate the token.

### AC: suggestion-needs-consent (verifies REQ:suggestions-not-authorization)

**Given** a manifest listing `togethered.app` in `suggested_grants`
**When** `togethered.app` requests access
**Then** the consent screen is pre-filled with the suggested role but no access is granted until the user approves.

## Open Questions

- Exact YAML shape for roles and the token's encoded scope (a minimum conformance profile across backends)?
- Ownership-transfer protocol — initiation, consent, and handling of in-flight guest grants?
- Multi-writer conflict semantics per backend (especially non-Git)?
- Manifest cache lifetime, migration detection, and revocation propagation vs. token lifetime?

---
*This document follows the https://specscore.md/feature-specification*
