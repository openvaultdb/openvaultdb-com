# Local Server Demo — Integration Constants

Shared, fixed values so the three independently-built pieces interoperate. The
wire format is `interface/main.tsp`; this file pins the concrete values that file
leaves open. **All three agents MUST use these exact strings.**

## Server (openvaultdb-go)

- Base URL: `http://localhost:8088`
- On startup, the server MUST print a line: `OWNER_TOKEN=<token>` (a random
  hex string). The user pastes this when registering the server in the wallet.
  `GET /vaults` and `GET /vaults/{id}/namespaces` require `Authorization: Bearer <OWNER_TOKEN>`.
- CORS: allow origins `http://localhost:5173` (demo app) and `http://localhost:5000`,
  `http://localhost:8787`, `https://openvaultdb.com` (wallet), methods GET/POST/PATCH/DELETE,
  headers `Authorization, Content-Type`.

## Seed data (server creates on first run)

- Vault: `{ id: "local", name: "Local Vault", backend: "ingit" }`
- Namespace: `todo-demo.openvaultdb.app/openvaultdb/todos`
  - owner: `todo-demo.openvaultdb.app`
  - collections: `["tasks"]`
- Namespace manifest roles:
  - `editor`: `{ tasks: [read, write, delete] }`
  - `viewer`: `{ tasks: [read] }`

## `tasks` collection (inGitDB collection schema)

Define the collection with an inGitDB `.ingitdb-collection.yaml` (see
`~/projects/ingitdb/ingitdb` and `ingitdb-schema`). Fields:

| field | type | notes |
|-------|------|-------|
| `id` | string | primary key (server-generated if absent) |
| `title` | string | required |
| `done` | boolean | default `false` |
| `createdAt` | string (RFC3339) | server-set |

## Demo app (openvaultdb-todo-demo)

- Dev URL: `http://localhost:5173`
- `client_id` (its authoritative domain): `todo-demo.openvaultdb.app`
- `redirect_uri`: `http://localhost:5173/callback`
- Requests: vault `local`, namespace `todo-demo.openvaultdb.app/openvaultdb/todos`, role `editor`
- Publishes a manifest `public/.well-known/openvaultdb.yaml` (client_id, name, the
  namespace + role catalog) per the auth-model + shared-namespaces specs.

## Connect flow (concrete)

```
1. Demo app → browser redirect:
   GET http://localhost:8088/authorize
       ?client_id=todo-demo.openvaultdb.app
       &redirect_uri=http://localhost:5173/callback
       &vault=local
       &namespaceId=todo-demo.openvaultdb.app/openvaultdb/todos
       &role=editor
       &state=<random>
2. Server shows a consent screen (dev: a simple Approve/Deny page), then
   302 → http://localhost:5173/callback?code=<code>&state=<state>
3. Demo app → POST http://localhost:8088/token
       { grant_type: "authorization_code", code, client_id, redirect_uri }
   ← { access_token, token_type: "Bearer", expires_in, namespaceId, scope }
4. Demo app uses the token for record CRUD:
   GET/POST/PATCH/DELETE
   http://localhost:8088/vaults/local/ns/todo-demo.openvaultdb.app%2Fopenvaultdb%2Ftodos/collections/tasks/records[/{id}]
```

- The namespace id contains `/`; URL-encode it in the path segment (`%2F`).
- Token is an opaque bearer string scoped to `{ tasks: [read, write, delete] }`;
  the server MUST reject out-of-scope ops (e.g. a `viewer` token writing).

## Wallet (openvaultdb-com)

- Stores vault/server pointers client-side (localStorage is fine for this milestone).
- GitHub repo vault: list the signed-in user's private repos via the GitHub REST
  API using the GitHub OAuth access token obtained at Firebase GitHub sign-in.
- Server registration: validate via `GET /.well-known/openvaultdb`, then store
  `{ baseUrl, ownerToken }`; list vaults via `GET /vaults`.
