// Wallet store: client-side pointers for the local-server demo milestone.
// No backend — everything lives in localStorage (servers + vault pointers).
// The OVDB wire contract is interface/main.tsp.

const SERVERS_KEY = "ovdb_servers"; // [{ id, name, baseUrl, ownerToken }]
const VAULTS_KEY = "ovdb_vaults"; // [{ id, kind, ... }]
const GH_TOKEN_KEY = "gh_access_token"; // GitHub OAuth token (sessionStorage)

// ---- generic helpers -----------------------------------------------------
function readList(key) {
  try {
    const raw = localStorage.getItem(key);
    const val = raw ? JSON.parse(raw) : [];
    return Array.isArray(val) ? val : [];
  } catch {
    return [];
  }
}
function writeList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}
function uid() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

// Normalize a base URL: trim, drop trailing slashes.
export function normalizeBaseUrl(input) {
  return String(input || "").trim().replace(/\/+$/, "");
}

// ---- servers -------------------------------------------------------------
export function getServers() {
  return readList(SERVERS_KEY);
}
export function getServer(id) {
  return getServers().find((s) => s.id === id) || null;
}
export function addServer({ name, baseUrl, ownerToken }) {
  const servers = getServers();
  const normUrl = normalizeBaseUrl(baseUrl);
  const existing = servers.find((s) => s.baseUrl === normUrl);
  const entry = {
    id: existing ? existing.id : uid(),
    name,
    baseUrl: normUrl,
    ownerToken,
  };
  const next = existing
    ? servers.map((s) => (s.id === existing.id ? entry : s))
    : [...servers, entry];
  writeList(SERVERS_KEY, next);
  return entry;
}
export function removeServer(id) {
  writeList(
    SERVERS_KEY,
    getServers().filter((s) => s.id !== id),
  );
}

// ---- vault pointers ------------------------------------------------------
// kind: "github" -> { id, kind, name, fullName, htmlUrl, private }
// kind: "server" -> { id, kind, name, serverId, serverName, baseUrl, vaultId, backend }
export function getVaults() {
  return readList(VAULTS_KEY);
}
export function addVault(vault) {
  const vaults = getVaults();
  // De-dupe github repos by fullName; server vaults by serverId+vaultId.
  const isDup = vaults.some((v) =>
    v.kind === "github" && vault.kind === "github"
      ? v.fullName === vault.fullName
      : v.kind === "server" &&
        vault.kind === "server" &&
        v.serverId === vault.serverId &&
        v.vaultId === vault.vaultId,
  );
  if (isDup) return null;
  const entry = { id: uid(), ...vault };
  writeList(VAULTS_KEY, [...vaults, entry]);
  return entry;
}
export function removeVault(id) {
  writeList(
    VAULTS_KEY,
    getVaults().filter((v) => v.id !== id),
  );
}

// ---- GitHub OAuth token --------------------------------------------------
export function getGithubToken() {
  try {
    return sessionStorage.getItem(GH_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

// ---- OVDB server calls (interface/main.tsp) ------------------------------
class OvdbError extends Error {}

async function ovdbJson(url, { ownerToken, signal } = {}) {
  const headers = {};
  if (ownerToken) headers.Authorization = `Bearer ${ownerToken}`;
  let res;
  try {
    res = await fetch(url, { headers, signal });
  } catch {
    throw new OvdbError("Server unreachable. Is it running and is CORS allowed?");
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body && body.message ? `: ${body.message}` : "";
    } catch {}
    if (res.status === 401 || res.status === 403) {
      throw new OvdbError(`Unauthorized — check the owner token${detail}`);
    }
    throw new OvdbError(`Server returned ${res.status}${detail}`);
  }
  try {
    return await res.json();
  } catch {
    throw new OvdbError("Server returned a non-JSON response.");
  }
}

// GET {baseUrl}/.well-known/openvaultdb -> ServerInfo
export async function fetchServerInfo(baseUrl, signal) {
  const url = `${normalizeBaseUrl(baseUrl)}/.well-known/openvaultdb`;
  const info = await ovdbJson(url, { signal });
  if (!info || typeof info.name !== "string" || typeof info.protocol !== "string") {
    throw new OvdbError("Not an OpenVaultDB server (missing identity fields).");
  }
  return info; // { name, protocol, authorizeEndpoint, tokenEndpoint }
}

// GET {baseUrl}/vaults -> Vault[]
export async function fetchVaults(server, signal) {
  return ovdbJson(`${normalizeBaseUrl(server.baseUrl)}/vaults`, {
    ownerToken: server.ownerToken,
    signal,
  });
}

// GET {baseUrl}/vaults/{vaultId}/namespaces -> Namespace[]
export async function fetchNamespaces(server, vaultId, signal) {
  const url = `${normalizeBaseUrl(server.baseUrl)}/vaults/${encodeURIComponent(
    vaultId,
  )}/namespaces`;
  return ovdbJson(url, { ownerToken: server.ownerToken, signal });
}

export { OvdbError };
