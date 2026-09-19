---
format: https://specscore.md/features-index-specification
---

# Features

Feature specifications for this project.

## Index

| Feature | Status | Description |
|---------|--------|-------------|
| [Authentication Model](authentication-model/README.md) | Draft | How users connect applications to vaults they own, and how applications prove their identity. An optional OpenVaultDB account routes apps to the user's chosen vault, which is the authority that issues the app's token for core and self-hosted access. An app MAY separately opt into the managed OpenVaultDB backup/export provider, which is outside the core protocol. Apps are identified by a domain they control. |
| [Shared Namespaces](shared-namespaces/README.md) | Draft | A single namespace can be accessed by multiple applications, each with its own role and collection-level scope, governed by a vault-held access control list. Supports migration handoffs, cooperative work, and interchange formats. Namespaces are domain-bounded, dereferenceable identifiers. |
| [Multi-User Vault Access](multi-user-vault-access/README.md) | Approved | How a vault owner grants other people access — scoped to specific apps and data — using familiar, verifiable principal identifiers (email and provider accounts) and three nested grant tiers (vault, namespace, app-on-namespace). Collections referenced by a scope are those defined by the namespace's inGitDB collection schema. |
| [Local Vault Server Demo](local-vault-server-demo/README.md) | Draft | The first end-to-end milestone: from **My Vaults**, a user adds vaults backed by two host kinds (a private GitHub repository, and a local OpenVaultDB host on localhost), browses the vaults a host holds, and connects a demo to-do app to a vault on the local host via the connect flow. The frontend (wallet) lives in openvaultdb-com, the OpenVaultDB server in openvaultdb-go, the demo app in openvaultdb-todo-demo. The frontend↔server wire contract is the TypeSpec at `interface/main.tsp`. Terminology follows Decision 0003 (Host / Vault / Namespace): "host" is the user-facing term; "server" stays at the wire layer. |

## Open Questions

None at this time.

---
*This document follows the https://specscore.md/features-index-specification*
