---
format: https://specscore.md/decision-specification
status: In Review
---

# Decision: Host / Vault / Namespace Model

**Status:** In Review
**Date:** 2026-06-15
**Owner:** alexandertrakhimenok
**Tags:** terminology, ux, architecture
**Source Idea:** —
**Supersedes:** —
**Superseded By:** —

## Context

The wallet exposed two sibling tabs — `/my/servers` and `/my/vaults` — whose
responsibilities overlapped, and used the word "server" as a primary
user-facing term. Users found this confusing: it was unclear whether a "server"
and a "vault" were different things, and "server" reads as technical and
intimidating. We needed to fix both the information architecture (one home, not
two overlapping tabs) and the vocabulary, without losing the underlying
three-level structure the protocol actually has.

## Decision

1. **Storage is organized in three levels: Host → Vault → Namespace.**
   - **Host** — where vaults live. Two kinds: an **OpenVaultDB host** (a server
     the user self-hosts or runs in the cloud) and a **Git host** (GitHub or
     GitLab, used by the serverless browser-direct-to-Git model).
   - **Vault** — the unit the user owns, names, and grants apps access to. On a
     Git host a vault is a **repository**; on an OpenVaultDB host it is a
     **user-chosen grouping** (e.g. personal, work). One host may carry several
     vaults.
   - **Namespace** — an application's private area inside a vault.
2. **The vault is the primary user-facing concept.** There is a single wallet
   tab, **My Vaults** (`/my/vaults`). The separate `/my/servers` tab is removed;
   a host is presented as a quiet property of a vault, surfaced only while adding
   one.
3. **Avoid "server" in user-facing copy; use "host."** "Server" remains accurate
   at the wire/implementation layer (the running OpenVaultDB server process), but
   the wallet and product copy say *host*.
4. **Namespaces are created by applications, never added by hand.** The
   application owns the schema (definition, versioning, migration); the user
   controls only the permission scope granted to an app, and may revoke it.
5. **The Connect picker is a flat list grouped by host**, each row labeled
   `{host} · {vault}`, rather than an expandable tree.

## Rationale

The confusion was never the three levels — it was two overlapping tabs and a
scary noun. Centering the UI on the vault (the thing a user actually owns and
shares) and demoting the host to a connection detail removes the redundant
"register a server, then register a vault from it" dance while keeping the
structure the protocol needs. "Host" is accurate for both an OpenVaultDB server
and a Git provider, so one word covers both kinds without leaking
implementation. Keeping namespaces app-owned preserves the project's core split
— apps own structure, users own data and access — established in Decision 0001
and the namespace model in Decision 0002.

## Declined Alternatives

### Collapse to two levels (Vault → Namespace), drop the host concept

Tempting for simplicity, but a single OpenVaultDB server genuinely hosts
multiple vaults, and Git hosts carry many repositories — flattening would either
lose that grouping or force one host registration per vault. Rejected.

### Keep "My Servers" as the single tab

Makes the host the primary object, but "server" is exactly the term users found
intimidating and ambiguous, and most users think in terms of the vault they own,
not the box it sits on. Rejected in favor of a vault-centric "My Vaults".

## Consequences at Decision Time

- The wallet merges `/my/servers` into `/my/vaults`; `my-servers.js` and the
  Servers nav tab are removed. A vault row shows its host and (read-only)
  namespaces.
- "Add vault" chooses a host: an OpenVaultDB host (URL + owner credential) or a
  repository from a connected Git host.
- **Vault provisioning is deferred.** The wallet uses the vaults a host already
  exposes (a default vault, or ones set up out of band). Creating named vaults
  from the wallet needs a create-vault capability on the host — a later step.
- Listing namespaces ships first for OpenVaultDB-host vaults; Git-host
  (repository) vaults require reading the repo directly and follow later.
- Specs and `/docs` copy adopt "host" for the user-facing top level; existing
  "vault server" / "server vault" phrasing is reconciled to "OpenVaultDB host".
- The vault directory is held per-user in Firestore at `/users/{uid}/vaults`
  (owner-only rules in `firestore.rules`), so it requires sign-in. Pointers only
  — vault data never lives in Firestore. The signed-out manual Connect path is
  unaffected.

## Observed Consequences

None observed yet.

## Affected Features

- Local Vault Server Demo
- Authentication Model

---
*This document follows the https://specscore.md/decision-specification*
