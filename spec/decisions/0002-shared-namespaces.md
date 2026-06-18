---
format: https://specscore.md/decision-specification
status: In Review
---
# Decision: Shared Namespaces

**Status:** In Review
**Date:** 2026-06-15
**Owner:** alexandertrakhimenok
**Tags:** namespaces, sharing, permissions
**Source Idea:** shared-namespaces
**Supersedes:** —
**Superseded By:** —

## Context

The Authentication Model bound a namespace to a single owning app and deferred
sharing. Users need multiple apps to access one namespace — for migration
handoffs, cooperative work, and interchange formats — each app with its own
scope, without weakening "an app only sees data it was granted."

## Decision

1. **Per-namespace ACL.** The vault holds, per namespace, an access list binding
   an app identity (domain) to a role that resolves to a collection-level scope.
   Every grant is user-consented; the vault mints per-app scoped tokens and
   enforces them.
2. **Single, transferable schema owner.** A namespace has one schema owner (the
   app or standard named by its domain prefix); only the owner may
   create/alter/migrate the schema. Ownership is transferable (the migration
   handoff). Guests are data-scoped.
3. **Owner-defined + user-defined roles.** The owner publishes a role catalog;
   the user assigns apps to roles, may author custom roles, and consents to each
   grant. Schema admin is never grantable to guests.
4. **Collection-level scope for MVP.** A scope is `{read, write, delete}` per
   collection; field- and row-level are deferred.
5. **Domain-bounded, resolvable namespace identifiers.** A namespace is
   `<owner-domain>/openvaultdb/<name>`; appending `/manifest.yaml` yields its
   namespace manifest. Manifests are YAML (JSON accepted as an alias), two-tier:
   a per-domain identity manifest at `/.well-known/openvaultdb.yaml` and a
   per-namespace manifest at the namespace path.
6. **Owner-suggested grants pre-fill consent, never authorize.** The namespace
   manifest may list `suggested_grants` and a `successor`; these only pre-fill
   the user's consent screen.

## Rationale

A single ACL primitive expresses all three use cases, so we add one mechanism
rather than three. Per-app scoping satisfies "each app, dedicated scope." A
single transferable owner keeps schema evolution coherent while still enabling
migration and (with a standard's domain as owner) interchange. Domain-bounding
prevents naming collisions, encodes the owner in the name, is squat-proof (you
must control the domain), and maps to Git storage paths. Resolvable manifests
give decentralized discovery with no registry. User consent on every grant, and
"suggestions ≠ authorization," keep the user sovereign over their data.

## Declined Alternatives

### Shared free-for-all namespace

No per-app scoping. Rejected — violates dedicated-scope and leaks data.

### Co-owned schema with coordinated migrations

Multiple owners migrating via locking/negotiation. Deferred — highest
complexity and concurrent-migration hazard.

### Separate versioned-contract mechanism for interchange

Folded into "single owner" by allowing the owner to be a standard's domain.

## Consequences at Decision Time

- The vault gains an ACL store, per-app token scoping, and consent/revocation UI.
- Namespace identifiers move to domain-bounded form; the manifest moves to YAML
  and splits into identity + per-namespace files. Existing references must be
  reconciled (Authentication Model).
- Owners must publish a per-namespace `manifest.yaml`.
- Multi-writer conflicts are handled by the backend (inGitDB merges, SQL
  transactions) — surfaced, not solved, by this decision.
- The vault pins (caches) the enforced manifest version so user data does not
  live-depend on the owner's domain.

## Observed Consequences

None observed yet.

## Affected Features

- Shared Namespaces
- Authentication Model

---
*This document follows the https://specscore.md/decision-specification*
