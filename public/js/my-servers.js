// /my/servers page logic: register an OVDB server (validated via
// /.well-known/openvaultdb), list registered servers, drill into a server's
// vaults and a selected vault's namespaces. All pointers in localStorage.
import {
  getServers,
  getServer,
  addServer,
  removeServer,
  fetchServerInfo,
  fetchVaults,
  fetchNamespaces,
  OvdbError,
} from "./wallet-store.js";

const $ = (sel) => document.querySelector(sel);

const form = $("[data-reg-form]");
const formMsg = $("[data-reg-msg]");
const listEl = $("[data-server-list]");

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );
}

// ---- register form -------------------------------------------------------
function showForm(show) {
  form.hidden = !show;
  setMsg("", null);
  if (show) {
    form.reset();
    form.querySelector('input[name="baseUrl"]').focus();
  }
}
function setMsg(text, kind) {
  formMsg.textContent = text || "";
  formMsg.hidden = !text;
  formMsg.className = "reg-msg" + (kind ? ` is-${kind}` : "");
}

$("[data-add-server]").addEventListener("click", () => showForm(form.hidden));
$("[data-reg-cancel]").addEventListener("click", () => showForm(false));

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const baseUrl = form.baseUrl.value.trim();
  const ownerToken = form.ownerToken.value.trim();
  if (!baseUrl || !ownerToken) return;

  const submitBtn = form.querySelector("[data-reg-submit]");
  submitBtn.disabled = true;
  setMsg("Validating server…", "info");
  try {
    const info = await fetchServerInfo(baseUrl);
    addServer({ name: info.name, baseUrl, ownerToken });
    setMsg(
      `Saved "${info.name}" (protocol ${info.protocol}).`,
      "ok",
    );
    form.reset();
    form.hidden = true;
    render();
  } catch (err) {
    setMsg(
      err instanceof OvdbError ? err.message : "Could not validate the server.",
      "err",
    );
  } finally {
    submitBtn.disabled = false;
  }
});

// ---- server list + drill-down --------------------------------------------
function render() {
  const servers = getServers();
  if (!servers.length) {
    listEl.innerHTML =
      '<div class="area-empty">No servers registered yet. Register one to browse its vaults.</div>';
    return;
  }
  listEl.innerHTML = servers
    .map(
      (s) => `
      <div class="ov-row" data-server="${s.id}">
        <div class="ov-row-main">
          <button class="ov-row-toggle" type="button" data-open="${s.id}">
            <span class="ov-name">${escapeHtml(s.name)}</span>
            <span class="ov-sub">${escapeHtml(s.baseUrl)}</span>
          </button>
          <button class="btn-remove" type="button" data-remove="${s.id}" aria-label="Remove server">Remove</button>
        </div>
        <div class="ov-detail" data-detail="${s.id}" hidden></div>
      </div>`,
    )
    .join("");
}

listEl.addEventListener("click", (e) => {
  const open = e.target.closest("[data-open]");
  if (open) return toggleServer(open.dataset.open);
  const remove = e.target.closest("[data-remove]");
  if (remove) {
    if (confirm("Remove this server pointer? (No data on the server is touched.)")) {
      removeServer(remove.dataset.remove);
      render();
    }
  }
});

async function toggleServer(id) {
  const detail = listEl.querySelector(`[data-detail="${id}"]`);
  if (!detail) return;
  if (!detail.hidden) {
    detail.hidden = true;
    return;
  }
  detail.hidden = false;
  detail.innerHTML = '<p class="ov-loading">Loading vaults…</p>';
  const server = getServer(id);
  try {
    const vaults = await fetchVaults(server);
    if (!Array.isArray(vaults) || !vaults.length) {
      detail.innerHTML = '<p class="ov-loading">This server hosts no vaults.</p>';
      return;
    }
    detail.innerHTML = `
      <div class="ov-vaults">
        ${vaults
          .map(
            (v) => `
          <div class="ov-vault" data-vault="${escapeHtml(v.id)}">
            <button class="ov-vault-head" type="button" data-vault-open="${escapeHtml(v.id)}">
              <span class="ov-name">${escapeHtml(v.name)}</span>
              <span class="ov-tag">${escapeHtml(v.backend)}</span>
              <span class="ov-id">${escapeHtml(v.id)}</span>
            </button>
            <div class="ov-ns" data-ns="${escapeHtml(v.id)}" hidden></div>
          </div>`,
          )
          .join("")}
      </div>`;
  } catch (err) {
    detail.innerHTML = `<p class="ov-error">${escapeHtml(
      err instanceof OvdbError ? err.message : "Failed to load vaults.",
    )}</p>`;
  }
}

listEl.addEventListener("click", async (e) => {
  const open = e.target.closest("[data-vault-open]");
  if (!open) return;
  const serverId = open.closest("[data-server]").dataset.server;
  const vaultId = open.dataset.vaultOpen;
  const nsEl = open
    .closest("[data-vault]")
    .querySelector(`[data-ns]`);
  if (!nsEl.hidden) {
    nsEl.hidden = true;
    return;
  }
  nsEl.hidden = false;
  nsEl.innerHTML = '<p class="ov-loading">Loading namespaces…</p>';
  try {
    const namespaces = await fetchNamespaces(getServer(serverId), vaultId);
    if (!Array.isArray(namespaces) || !namespaces.length) {
      nsEl.innerHTML = '<p class="ov-loading">No namespaces in this vault.</p>';
      return;
    }
    nsEl.innerHTML = namespaces
      .map(
        (ns) => `
        <div class="ov-ns-row">
          <code class="ov-ns-id">${escapeHtml(ns.id)}</code>
          <span class="ov-ns-owner">owner: ${escapeHtml(ns.owner)}</span>
          <span class="ov-ns-cols">${(ns.collections || [])
            .map((c) => `<span class="ov-chip">${escapeHtml(c)}</span>`)
            .join("")}</span>
        </div>`,
      )
      .join("");
  } catch (err) {
    nsEl.innerHTML = `<p class="ov-error">${escapeHtml(
      err instanceof OvdbError ? err.message : "Failed to load namespaces.",
    )}</p>`;
  }
});

render();
