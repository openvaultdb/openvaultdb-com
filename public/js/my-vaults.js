// /my/vaults page logic: render stored vault pointers and add new ones via two
// paths — (a) a private GitHub repo (listed via the GitHub REST API using the
// OAuth token captured at sign-in), (b) a vault on a registered OVDB server.
// All pointers in localStorage.
import {
  getVaults,
  addVault,
  removeVault,
  getServers,
  getServer,
  getGithubToken,
  fetchVaults,
} from "./wallet-store.js";
import { requestGithubToken } from "./auth-ui.js";

const $ = (sel) => document.querySelector(sel);
const listEl = $("[data-vault-list]");
const addv = $("[data-addv]");
const ghPanel = $('[data-addv-panel="github"]');
const serverPanel = $('[data-addv-panel="server"]');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );
}

// ---- add-vault chooser ---------------------------------------------------
$("[data-add-vault]").addEventListener("click", () => {
  const show = addv.hidden;
  addv.hidden = !show;
  if (show) {
    selectTab("github");
  }
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
  ghPanel.hidden = which !== "github";
  serverPanel.hidden = which !== "server";
  if (which === "github") loadGithubRepos();
  else loadServerVaults();
}

// ---- path (a): GitHub repos (incremental scopes) -------------------------
// Login stays minimal. We only request `public_repo` when the user browses
// public repos, and escalate to `repo` only when they choose to pick a private
// one — never at sign-in.
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
  // (Re)authorize only when we lack a token, or need `repo` but only hold `public_repo`.
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
    <p class="hint">Pick a repository to register as a vault pointer.</p>
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

// ---- path (b): vault from a registered server ----------------------------
async function loadServerVaults() {
  const servers = getServers();
  if (!servers.length) {
    serverPanel.innerHTML =
      '<p class="hint">No servers registered. <a href="/my/servers">Register an OVDB server</a> first.</p>';
    return;
  }
  serverPanel.innerHTML = `
    <label class="field">
      <span>Server</span>
      <select class="ovin" data-server-select>
        ${servers
          .map((s) => `<option value="${s.id}">${escapeHtml(s.name)} — ${escapeHtml(s.baseUrl)}</option>`)
          .join("")}
      </select>
    </label>
    <div data-server-vaults><p class="ov-loading">Loading vaults…</p></div>`;
  const select = serverPanel.querySelector("[data-server-select]");
  select.addEventListener("change", () => listVaultsForServer(select.value));
  listVaultsForServer(select.value);
}

async function listVaultsForServer(serverId) {
  const target = serverPanel.querySelector("[data-server-vaults]");
  target.innerHTML = '<p class="ov-loading">Loading vaults…</p>';
  const server = getServer(serverId);
  let vaults;
  try {
    vaults = await fetchVaults(server);
  } catch (err) {
    target.innerHTML = `<p class="ov-error">${escapeHtml(err.message || "Failed to load vaults.")}</p>`;
    return;
  }
  if (!Array.isArray(vaults) || !vaults.length) {
    target.innerHTML = '<p class="ov-loading">This server hosts no vaults.</p>';
    return;
  }
  target.innerHTML = `
    <div class="repo-list">
      ${vaults
        .map(
          (v) => `
        <button class="repo-item" type="button" data-pick-vault="${escapeHtml(v.id)}" data-vault-name="${escapeHtml(v.name)}" data-vault-backend="${escapeHtml(v.backend)}">
          <span class="repo-name">${escapeHtml(v.name)}</span>
          <span class="ov-tag">${escapeHtml(v.backend)}</span>
          <span class="ov-id">${escapeHtml(v.id)}</span>
        </button>`,
        )
        .join("")}
    </div>`;
  target.querySelectorAll("[data-pick-vault]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const added = addVault({
        kind: "server",
        name: btn.dataset.vaultName,
        serverId: server.id,
        serverName: server.name,
        baseUrl: server.baseUrl,
        vaultId: btn.dataset.pickVault,
        backend: btn.dataset.vaultBackend,
      });
      addv.hidden = true;
      render();
      if (!added) flash("That vault is already registered.");
    });
  });
}

// ---- list ----------------------------------------------------------------
function render() {
  const vaults = getVaults();
  if (!vaults.length) {
    listEl.innerHTML =
      '<div class="area-empty">No vaults yet. Use "Add vault" to register a GitHub repo or a vault from a server.</div>';
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
            <span class="ov-name">${escapeHtml(v.name)} <span class="ov-tag">${escapeHtml(v.backend)}</span></span>
            <span class="ov-sub">${escapeHtml(v.serverName)} · ${escapeHtml(v.baseUrl)} · vault ${escapeHtml(v.vaultId)}</span>
          </div>
          <button class="btn-remove" type="button" data-remove="${v.id}">Remove</button>
        </div>
      </div>`,
    )
    .join("")}</div>`;
}

listEl.addEventListener("click", (e) => {
  const rm = e.target.closest("[data-remove]");
  if (rm && confirm("Remove this vault pointer?")) {
    removeVault(rm.dataset.remove);
    render();
  }
});

function flash(msg) {
  alert(msg);
}

render();
