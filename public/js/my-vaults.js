// /my/vaults page logic. A vault lives on a host (Decision 0003). Two ways to
// add one: (a) an OpenVaultDB host — enter its URL + owner token, then pick one
// of the vaults it holds; (b) a GitHub repo — pick from the GitHub API. Vaults
// are stored as pointers in localStorage; each carries its host details.
import {
  getVaults,
  addVault,
  removeVault,
  getGithubToken,
  fetchServerInfo,
  fetchVaults,
  fetchNamespaces,
  normalizeBaseUrl,
} from "./wallet-store.js";
import { requestGithubToken } from "./auth-ui.js";
import { auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

const $ = (sel) => document.querySelector(sel);
const listEl = $("[data-vault-list]");
const addv = $("[data-addv]");
const hostPanel = $('[data-addv-panel="host"]');
const ghPanel = $('[data-addv-panel="github"]');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );
}

// ---- add-vault chooser ---------------------------------------------------
$("[data-add-vault]").addEventListener("click", () => {
  const show = addv.hidden;
  addv.hidden = !show;
  if (show) selectTab("host");
});
$("[data-addv-close]").addEventListener("click", () => {
  addv.hidden = true;
});
addv.querySelectorAll("[data-addv-tab]").forEach((btn) => {
  btn.addEventListener("click", () => selectTab(btn.dataset.addvTab));
});

function selectTab(which) {
  addv.querySelectorAll("[data-addv-tab]").forEach((b) =>
    b.classList.toggle("active", b.dataset.addvTab === which),
  );
  hostPanel.hidden = which !== "host";
  ghPanel.hidden = which !== "github";
  if (which === "host") renderHostPanel();
  else loadGithubRepos();
}

// ---- path (a): a vault on an OpenVaultDB host -----------------------------
function renderHostPanel() {
  hostPanel.innerHTML = `
    <p class="hint">Connect an OpenVaultDB host, then pick a vault it holds. The owner token authorizes the wallet to list vaults — it stays on this device.</p>
    <label class="field"><span>Host name (optional)</span>
      <input class="ovin" type="text" placeholder="My local host" data-host-name /></label>
    <label class="field"><span>Base URL</span>
      <input class="ovin" type="url" placeholder="http://localhost:8088" data-host-url /></label>
    <label class="field"><span>Owner token</span>
      <input class="ovin" type="password" placeholder="paste the host's owner token" data-host-token /></label>
    <button class="btn-add" type="button" data-host-connect>Connect host</button>
    <div data-host-result></div>`;
  hostPanel.querySelector("[data-host-connect]").addEventListener("click", connectHost);
}

async function connectHost() {
  const result = hostPanel.querySelector("[data-host-result]");
  const hostNameInput = hostPanel.querySelector("[data-host-name]").value.trim();
  const baseUrl = normalizeBaseUrl(hostPanel.querySelector("[data-host-url]").value);
  const ownerToken = hostPanel.querySelector("[data-host-token]").value.trim();
  if (!baseUrl || !ownerToken) {
    result.innerHTML = '<p class="ov-error">Enter both a base URL and an owner token.</p>';
    return;
  }
  result.innerHTML = '<p class="ov-loading">Verifying host…</p>';
  let info, vaults;
  try {
    info = await fetchServerInfo(baseUrl);
    vaults = await fetchVaults({ baseUrl, ownerToken });
  } catch (err) {
    result.innerHTML = `<p class="ov-error">${escapeHtml(err.message || "Could not reach that host.")}</p>`;
    return;
  }
  const hostName = hostNameInput || info.name || baseUrl;
  if (!Array.isArray(vaults) || !vaults.length) {
    result.innerHTML = '<p class="ov-loading">This host holds no vaults.</p>';
    return;
  }
  result.innerHTML = `
    <p class="hint">Select the vaults to add from <strong>${escapeHtml(hostName)}</strong>.</p>
    <div class="vault-checks">
      ${vaults
        .map(
          (v) => `
        <label class="vault-check">
          <input type="checkbox" checked data-vault-check value="${escapeHtml(v.id)}"
            data-vault-name="${escapeHtml(v.name)}" data-vault-backend="${escapeHtml(v.backend || "")}" />
          <span class="repo-name">${escapeHtml(v.name)}</span>
          <span class="ov-tag">${escapeHtml(v.backend || "vault")}</span>
          <span class="ov-id">${escapeHtml(v.id)}</span>
        </label>`,
        )
        .join("")}
    </div>
    <button class="btn-add" type="button" data-add-selected>Add vault</button>`;

  // Multi-select: all checked by default; the button text reflects the count and
  // disables when nothing is selected.
  const checks = [...result.querySelectorAll("[data-vault-check]")];
  const addBtn = result.querySelector("[data-add-selected]");
  function refreshAddBtn() {
    const n = checks.filter((c) => c.checked).length;
    addBtn.disabled = n === 0;
    addBtn.textContent = n > 1 ? `Add ${n} vaults` : "Add vault";
  }
  checks.forEach((c) => c.addEventListener("change", refreshAddBtn));
  refreshAddBtn();

  addBtn.addEventListener("click", async () => {
    const selected = checks.filter((c) => c.checked);
    if (!selected.length) return;
    addBtn.disabled = true;
    let added = 0;
    let dup = 0;
    for (const c of selected) {
      const ok = await addVault({
        kind: "server",
        name: c.dataset.vaultName,
        hostName,
        baseUrl,
        ownerToken,
        vaultId: c.value,
        backend: c.dataset.vaultBackend,
      });
      if (ok) added++;
      else dup++;
    }
    addv.hidden = true;
    await render();
    if (dup) flash(`Added ${added} vault${added === 1 ? "" : "s"}; ${dup} already in your wallet.`);
  });
}

// ---- path (b): GitHub repos (incremental scopes) -------------------------
function loadGithubRepos() {
  ghPanel.innerHTML = `
    <p class="hint">Register a GitHub repository as a vault. We only ask GitHub for the access you choose.</p>
    <div class="gh-actions">
      <button class="btn-ghost-sm" type="button" data-gh="public">Browse my public repos</button>
      <button class="btn-ghost-sm" type="button" data-gh="private">Select my private repo</button>
    </div>
    <div data-gh-result></div>`;
  ghPanel.querySelector('[data-gh="public"]').addEventListener("click", () => pickRepos("public"));
  ghPanel.querySelector('[data-gh="private"]').addEventListener("click", () => pickRepos("private"));
}

async function pickRepos(mode) {
  const result = ghPanel.querySelector("[data-gh-result]");
  const needScope = mode === "private" ? "repo" : "public_repo";
  const haveScope = sessionStorage.getItem("gh_token_scope") || "";
  let token = getGithubToken();
  if (!token || (needScope === "repo" && !haveScope.split(" ").includes("repo"))) {
    result.innerHTML = '<p class="ov-loading">Waiting for GitHub authorization…</p>';
    try {
      token = await requestGithubToken([needScope]);
    } catch (err) {
      result.innerHTML = `<p class="ov-error">${escapeHtml(err?.message || "GitHub authorization was cancelled.")}</p>`;
      return;
    }
    if (!token) {
      result.innerHTML = '<p class="ov-error">No GitHub token returned.</p>';
      return;
    }
  }

  const visibility = mode === "private" ? "all" : "public";
  result.innerHTML = '<p class="ov-loading">Loading repositories…</p>';
  let repos;
  try {
    const res = await fetch(
      `https://api.github.com/user/repos?visibility=${visibility}&affiliation=owner&per_page=100&sort=updated`,
      { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github+json" } },
    );
    if (res.status === 401) {
      result.innerHTML = '<p class="ov-error">GitHub rejected the token. Try again to re-authorize.</p>';
      return;
    }
    if (!res.ok) {
      result.innerHTML = `<p class="ov-error">GitHub returned ${res.status}.</p>`;
      return;
    }
    repos = await res.json();
  } catch {
    result.innerHTML = '<p class="ov-error">Could not reach the GitHub API.</p>';
    return;
  }
  if (!Array.isArray(repos) || !repos.length) {
    result.innerHTML = '<p class="ov-loading">No repositories found.</p>';
    return;
  }
  result.innerHTML = `
    <p class="hint">Pick a repository to register as a vault.</p>
    <div class="repo-list">
      ${repos
        .map(
          (r) => `
        <button class="repo-item" type="button"
          data-pick-repo="${escapeHtml(r.full_name)}"
          data-repo-name="${escapeHtml(r.name)}"
          data-repo-url="${escapeHtml(r.html_url)}"
          data-repo-private="${r.private ? "1" : "0"}">
          <span class="repo-name">${escapeHtml(r.full_name)}</span>
          <span class="ov-tag">${r.private ? "private" : "public"}</span>
        </button>`,
        )
        .join("")}
    </div>`;
  result.querySelectorAll("[data-pick-repo]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const added = addVault({
        kind: "github",
        name: btn.dataset.repoName,
        fullName: btn.dataset.pickRepo,
        htmlUrl: btn.dataset.repoUrl,
        private: btn.dataset.repoPrivate === "1",
      });
      addv.hidden = true;
      render();
      if (!added) flash("That repository is already registered.");
    });
  });
}

// ---- list (flat; host shown as an attribute, namespaces read-only) -------
async function render() {
  let vaults;
  try {
    vaults = await getVaults();
  } catch {
    listEl.innerHTML = '<div class="area-empty">Sign in to see your vaults.</div>';
    return;
  }
  if (!vaults.length) {
    listEl.innerHTML =
      '<div class="area-empty">No vaults yet. Use "Add vault" to connect an OpenVaultDB host or a GitHub repo.</div>';
    return;
  }
  listEl.innerHTML = `<div class="ov-vaults">${vaults
    .map((v) =>
      v.kind === "github"
        ? `
      <div class="ov-row">
        <div class="ov-row-main">
          <div class="ov-row-info">
            <span class="ov-name">${escapeHtml(v.name)} <span class="ov-tag">GitHub</span>${v.private ? '<span class="ov-tag">private</span>' : ""}</span>
            <a class="ov-sub" href="${escapeHtml(v.htmlUrl)}" target="_blank" rel="noopener">${escapeHtml(v.fullName)} ↗</a>
          </div>
          <button class="btn-remove" type="button" data-remove="${v.id}">Remove</button>
        </div>
      </div>`
        : `
      <div class="ov-row">
        <div class="ov-row-main">
          <div class="ov-row-info">
            <span class="ov-name">${escapeHtml(v.name)} <span class="ov-tag">${escapeHtml(v.backend || "vault")}</span></span>
            <span class="ov-sub">${escapeHtml(v.hostName || v.baseUrl)} · ${escapeHtml(v.baseUrl)}</span>
            <span class="ov-ns" data-ns-for="${v.id}"><span class="ov-loading">Loading namespaces…</span></span>
          </div>
          <button class="btn-remove" type="button" data-remove="${v.id}">Remove</button>
        </div>
      </div>`,
    )
    .join("")}</div>`;

  // Namespaces are created by apps — show them read-only, best-effort.
  vaults
    .filter((v) => v.kind === "server")
    .forEach((v) => loadNamespaces(v));
}

async function loadNamespaces(vault) {
  const slot = listEl.querySelector(`[data-ns-for="${vault.id}"]`);
  if (!slot) return;
  try {
    const list = await fetchNamespaces({ baseUrl: vault.baseUrl, ownerToken: vault.ownerToken }, vault.vaultId);
    if (!Array.isArray(list) || !list.length) {
      slot.innerHTML = '<span class="ov-muted">No namespaces yet — they appear when an app connects.</span>';
      return;
    }
    slot.innerHTML = list
      .map((ns) => `<span class="ov-tag">${escapeHtml(ns.id || ns.name || "namespace")}</span>`)
      .join(" ");
  } catch {
    slot.innerHTML = '<span class="ov-muted">Namespaces unavailable (host offline?).</span>';
  }
}

listEl.addEventListener("click", async (e) => {
  const rm = e.target.closest("[data-remove]");
  if (rm && confirm("Remove this vault from your wallet?")) {
    await removeVault(rm.dataset.remove);
    await render();
  }
});

function flash(msg) {
  alert(msg);
}

// The directory is per-user (Firestore): render once we know who is signed in.
onAuthStateChanged(auth, (user) => {
  if (user) render();
  else listEl.innerHTML = '<div class="area-empty">Sign in to see your vaults.</div>';
});
