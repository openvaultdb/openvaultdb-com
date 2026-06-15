# OpenVaultDB Authentication Model — Design

**Status:** Draft for review
**Date:** 2026-06-15
**Scope:** How users connect apps to their vaults, and how apps prove their
identity. Covers the user side and the app-owner side of authentication.

---

## Core principle

Applications do not own user data. Users own their data and grant applications
permission to access it. The authentication model must never reintroduce a
mandatory central authority — openvaultdb.com is a **convenience**, not a
dependency.

---

## Key decisions

1. **The OpenVaultDB account is an optional connection directory ("vault
   wallet"), not an identity provider.** Users may register their providers
   once and reuse them; apps may also accept a vault pasted in by a user with
   no account at all. The bare protocol works without openvaultdb.com.

2. **The vault is the authority. OVDB Connect only routes.** OVDB never mints
   the app's access token (doing so would make it non-optional). It hands the
   app off to the vault's own authorization endpoint, then leaves the data
   path.

3. **App identity is its domain.** An app's `client_id` is the domain it
   controls. No central app registry is required. The namespace an app may use
   derives from its verified domain, so an app can only ever claim a namespace
   it can prove it owns.

4. **A manifest may delegate additional origins.** The authoritative domain can
   list extra origins allowed to act under its namespace (e.g. several mini-apps
   sharing one Firebase Auth project).

---

## Actors

| Actor | Role |
|-------|------|
| **User** | Owns the vault and the data. Grants apps scoped access. |
| **App** | Wants a namespace in the user's vault. Identified by its domain. |
| **Vault** | The user's chosen storage endpoint. **The authority** that authenticates the user and issues scoped tokens. |
| **OVDB Connect** | Optional broker/router at openvaultdb.com. Holds a directory of the user's vaults; routes apps to the right vault. Not in the trust or data path (except serverless GitHub, see below). |

---

## Deployment modes and where authority lives

The rule "the vault is the authority" resolves differently per mode:

| Mode | Authority | Notes |
|------|-----------|-------|
| **Self-hosted server** | The vault server | Exposes an OAuth-style authorize/token endpoint, issues its own scoped tokens. Textbook. |
| **OVDB-hosted server** | The vault server (hosted by OVDB) | Same as self-hosted; OVDB runs it as a service but it is still a vault, not the broker. |
| **Serverless (browser → GitHub)** | **GitHub** | No vault server exists. GitHub is the real IdP; the app needs a GitHub token scoped to one repo. OVDB **necessarily** brokers this OAuth (it holds the OAuth client secret). This is the one acknowledged exception where OVDB sits in the auth path. |
| **User-owned cloud (Firestore/Dynamo/…)** | A vault server in front of the cloud DB | Raw cloud DBs have no namespace/consent concept. This mode **requires** a thin OpenVaultDB server in front (which reduces it to the self-hosted case). Browser-direct-to-cloud is explicitly **not** a first-class mode — it would force a second, weaker auth path and risk exposing cloud credentials to the browser. |

**Design intent:** one auth model, not one per backend. Serverless GitHub is the
single honest exception.

---

## App identity and the manifest

An app is identified by a domain it controls — the **authoritative domain**.

- `client_id` = the authoritative domain (e.g. `sneat.app`).
- The app publishes `/.well-known/openvaultdb.json` on that domain.
- The namespace the app may claim derives from the authoritative domain.

### Proof of identity

An app proves it controls its authoritative domain by:

1. **Redirect URI binding** — the OAuth redirect URI used in the Connect flow
   must live on an origin the manifest authorizes (see below). A vault/Connect
   rejects redirect URIs that do not match.
2. **Manifest presence** — `/.well-known/openvaultdb.json` must be reachable on
   the authoritative domain and describe the app.

### Manifest (illustrative)

```json
{
  "client_id": "sneat.app",
  "name": "Sneat",
  "logo": "https://sneat.app/logo.svg",
  "namespace": "sneat.app",
  "requested_scopes": ["namespace:sneat.app:read", "namespace:sneat.app:write"],
  "allowed_origins": [
    "https://sneat.app",
    "https://datatug.app"
  ]
}
```

### Delegated origins (the multi-app case)

`allowed_origins` lets the authoritative domain authorize **other origins** to
act under its namespace. Example: `sneat.app` is authoritative and owns the
namespace, but `datatug.app` — a sibling mini-app sharing the same Firebase
Authentication project — is allowed to connect on its behalf.

**Security properties:**

- Only someone who controls `sneat.app` can edit `sneat.app`'s manifest.
  Therefore a domain can pull other origins **into its own namespace**, but no
  origin can claim a namespace it is not named by.
- A Connect/authorize request originating from `datatug.app` and claiming the
  `sneat.app` namespace is accepted **iff** `datatug.app` appears in
  `sneat.app`'s `allowed_origins`.
- No reverse handshake is required: `datatug.app` does not need to vouch back,
  because the namespace and all data belong to `sneat.app`, whose owner is the
  only party that can grant the delegation.

---

## The Connect flow (user side)

Happy path, model B with a vault that is its own authority:

```
1. App opens OVDB Connect (popup or redirect):
     "App sneat.app wants a namespace in your vault."
2. User selects a vault from their directory
     (or pastes a vault URL — works with no OVDB account).
3. Connect redirects the app to THAT vault's own authorize endpoint.
4. The vault authenticates the user and presents a consent screen
     (app name/logo/scopes resolved from the manifest).
5. The vault issues a scoped token for the app's namespace.
6. The app talks DIRECTLY to the vault with that token.
     OVDB Connect is no longer involved.
```

For **serverless GitHub**, step 3–5 are brokered by OVDB against GitHub's OAuth
(the acknowledged exception), and the resulting token is a repo-scoped GitHub
token the browser uses directly against the GitHub API.

---

## App-owner side (summary)

App owners do **not** register with openvaultdb.com to ship an app. To make an
app OpenVaultDB-compatible, an owner:

1. Picks an authoritative domain they control.
2. Hosts `/.well-known/openvaultdb.json` describing the app and its requested
   scopes.
3. Implements the OAuth redirect callback on an authorized origin.
4. (Optional) lists sibling origins in `allowed_origins`.

No secrets are issued by OVDB for the general (server/self-hosted) case; the
vault is the authority. The serverless GitHub mode is the exception where an
OAuth client secret exists and is held by openvaultdb.com's broker.

---

## Deferred (explicitly out of scope for this design)

- **Optional verified app directory** — a public registry at openvaultdb.com
  providing "verified" metadata for nicer consent screens. A convenience layer
  on top of domain identity, never required to connect. Deferred.
- Browser-direct-to-cloud as a first-class mode.
- Fine-grained (table/row) permission scopes — this design assumes
  namespace-level scopes.

---

## Open questions (carried forward, not resolved here)

- **Serverless token handling in the browser** — session vs. localStorage for
  the GitHub token after OAuth.
- **Scope vocabulary** — exact string format for `requested_scopes`
  (`namespace:<domain>:read|write` is illustrative only).
- **Manifest caching / revocation** — how long Connect and vaults cache
  `/.well-known/openvaultdb.json`, and how an owner revokes a delegated origin
  quickly.
- **Token format and lifetime** — JWT vs. opaque; refresh model. Likely defers
  to each vault implementation, but a minimum conformance profile may be needed.
- **Multi-device key management** for encrypted modes (tracked in the
  encryption design, not here).
