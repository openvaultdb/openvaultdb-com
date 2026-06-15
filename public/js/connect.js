// OVDB Connect: the routing step between an app and a vault server. An app
// (e.g. the to-do demo) sends the user here with the namespace + role it wants;
// the user chooses WHICH vault to satisfy that request — either a vault already
// registered in their wallet (primary path) or a manually-entered server+vault.
// We verify the chosen server is an OVDB server, then redirect the browser to
// that server's /authorize, where the user grants consent. OVDB never sees the
// vault's data — it only forwards the request.
import { getVaults, fetchServerInfo, normalizeBaseUrl, OvdbError } from "./wallet-store.js";
import { auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

const $ = (sel) => document.querySelector(sel);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );
}

// ---- incoming app request ------------------------------------------------
const q = new URLSearchParams(location.search);
const req = {
  clientId: q.get("client_id") || "",
  redirectUri: q.get("redirect_uri") || "",
  namespaceId: q.get("namespaceId") || "",
  role: q.get("role") || "",
  state: q.get("state") || "",
};

const missing = ["clientId", "redirectUri", "namespaceId", "role"].filter((k) => !req[k]);
if (missing.length) {
  const err = $("[data-connect-error]");
  err.hidden = false;
  err.textContent = "This connect link is missing required parameters: " + missing.join(", ") + ".";
} else {
  $("[data-connect-app]").hidden = false;
  $("[data-connect-req]").innerHTML = `
    <dt>App</dt><dd><code>${escapeHtml(req.clientId)}</code></dd>
    <dt>Namespace</dt><dd><code>${escapeHtml(req.namespaceId)}</code></dd>
    <dt>Role</dt><dd><code>${escapeHtml(req.role)}</code></dd>`;
  // The registered-vault list is per-user (Firestore); load it once signed in.
  // The manual path needs no account and is wired immediately.
  onAuthStateChanged(auth, (user) => {
    if (user) renderVaults();
  });
  wireManual();
}

// ---- redirect to the chosen vault server's /authorize --------------------
// We forward the app's params verbatim and add the user's vault choice.
function authorizeUrl(baseUrl, vaultId) {
  const params = new URLSearchParams({
    client_id: req.clientId,
    redirect_uri: req.redirectUri,
    vault: vaultId,
    namespaceId: req.namespaceId,
    role: req.role,
    state: req.state,
  });
  return `${normalizeBaseUrl(baseUrl)}/authorize?${params.toString()}`;
}

// Verify the server speaks OpenVaultDB, then navigate to its consent screen.
async function proceed(baseUrl, vaultId, onError) {
  try {
    await fetchServerInfo(baseUrl);
  } catch (e) {
    onError(e instanceof OvdbError ? e.message : "Could not reach that server.");
    return;
  }
  location.assign(authorizeUrl(baseUrl, vaultId));
}

// ---- primary path: registered vaults -------------------------------------
async function renderVaults() {
  const target = $("[data-connect-vaults]");
  const all = await getVaults().catch(() => []);
  const vaults = all.filter((v) => v.kind === "server");
  if (!vaults.length) {
    target.innerHTML =
      '<p class="hint">No vaults on an OpenVaultDB host in your wallet yet. <a href="/my/vaults">Add one</a>, or use the manual connection below.</p>';
    return;
  }
  // Flat list grouped by host (Decision 0003): one section per host, its vaults
  // listed under it.
  const groups = new Map();
  for (const v of vaults) {
    const host = v.hostName || v.baseUrl;
    if (!groups.has(host)) groups.set(host, []);
    groups.get(host).push(v);
  }
  target.innerHTML = `${[...groups.entries()]
    .map(
      ([host, hostVaults]) => `
      <div class="connect-host">
        <p class="ov-host-label">${escapeHtml(host)}</p>
        <div class="repo-list">
          ${hostVaults
            .map(
              (v) => `
            <button class="repo-item" type="button" data-pick-vault="${v.id}">
              <span class="repo-name">${escapeHtml(v.name)}</span>
              <span class="ov-sub">${escapeHtml(host)} · ${escapeHtml(v.name)}</span>
            </button>`,
            )
            .join("")}
        </div>
      </div>`,
    )
    .join("")}
    <p class="ov-error" data-pick-error hidden></p>`;
  target.querySelectorAll("[data-pick-vault]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = vaults.find((x) => x.id === btn.dataset.pickVault);
      const errEl = target.querySelector("[data-pick-error]");
      errEl.hidden = true;
      btn.disabled = true;
      proceed(v.baseUrl, v.vaultId, (msg) => {
        btn.disabled = false;
        errEl.textContent = msg;
        errEl.hidden = false;
      });
    });
  });
}

// ---- fallback: manual connection -----------------------------------------
function wireManual() {
  const urlEl = $("[data-manual-url]");
  const vaultEl = $("[data-manual-vault]");
  const errEl = $("[data-manual-error]");
  const btn = $("[data-manual-go]");
  btn.addEventListener("click", () => {
    const baseUrl = normalizeBaseUrl(urlEl.value);
    const vaultId = vaultEl.value.trim();
    errEl.hidden = true;
    if (!baseUrl || !vaultId) {
      errEl.textContent = "Enter both a server URL and a vault id.";
      errEl.hidden = false;
      return;
    }
    btn.disabled = true;
    proceed(baseUrl, vaultId, (msg) => {
      btn.disabled = false;
      errEl.textContent = msg;
      errEl.hidden = false;
    });
  });
}
