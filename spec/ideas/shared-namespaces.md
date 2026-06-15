---
format: https://specscore.md/idea-specification
status: Specifying
---
# Idea: Shared Namespaces

**Status:** Specifying
**Date:** 2026-06-15
**Owner:** alexandertrakhimenok
**Promotes To:** shared-namespaces
**Supersedes:** —
**Related Ideas:** extends:user-owned-auth

## Problem Statement

How might we let multiple applications access a single namespace — each with its
own scope and permissions — to support migration handoffs, cooperative work on
one dataset, and interchange/standard data formats, without weakening the rule
that an app only sees data it has been granted?

## Context

The Authentication Model bound a namespace 1:1 to its owning app's domain and
deferred an "advanced sharing model." Real needs surfaced: migrating data from
one app to another, several apps cooperating on one dataset, and common
interchange formats (e.g. a shared calendar). This un-defers that model.

## Recommended Direction

Introduce a vault-held, per-namespace access control list: each entry binds an
app identity (domain) to a role that resolves to a collection-level scope. The
owner app publishes a role catalog; the user assigns apps to roles, may author
custom roles, and consents to every grant; the vault enforces. Namespaces become
domain-bounded, dereferenceable identifiers (`<owner-domain>/openvaultdb/<name>`)
whose `manifest.yaml` carries schema, roles, and suggested grants.

The three use cases are one primitive configured three ways — migration adds
transferable ownership, interchange makes the owner a standard's domain, and
cooperative is simply multiple peer grants.

## Alternatives Considered

- **Shared free-for-all namespace** — no per-app scoping. Rejected: violates the
  "each app, dedicated scope" requirement and leaks data between apps.
- **Co-owned schema with coordinated migrations** — multiple apps migrate via
  locking/negotiation. Deferred: highest complexity, concurrent-migration hazard.
- **Separate "versioned contract" mechanism for interchange** — folded into
  "single owner" by letting the owner be a standard's domain.

## MVP Scope

A namespace accessible by an owner plus guest apps, each scoped at
collection × {read, write, delete}, governed by owner-defined + user-defined
roles, with user consent and revocation.

## Not Doing (and Why)

- Field-level and row-level scopes — collection-level is enough for MVP.
- Co-owned schemas / concurrent migrations — too complex for first cut.
- Central directory of shared namespaces — discovery stays domain-resolvable.

## Key Assumptions to Validate

| Tier | Assumption | How to validate |
|------|------------|-----------------|
| Must-be-true | A collection-level scope can be enforced on every backend (Git, SQL, Firestore) | Prototype enforcement in the reference vault |
| Should-be-true | Owners will publish a per-namespace `manifest.yaml` with roles | Model sneat.app/togethered.app shared calendar |
| Might-be-true | Users will assign apps to roles and consent per grant | Usability test of the wallet consent screen |

## SpecScore Integration

- **New Features this would create:** Shared Namespaces
- **Existing Features affected:** Authentication Model (namespace identifiers, manifest format)
- **Dependencies:** Decision 0002 (Shared Namespaces); builds on Decision 0001

## Open Questions

- Exact YAML shape for roles and the token's encoded scope?
- Ownership-transfer protocol (initiation, consent, in-flight grants)?
- Multi-writer conflict semantics per backend?

---
*This document follows the https://specscore.md/idea-specification*
