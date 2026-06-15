// Auth UI: header sign-in button, sign-in modal (GitHub / Google / email),
// signed-in chip, and auth-gating of [data-auth-required] / [data-auth-anon].
import { auth } from "./firebase-init.js";
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

const USER_HOME = "/my/vaults";
const onUserPage = location.pathname.startsWith("/my");
let currentUser = null;
let pendingRedirect = null; // where to go after a sign-in triggered by a CTA

// ---- Sign-in modal -------------------------------------------------------
let modal;
let errorEl;
let emailMode = "signin"; // or "signup"

function buildModal() {
  modal = document.createElement("div");
  modal.className = "auth-overlay";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="auth-dialog" role="dialog" aria-modal="true" aria-label="Sign in">
      <button class="auth-close" type="button" aria-label="Close">&times;</button>
      <h3 class="auth-title">Sign in to OpenVaultDB</h3>
      <p class="auth-sub">Access your vaults and apps.</p>

      <button class="auth-provider" data-provider="github" type="button">
        <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
        Continue with GitHub
      </button>
      <button class="auth-provider" data-provider="google" type="button">
        <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.63z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
        Continue with Google
      </button>

      <div class="auth-divider"><span>or</span></div>

      <form class="auth-form" novalidate>
        <input class="auth-input" type="email" name="email" placeholder="Email" autocomplete="email" required />
        <input class="auth-input" type="password" name="password" placeholder="Password" autocomplete="current-password" required minlength="6" />
        <button class="auth-submit" type="submit">Sign in</button>
      </form>

      <p class="auth-error" role="alert" hidden></p>
      <p class="auth-toggle">
        <span data-toggle-text>New here?</span>
        <a href="#" data-toggle-link>Create an account</a>
      </p>
    </div>`;
  document.body.appendChild(modal);
  errorEl = modal.querySelector(".auth-error");

  modal.querySelector(".auth-close").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  modal.querySelectorAll(".auth-provider").forEach((btn) => {
    btn.addEventListener("click", () => providerSignIn(btn.dataset.provider));
  });

  modal.querySelector(".auth-form").addEventListener("submit", emailSubmit);
  modal.querySelector("[data-toggle-link]").addEventListener("click", (e) => {
    e.preventDefault();
    setEmailMode(emailMode === "signin" ? "signup" : "signin");
  });
}

function setEmailMode(mode) {
  emailMode = mode;
  const submit = modal.querySelector(".auth-submit");
  const toggleText = modal.querySelector("[data-toggle-text]");
  const toggleLink = modal.querySelector("[data-toggle-link]");
  const pwd = modal.querySelector('input[name="password"]');
  if (mode === "signup") {
    submit.textContent = "Create account";
    toggleText.textContent = "Already have an account?";
    toggleLink.textContent = "Sign in";
    pwd.autocomplete = "new-password";
  } else {
    submit.textContent = "Sign in";
    toggleText.textContent = "New here?";
    toggleLink.textContent = "Create an account";
    pwd.autocomplete = "current-password";
  }
  showError("");
}

function openModal() {
  if (!modal) buildModal();
  showError("");
  modal.hidden = false;
  modal.querySelector('input[name="email"]').focus();
}
function closeModal() { if (modal) modal.hidden = true; }

function showError(msg) {
  if (!errorEl) return;
  errorEl.textContent = msg || "";
  errorEl.hidden = !msg;
}

function onSignedIn() {
  closeModal();
  const target = pendingRedirect || (onUserPage ? null : USER_HOME);
  pendingRedirect = null;
  if (target) location.assign(target);
}

async function providerSignIn(which) {
  // General login requests MINIMAL scopes (identity only). Repo access is
  // requested later, on demand, via requestGithubToken().
  const provider =
    which === "github" ? new GithubAuthProvider() : new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
    onSignedIn();
  } catch (err) {
    showError(friendlyError(err));
  }
}

// Step-up GitHub authorization: request a GitHub OAuth token with specific
// scopes on demand — e.g. ["public_repo"] to browse public repos, ["repo"] for
// private ones. The token is only exposed on the credential right after the
// popup (Firebase never persists it), so we stash it in sessionStorage.
export async function requestGithubToken(scopes) {
  const provider = new GithubAuthProvider();
  (scopes || []).forEach((s) => provider.addScope(s));
  const result = await signInWithPopup(auth, provider);
  const cred = GithubAuthProvider.credentialFromResult(result);
  const token = cred && cred.accessToken;
  if (token) {
    try {
      sessionStorage.setItem("gh_access_token", token);
      sessionStorage.setItem("gh_token_scope", (scopes || []).join(" "));
    } catch {}
  }
  return token;
}

async function emailSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const email = form.email.value.trim();
  const password = form.password.value;
  try {
    if (emailMode === "signup") {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    onSignedIn();
  } catch (err) {
    showError(friendlyError(err));
  }
}

function friendlyError(err) {
  const code = (err && err.code) || "";
  if (code.includes("popup-closed")) return "Sign-in was cancelled.";
  if (code.includes("invalid-credential") || code.includes("wrong-password")) return "Incorrect email or password.";
  if (code.includes("user-not-found")) return "No account with that email — try creating one.";
  if (code.includes("email-already-in-use")) return "That email is already registered — sign in instead.";
  if (code.includes("weak-password")) return "Password should be at least 6 characters.";
  if (code.includes("account-exists-with-different-credential")) return "Use the provider you originally signed in with.";
  return (err && err.message) || "Something went wrong. Please try again.";
}

// ---- Header slot + gating ------------------------------------------------
function renderSlots(user) {
  document.querySelectorAll("[data-auth-slot]").forEach((slot) => {
    slot.textContent = "";
    if (user) {
      const chip = document.createElement("a");
      chip.className = "user-chip";
      chip.href = USER_HOME;
      const name = user.displayName || user.email || "Account";
      const initial = (name.trim()[0] || "?").toUpperCase();
      chip.innerHTML = `<span class="user-avatar">${initial}</span><span class="user-name"></span>`;
      chip.querySelector(".user-name").textContent = name;
      const out = document.createElement("button");
      out.className = "btn-signout";
      out.type = "button";
      out.textContent = "Sign out";
      out.addEventListener("click", () => signOut(auth));
      slot.append(chip, out);
    } else {
      const btn = document.createElement("button");
      btn.className = "btn-signin";
      btn.type = "button";
      btn.textContent = "Sign in";
      btn.addEventListener("click", openModal);
      slot.append(btn);
    }
  });
}

function applyGating(user) {
  document.querySelectorAll("[data-auth-required]").forEach((el) => { el.hidden = !user; });
  document.querySelectorAll("[data-auth-anon]").forEach((el) => { el.hidden = !!user; });
}

// Click handling:
//  - [data-auth-cta]  a link that requires sign-in; when signed out, open the
//    modal and redirect to the link's href after a successful sign-in.
//  - [data-auth-open] any element that just opens the sign-in modal.
document.addEventListener("click", (e) => {
  const cta = e.target.closest("[data-auth-cta]");
  if (cta) {
    if (currentUser) return; // signed in — let the link navigate normally
    e.preventDefault();
    pendingRedirect = cta.getAttribute("href") || USER_HOME;
    openModal();
    return;
  }
  const opener = e.target.closest("[data-auth-open]");
  if (opener) { e.preventDefault(); openModal(); }
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  renderSlots(user);
  applyGating(user);
});
