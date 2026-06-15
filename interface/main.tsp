// OpenVaultDB local server — HTTP API contract (MVP for the local-server demo).
//
// This is the shared contract between:
//   - the OVDB server (openvaultdb-go)            — implements these operations
//   - the wallet (openvaultdb-com) + demo app     — call these operations
//
// Two auth contexts:
//   - Owner token  (Bearer): the vault owner managing their server (list vaults).
//   - App token    (Bearer): a scoped token an app receives via the connect flow.
//
// Compile: `npx @typespec/compiler compile spec/interface` (emits OpenAPI 3).

import "@typespec/http";

using TypeSpec.Http;

@service(#{ title: "OpenVaultDB Local Server API" })
@server("http://localhost:8088", "Local OVDB server (dev)")
namespace OpenVaultDB;

// ---------------------------------------------------------------------------
// Common types
// ---------------------------------------------------------------------------

/** Collection-level operations, per the shared-namespaces scope model. */
enum Op {
  read,
  write,
  delete,
}

/** A domain-bounded namespace id, e.g. "todo-demo.example/openvaultdb/todos". */
scalar NamespaceId extends string;

/** A vault identifier on this server. */
scalar VaultId extends string;

@error
model ApiError {
  code: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Server identity — used by the wallet to validate a registered server
// ---------------------------------------------------------------------------

model ServerInfo {
  /** Stable id/name of this server instance. */
  name: string;
  /** OpenVaultDB protocol version implemented. */
  protocol: string;
  /** Absolute URLs of the connect-flow endpoints. */
  authorizeEndpoint: url;
  tokenEndpoint: url;
}

@route("/.well-known/openvaultdb")
interface Discovery {
  @get info(): ServerInfo | ApiError;
}

// ---------------------------------------------------------------------------
// Owner-facing: list the vaults this server hosts, and their namespaces
// ---------------------------------------------------------------------------

model Vault {
  id: VaultId;
  name: string;
  /** Storage backend, e.g. "ingit" | "sqlite" | "postgres". */
  backend: string;
}

model Namespace {
  id: NamespaceId;
  /** The owner-domain prefix (schema owner). */
  owner: string;
  /** Collections defined by the namespace's inGitDB schema. */
  collections: string[];
}

@useAuth(BearerAuth)
@route("/vaults")
interface Vaults {
  /** List vaults hosted by this server (owner token). */
  @get list(): Vault[] | ApiError;

  /** List namespaces in a vault. */
  @get
  @route("/{vaultId}/namespaces")
  namespaces(@path vaultId: VaultId): Namespace[] | ApiError;
}

// ---------------------------------------------------------------------------
// Connect flow — an app obtains a scoped token for one namespace
// ---------------------------------------------------------------------------

model AuthorizeQuery {
  /** The app's authoritative domain (its client_id). */
  @query client_id: string;
  /** Where to return the authorization code. */
  @query redirect_uri: url;
  /** The vault the app wants to use. */
  @query vault: VaultId;
  /** The namespace the app requests. */
  @query namespaceId: NamespaceId;
  /** Requested role name (from the namespace manifest) or explicit scope. */
  @query role: string;
  /** Opaque CSRF/state echoed back to the app. */
  @query state: string;
}

/** 302 redirect to `redirect_uri?code=...&state=...` after user consent. */
model AuthorizeRedirect {
  @statusCode statusCode: 302;
  @header location: url;
}

model TokenRequest {
  grant_type: "authorization_code";
  code: string;
  client_id: string;
  redirect_uri: url;
}

model TokenResponse {
  access_token: string;
  token_type: "Bearer";
  /** Seconds until expiry. */
  expires_in: int32;
  /** The granted namespace and per-collection ops. */
  namespaceId: NamespaceId;
  scope: Record<Op[]>;
}

interface Connect {
  /** Begin the connect flow; the server authenticates the user and shows consent. */
  @get
  @route("/authorize")
  authorize(...AuthorizeQuery): AuthorizeRedirect | ApiError;

  /** Exchange the authorization code for a scoped app token. */
  @post
  @route("/token")
  token(@body req: TokenRequest): TokenResponse | ApiError;
}

// ---------------------------------------------------------------------------
// Data plane — record CRUD within a granted namespace (app scoped token)
// ---------------------------------------------------------------------------

/** An opaque record; shape is governed by the namespace's inGitDB collection schema. */
model VaultRecord is Record<unknown>;

@useAuth(BearerAuth)
@route("/vaults/{vaultId}/ns/{ns}/collections/{collection}/records")
interface Records {
  @get list(
    @path vaultId: VaultId,
    @path ns: NamespaceId,
    @path collection: string,
  ): VaultRecord[] | ApiError;

  @post create(
    @path vaultId: VaultId,
    @path ns: NamespaceId,
    @path collection: string,
    @body record: VaultRecord,
  ): VaultRecord | ApiError;

  @route("/{id}")
  @patch update(
    @path vaultId: VaultId,
    @path ns: NamespaceId,
    @path collection: string,
    @path id: string,
    @body patch: VaultRecord,
  ): VaultRecord | ApiError;

  @route("/{id}")
  @delete remove(
    @path vaultId: VaultId,
    @path ns: NamespaceId,
    @path collection: string,
    @path id: string,
  ): void | ApiError;
}
