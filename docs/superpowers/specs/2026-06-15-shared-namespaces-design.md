# OpenVaultDB Shared Namespaces — Design

**Status:** Draft for review
**Date:** 2026-06-15
**Scope:** How a single namespace can be accessed by multiple applications —
each with its own scope and permissions — to support migration handoffs,
cooperative work on one dataset, and interchange/standard data formats. Builds
on the Authentication Model design and un-defers the "advanced sharing model."

---

## Core principle

A namespace is shared by **explicit, user-consented grant only**. Sharing is an
opt-in exception to the default rule — "an application only sees its own
namespace" — never a loosening of it. The user owns the data and consents to
every grant; the vault is the authority that enforces it.

---

## Use cases

| Use case | Shape | Lifetime |
|----------|-------|----------|
| **Migration** | Asymmetric handoff: old app → new app, then ownership transfers | Temporary; ends at handoff |
| **Cooperative** | One owner + peer apps working the same dataset | Ongoing |
| **Interchange** | A shared standard many independent apps speak; no single app owns it | Long-lived |

All three are configurations of one primitive (below), not separate features.

---

## Namespace identifiers — domain-bounded and resolvable

A namespace identifier is a domain-bounded, dereferenceable name:

```
<owner-domain>/openvaultdb/<name>
```

- The **owner-domain prefix is the schema owner.** To define a namespace you
  must control that domain — the same domain-identity rule applications already
  use (verified via the domain's `/.well-known/openvaultdb.yaml`).
- Globally unique: two owners can each define a `calendar` without collision.
- For **interchange**, the prefix is a *standard's* domain
  (e.g. `schema.org/openvaultdb/calendar`), so the namespace has no single owning
  app — the "owner" is the standard.
- The path doubles as the **storage layout** in a Git-backed vault.

Examples:

```
sneat.app/openvaultdb/calendar      (app-owned)
sneat.app/openvaultdb/settings      (app-owned)
schema.org/openvaultdb/calendar     (interchange / standard-owned)
```

### The name resolves to a manifest

The identifier is a URL. Appending the fixed filename yields the namespace
manifest:

```
example.com/openvaultdb/calendar  →  https://example.com/openvaultdb/calendar/manifest.yaml
```

**Two-tier manifests:**

1. **Identity manifest** — per domain, at `example.com/.well-known/openvaultdb.yaml`:
   `client_id`, `allowed_origins`, and an index of the namespaces the domain owns.
2. **Namespace manifest** — per namespace, at `<namespace>/manifest.yaml`:
   schema, role catalog, suggested grants, successor.

**Format:** standardize on **YAML** for both manifests (matches INGR/SpecScore in
the ecosystem); accept JSON as an alias. (This moves the app identity manifest
from `openvaultdb.json` to `openvaultdb.yaml`.)

### Namespace manifest (illustrative)

```yaml
# https://example.com/openvaultdb/calendar/manifest.yaml
name: calendar
owner: example.com
schema:
  version: 7
  collections: [events, contacts]
roles:
  reader:    { events: r,  contacts: r }
  scheduler: { events: rw, contacts: r }
suggested_grants:
  - { app: togethered.app, role: scheduler }
successor: togethered.app   # migration hint
```

### Pin, don't live-depend

At grant time the vault **caches (pins) the manifest version it is enforcing**
into the user's vault. The user's data keeps working even if the owner's domain
is unreachable or the manifest changes. A new schema version is adopted only on
an owner-published migration, with user awareness — never silently from a live
fetch.

---

## The sharing primitive — a per-namespace ACL

The vault holds, per namespace, an **access control list**. Each entry binds an
**app identity (domain)** to a **role**, which resolves to a **scope**.

```
namespace: sneat.app/openvaultdb/calendar   (schema owner: sneat.app)
ACL:
  sneat.app        → owner     (all data + schema/migrate)
  togethered.app   → scheduler (events: rw, contacts: r)
  reporter.app     → reader    (events: r,  contacts: r)
```

### Roles and scope

- **Scope granularity (MVP):** a scope is a set of operations
  `{read, write, delete}` **per collection**. Field-level and row-level scoping
  are deferred.
- **Owner-defined roles:** the owner publishes a role catalog in the namespace
  manifest (e.g. `reader`, `scheduler`).
- **User-defined custom roles:** the user may author their own roles with their
  own scope (within the grantable data-scope space). The user is sovereign over
  their data.
- **Schema admin is never grantable to guests** — `ALTER`/migrate is owner-only.

### Schema ownership

- A namespace has a **single schema owner** — the app (or standard) named by the
  domain prefix. Only the owner may create/alter/migrate the schema.
- **Ownership is transferable.** The owner can hand the namespace to another
  identity (with user consent). This is the migration handoff.
- Guest apps read/write **data** within their scope but cannot change structure.

### Governance

- **Owner defines** the role catalog (and may publish suggested grants).
- **User assigns** apps to roles, may define custom roles, and **consents to
  every grant**.
- **Vault enforces** — stores the ACL, mints a per-app token scoped to that
  app's role, rejects out-of-scope operations, and lets the user revoke anytime.

---

## Owner-suggested grants

The namespace manifest may declare `suggested_grants` (app → role) and a
`successor` (for migration). These are **recommendations that pre-fill the user's
consent screen — never authorization.**

**Hard rule:** suggestions ≠ authorization. The vault grants nothing without
explicit user consent; the consent screen always shows the exact scope and the
requesting app's identity; the user may approve, tighten to a custom role, or
decline. An owner can only suggest apps for *its own* namespace.

> Distinct from `allowed_origins`: that lists *sibling origins of one app* (same
> identity) and is safe to auto-honor. `suggested_grants` lists *different apps*
> touching the user's data, so user consent is mandatory.

---

## Consent & token flow

```
1. togethered.app → Connect: request access to sneat.app/openvaultdb/calendar
2. Vault checks the ACL. Not yet granted → show the user a consent screen,
     pre-filled from the namespace manifest's suggested_grants.
3. User approves (or customizes the role, or declines).
4. Vault writes the ACL entry (togethered.app → scheduler) and mints a token
     scoped to that role.
5. togethered.app reads/writes only within its scope (events rw, contacts r);
     schema/migrate remain owner-only.
6. User can revoke the grant anytime from the wallet → token invalidated.
```

Consistent with the Authentication Model: the vault is the authority and issues
the token; OpenVaultDB is not in the data path.

---

## How each use case maps

- **Migration:** owner grants the successor app (often via `successor` +
  `suggested_grants`); during transition both run on the data; then **ownership
  transfers** old → new; the old app drops to a guest role or is revoked.
- **Cooperative:** one schema owner + multiple peer apps, each assigned a role by
  the user. Multi-writer conflicts are handled by the backend (inGitDB
  commits/merges; SQL transactions) — surfaced here, not solved here.
- **Interchange:** the namespace prefix is a *standard's* domain; the schema is
  the standard's published contract (the owner chooses additive-only evolution);
  any conforming app the user approves is granted a role.

---

## Invariants

1. No app accesses a namespace it has not been explicitly, consensually granted.
2. The user consents to every cross-app grant and can revoke it anytime.
3. Schema/migrate is owner-only; guests are data-scoped.
4. A namespace can only be defined by whoever controls its prefix domain.
5. OpenVaultDB is never in the data path; the vault mints and enforces tokens.

---

## Deferred / out of scope

- Field-level and row-level (predicate) scopes — collection-level only for MVP.
- Co-owned schemas with coordinated/concurrent migrations.
- Cross-namespace querying.
- A central directory of shared namespaces (discovery stays domain-resolvable).

---

## Open questions

- **Scope/role wire format** — exact YAML shape for roles and the token's
  encoded scope (a minimum conformance profile across backends).
- **Manifest caching & version pinning** — cache lifetime, how the vault detects
  and presents an owner-published schema migration, rollback.
- **Ownership transfer protocol** — how transfer is initiated, consented, and
  recorded; what happens to in-flight guest grants on transfer.
- **Multi-writer conflict semantics** per backend — what guarantees the vault
  promises guests (especially for non-Git backends).
- **Revocation propagation** — token lifetime vs. immediate revocation.
- **Interchange schema governance** — who can publish a standard namespace's
  schema and how its versioning is signaled to vaults.

---

## Relationship to existing specs

- **Un-defers** the "advanced sharing model" (and touches "cross-app querying")
  listed as deferred in the Authentication Model.
- Reuses domain-as-identity, the manifest mechanism, and "vault is the authority"
  from the Authentication Model.
- On approval, this should be captured as SpecScore artifacts (an Idea →
  Decision → Feature), and the namespace-identifier change (domain-bounded,
  resolvable, YAML manifests) reconciled with the existing namespace references.
