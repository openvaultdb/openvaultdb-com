# Local Server Demo — Integration Constants

Shared, fixed values so the three independently-built pieces interoperate. The
wire format is `interface/main.tsp`; this file pins the concrete values that file
leaves open. **All three agents MUST use these exact strings.**

## Go stack (openvaultdb-go)

Match `~/projects/specscore/specscore-cli`: Go 1.26, CLI/args via **spf13/cobra**
wrapped with **charm.land/fang/v2** (`fang.Execute(ctx, rootCmd, fang.WithoutVersion())`).
Thin `cmd/<bin>/main.go` → `internal/cli` `Run(args []string) error` that builds the
cobra root command. The server is a subcommand, e.g. `ovdb-server serve --port 8088`.

## Server (openvaultdb-go)

- Base URL: `http://localhost:8088`
- On startup, the server MUST print a line: `OWNER_TOKEN=<token>` (a random
  hex string). The user pastes this when registering the server in the wallet.
  `GET /vaults` and `GET /vaults/{id}/namespaces` require `Authorization: Bearer <OWNER_TOKEN>`.
- CORS: needed only for **browser** callers (the wallet) — allow origins
  `http://localhost:5000`, `http://localhost:8787`, `https://openvaultdb.com`,
  methods GET/POST/PATCH/DELETE, headers `Authorization, Content-Type`. The demo
  app reaches the OVDB server **server-side** (Go → Go), so it needs no CORS.

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

## Demo app (openvaultdb-todo-demo) — full-stack (TS frontend + Go backend)

A realistic 3rd-party app. The Go backend holds the connect credentials and the
scoped vault token; **all todo reads/mutations go frontend → demo Go REST API →
OVDB server.** The frontend never calls the OVDB server directly.

- **Frontend (TypeScript, e.g. Vite):** `http://localhost:5173` — UI only; calls
  the demo backend's REST API.
- **Backend (Go):** `http://localhost:5180` — same cobra + `charm.land/fang/v2`
  stack as the OVDB server (see "Go stack"). Responsibilities:
  - Runs the connect flow and stores the scoped vault token **server-side**.
  - Exposes its own REST API to the frontend:
    - `GET /api/tasks` · `POST /api/tasks {title}` · `PATCH /api/tasks/{id} {done?,title?}` · `DELETE /api/tasks/{id}`
    - `GET /connect` → 302 to **OVDB Connect** (not straight to a vault server) · `GET /callback` → reads `iss`, exchanges code at `{iss}/token`, stores the connection, 302 back to the frontend
    - `--connect-url` flag selects the OVDB Connect endpoint (default `http://localhost:5000/connect`; prod `https://openvaultdb.com/connect`)
    - `GET /api/status` → whether a vault is connected
  - On each `/api/tasks` op, calls the OVDB record endpoints with the scoped token.
  - CORS: allow origin `http://localhost:5173`.
- `client_id`: `todo-demo.openvaultdb.app`
- `redirect_uri`: `http://localhost:5180/callback` (the demo **Go backend**)
- Publishes a manifest at `public/.well-known/openvaultdb.yaml` (served by the
  frontend): client_id, name, the namespace + role catalog.

## Connect flow (concrete)

The app does **not** pin a vault server. It routes the user through **OVDB Connect**
(openvaultdb.com), which lets the user choose which vault satisfies the request —
a vault registered in their wallet (primary) or one entered manually. OVDB never
touches vault data; it only forwards the request to the chosen server's `/authorize`.

```
1. Frontend → navigate to the demo backend:  GET http://localhost:5180/connect
2. Demo backend → 302 to OVDB Connect (NO vault, NO server URL — Connect resolves them):
   GET http://localhost:5000/connect
       ?client_id=todo-demo.openvaultdb.app
       &redirect_uri=http://localhost:5180/callback
       &namespaceId=todo-demo.openvaultdb.app/openvaultdb/todos
       &role=editor
       &state=<random>
3. OVDB Connect: user picks a registered vault (or pastes server URL + vault id).
   Connect verifies the server (GET {baseUrl}/.well-known/openvaultdb), then
   302 → {vaultServer}/authorize?client_id=…&redirect_uri=…&vault=<vaultId>
          &namespaceId=…&role=…&state=…
4. Vault server shows a consent screen (dev: Approve/Deny), then
   302 → http://localhost:5180/callback?code=<code>&state=<state>&iss={vaultServer}
   `iss` (RFC 9207) tells the app which server issued the code.
5. Demo backend → POST {iss}/token
       { grant_type: "authorization_code", code, client_id, redirect_uri }
   ← { access_token, token_type: "Bearer", expires_in, namespaceId, scope, vault }
   The backend stores { baseURL=iss, vault, token } server-side and 302s to the frontend.
6. Frontend todo ops → demo backend /api/tasks → demo backend → OVDB record CRUD
   against the chosen server/vault:
   GET/POST/PATCH/DELETE
   {iss}/vaults/{vault}/ns/todo-demo.openvaultdb.app%2Fopenvaultdb%2Ftodos/collections/tasks/records[/{id}]
```

- The namespace id contains `/`; URL-encode it in the OVDB path segment (`%2F`).
- `iss` is the issuing vault server's base URL; the app uses it for both `/token`
  and record CRUD. The vault id comes back in the token response (`vault`).
- The OVDB app token is an opaque bearer string scoped to `{ tasks: [read, write,
  delete] }`; the OVDB server MUST reject out-of-scope ops (e.g. a `viewer` token writing).

## Wallet (openvaultdb-com)

- Stores vault/server pointers client-side (localStorage is fine for this milestone).
- GitHub repo vault: list the signed-in user's private repos via the GitHub REST
  API using the GitHub OAuth access token obtained at Firebase GitHub sign-in.
  - The token is captured in `public/js/auth-ui.js`: GitHub sign-in requests the
    `repo` scope (`provider.addScope("repo")`) and reads the OAuth access token
    via `GithubAuthProvider.credentialFromResult(result)` immediately after
    `signInWithPopup`. Firebase never persists this token, so the wallet stores
    it in `sessionStorage` under `gh_access_token` for the current tab/session.
  - `/my/vaults` calls `GET https://api.github.com/user/repos?visibility=all&per_page=100`
    with `Authorization: token <gh_access_token>`. If the token is absent
    (e.g. signed in with Google/email, or a new tab), the page shows a
    re-authenticate prompt instead of a repo list.
- Server registration: validate via `GET /.well-known/openvaultdb`, then store
  `{ baseUrl, ownerToken }`; list vaults via `GET /vaults`.
