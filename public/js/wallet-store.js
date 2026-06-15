// Wallet store: the user's vault directory, held in Firestore under
// /users/{uid}/vaults — one document per vault pointer, owned by the signed-in
// user (rules in firestore.rules). A vault carries its own host details (base
// URL + owner token); there is no separate "servers" store. Vault DATA never
// lives here — only pointers. See Decision 0003 (Host / Vault / Namespace Model).
// The OVDB wire contract is interface/main.tsp.
import { auth, db } from "./firebase-init.js";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const GH_TOKEN_KEY = "gh_access_token"; // GitHub OAuth token (sessionStorage)

// Normalize a base URL: trim, drop trailing slashes.
export function normalizeBaseUrl(input) {
  return String(input || "").trim().replace(/\/+$/, "");
}

// ---- vault pointers (Firestore: /users/{uid}/vaults) ---------------------
// A vault lives on a host. Two kinds:
//   kind: "github" -> { kind, name, fullName, htmlUrl, private }
//        (host = a Git host; the repo is the vault)
//   kind: "server" -> { kind, name, hostName, baseUrl, ownerToken, vaultId, backend }
//        (host = an OpenVaultDB host; one host may back several vaults)
function vaultsCollection() {
  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) throw new OvdbError("Sign in to manage your vaults.");
  return collection(db, "users", uid, "vaults");
}

export async function getVaults() {
  const snap = await getDocs(vaultsCollection());
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addVault(vault) {
  // De-dupe github repos by fullName; server vaults by host baseUrl + vaultId.
  const existing = await getVaults();
  const isDup = existing.some((v) =>
    v.kind === "github" && vault.kind === "github"
      ? v.fullName === vault.fullName
      : v.kind === "server" &&
        vault.kind === "server" &&
        v.baseUrl === vault.baseUrl &&
        v.vaultId === vault.vaultId,
  );
  if (isDup) return null;
  const ref = await addDoc(vaultsCollection(), vault);
  return { id: ref.id, ...vault };
}

export async function removeVault(id) {
  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) throw new OvdbError("Sign in to manage your vaults.");
  await deleteDoc(doc(db, "users", uid, "vaults", id));
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
