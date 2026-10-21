import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const { create, GA_ID, KEY } = createRequire(import.meta.url)("../public/js/analytics.js");

class El {
  constructor(tag) {
    this.tag = tag; this.children = []; this.attrs = {}; this.handlers = {};
    this.parentNode = null; this.hidden = true; this.focused = false;
  }
  setAttribute(k, v) { this.attrs[k] = v; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  get firstChild() { return this.children[0] || null; }
  insertBefore(c, ref) {
    c.parentNode = this;
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
    return c;
  }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; }
  addEventListener(t, f) { this.handlers[t] = f; }
  click() { this.handlers.click.call(this); }
  focus() { this.focused = true; }
  find(pred) {
    for (const c of this.children) {
      if (pred(c)) return c;
      const r = c.find ? c.find(pred) : null;
      if (r) return r;
    }
    return null;
  }
  button(text) { return this.find((c) => c.tag === "button" && c.textContent === text); }
}

function env({ host = "openvaultdb.com", href = "https://openvaultdb.com/docs/?q=secret#frag", referrer = "", stored, brokenStorage = false, cookies = [] } = {}) {
  const store = new Map(stored === undefined ? [] : [[KEY, stored]]);
  const jar = cookies.map(([name, domain]) => ({ name, domain: domain || null }));
  const head = new El("head"), body = new El("body");
  const opener = new El("button");
  const listeners = {};
  const docListeners = new Set();
  const doc = {
    head, body, referrer,
    addEventListener: (t) => docListeners.add(t),
    removeEventListener: (t) => docListeners.delete(t), createElement: (t) => new El(t),
    createTextNode: (t) => ({ textContent: t }),
    querySelectorAll: () => [opener],
    get cookie() { return [...new Set(jar.map((c) => c.name))].map((n) => `${n}=1`).join("; "); },
    set cookie(v) {
      const parts = v.split(";").map((x) => x.trim());
      const name = parts[0].split("=")[0];
      const domain = (parts.find((p) => p.startsWith("domain=")) || "").slice(7) || null;
      if (parts.some((p) => p.startsWith("expires=Thu, 01 Jan 1970"))) {
        for (let i = jar.length - 1; i >= 0; i--) if (jar[i].name === name && jar[i].domain === domain) jar.splice(i, 1);
      } else jar.push({ name, domain });
    },
  };
  const win = {
    document: doc, dataLayer: undefined,
    location: { hostname: host, href, origin: new URL(href).origin },
    addEventListener: (t, f) => { listeners[t] = f; },
    localStorage: brokenStorage
      ? { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } }
      : { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) },
  };
  const scripts = () => head.children.filter((c) => c.tag === "script").map((c) => c.src);
  const banner = () => body.find((c) => c.attrs.role === "region");
  return { win, doc, store, jar, scripts, banner, opener, listeners, docListeners };
}

const calls = (win) => (win.dataLayer || []).map((a) => Array.from(a));

test("measurement ID is the OpenVaultDB property stream", () => {
  assert.equal(GA_ID, "G-B2RWRSXVZE");
});

test("no choice: banner shown, no gtag, no dataLayer entries, no script", () => {
  const e = env();
  create(e.win).start();
  assert.deepEqual(e.scripts(), []);
  assert.equal(e.win.dataLayer, undefined);
  const b = e.banner();
  assert.equal(b.attrs["aria-label"], "Analytics choice");
  assert.ok(b.button("Accept analytics"));
  assert.ok(b.button("Reject"));
  assert.equal(b.find((c) => c.tag === "a").href, "/privacy/#analytics");
  assert.equal(e.opener.hidden, false);
});

test("invalid stored value counts as no choice", () => {
  const e = env({ stored: "yes" });
  create(e.win).start();
  assert.ok(e.banner());
  assert.deepEqual(e.scripts(), []);
});

test("Accept: consent default denied then update, scrubbed config, gtag.js once", () => {
  const e = env({ referrer: "https://example.org/a/b?x=1#y" });
  create(e.win).start();
  e.banner().button("Accept analytics").click();
  assert.equal(e.store.get(KEY), "granted");
  assert.equal(e.banner(), null);
  const c = calls(e.win);
  assert.deepEqual(c[0], ["consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" }]);
  assert.deepEqual(c[1], ["consent", "update", { analytics_storage: "granted" }]);
  assert.equal(c[2][0], "js");
  assert.equal(c[4][0], "set");
  assert.deepEqual(c[3], ["config", "G-B2RWRSXVZE", {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: "https://openvaultdb.com/docs/",
    page_referrer: "https://example.org/a/b",
  }]);
  assert.deepEqual(c[4], ["set", { page_location: "https://openvaultdb.com/docs/", page_referrer: "https://example.org/a/b" }]);
  assert.deepEqual(e.scripts(), ["https://www.googletagmanager.com/gtag/js?id=G-B2RWRSXVZE"]);
  assert.equal(e.win["ga-disable-G-B2RWRSXVZE"], false);
});

test("stored granted loads on start without banner; page loads tag once", () => {
  const e = env({ stored: "granted" });
  const a = create(e.win);
  a.start();
  a.decide("granted");
  assert.equal(e.banner(), null);
  assert.equal(e.scripts().length, 1);
});

test("Reject / stored denied: nothing loads, stale _ga cookies are removed", () => {
  const e = env({ cookies: [["_ga"], ["_ga_ABC", ".openvaultdb.com"], ["keep"]] });
  create(e.win).start();
  e.banner().button("Reject").click();
  assert.equal(e.store.get(KEY), "denied");
  assert.deepEqual(e.scripts(), []);
  assert.equal(e.win.dataLayer, undefined);
  assert.deepEqual(e.jar.map((c) => c.name), ["keep"]);
});

test("withdrawal after grant: consent denied, ga-disable set, host and parent cookies deleted", () => {
  const e = env({ host: "www.openvaultdb.com", href: "https://www.openvaultdb.com/", stored: "granted",
    cookies: [["_ga"], ["_ga", ".openvaultdb.com"], ["_ga_X1", "openvaultdb.com"], ["_ga_X1", ".www.openvaultdb.com"], ["other"]] });
  const a = create(e.win);
  a.start();
  e.opener.click();
  assert.ok(e.banner());
  assert.equal(e.banner().focused, true);
  e.banner().button("Reject").click();
  assert.deepEqual(calls(e.win).at(-1), ["consent", "update", { analytics_storage: "denied" }]);
  assert.equal(e.win["ga-disable-G-B2RWRSXVZE"], true);
  assert.deepEqual(e.jar.map((c) => c.name), ["other"]);
  assert.equal(e.opener.focused, true);
});

test("localhost and 127.0.0.1: banner shows, no tag even after Accept", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]", "app.localhost", "x.y.localhost"]) {
    const e = env({ host, href: `http://${host}/` });
    create(e.win).start();
    assert.ok(e.banner());
    e.banner().button("Accept analytics").click();
    assert.deepEqual(e.scripts(), []);
    assert.equal(e.win.dataLayer, undefined);
  }
});

test("storage unavailable: banner, no tag at load; Accept loads for this page only", () => {
  const e = env({ brokenStorage: true });
  const a = create(e.win);
  a.start();
  assert.ok(e.banner());
  assert.deepEqual(e.scripts(), []);
  a.decide("granted");
  assert.equal(e.scripts().length, 1);
  assert.equal(a.choice(), "granted");
  // a new page has no memory of it
  const e2 = env({ brokenStorage: true });
  create(e2.win).start();
  assert.deepEqual(e2.scripts(), []);
});

test("another tab's choice is followed through the storage event", () => {
  const e = env();
  create(e.win).start();
  e.store.set(KEY, "granted");
  e.listeners.storage({ key: KEY });
  assert.equal(e.banner(), null);
  assert.equal(e.scripts().length, 1);
  e.store.set(KEY, "denied");
  e.listeners.storage({ key: KEY });
  assert.equal(e.win["ga-disable-G-B2RWRSXVZE"], true);
  e.listeners.storage({ key: "unrelated" });
  e.store.delete(KEY);
  e.listeners.storage({ key: KEY });
  assert.ok(e.banner());
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? htmlFiles(p) : p.endsWith(".html") ? [p] : [];
  });
}

test("pages that load analytics.js offer Analytics choices and link the privacy page", () => {
  const pages = htmlFiles("public").filter((p) => readFileSync(p, "utf8").includes("/js/analytics.js"));
  assert.ok(pages.length >= 7);
  for (const p of pages) {
    const html = readFileSync(p, "utf8");
    assert.match(html, /data-analytics-choices/, p);
    assert.match(html, /href="\/privacy\/"/, p);
  }
});

test("no other Google Analytics tag or Firebase Analytics ships", () => {
  for (const p of [...htmlFiles("public"), "public/js/firebase-init.js", "public/js/analytics.js"]) {
    const t = readFileSync(p, "utf8");
    assert.doesNotMatch(t, /G-YT9ST7FZ4D|G-8ETBR31CW2|firebase-analytics/, p);
  }
});

test("privacy page states the analytics terms", () => {
  const t = readFileSync("public/privacy/index.html", "utf8");
  for (const s of ['id="analytics"', "Google Ireland Limited", "_ga_&lt;id&gt;", "two years", "14 months", "consent", "Analytics choices"]) {
    assert.ok(t.includes(s), s);
  }
});

test("connect query values never reach any gtag call", () => {
  const q = "?client_id=cid123&redirect_uri=https%3A%2F%2Fapp.example%2Fcb&state=st4te";
  const e = env({ href: `https://openvaultdb.com/connect/${q}#f`, referrer: `https://app.example/x${q}` });
  create(e.win).start();
  e.banner().button("Accept analytics").click();
  const all = JSON.stringify(calls(e.win));
  for (const v of ["cid123", "app.example%2Fcb", "st4te", "client_id", "state="]) assert.ok(!all.includes(v), v);
  assert.ok(calls(e.win).some((c) => c[0] === "set"));
});

test("choice cleared in another tab while GA runs here is treated as withdrawal", () => {
  const e = env({ stored: "granted", cookies: [["_ga"], ["_ga_Q"]] });
  create(e.win).start();
  e.store.delete(KEY);
  e.listeners.storage({ key: KEY });
  assert.deepEqual(calls(e.win).at(-1), ["consent", "update", { analytics_storage: "denied" }]);
  assert.equal(e.win["ga-disable-G-B2RWRSXVZE"], true);
  assert.deepEqual(e.jar, []);
  assert.ok(e.banner());
});

test("privacy page discloses Google Fonts and the Firebase SDK", () => {
  const t = readFileSync("public/privacy/index.html", "utf8");
  assert.match(t, /Google Fonts/);
  assert.match(t, /Firebase SDK/);
  assert.match(t, /apis\.google\.com/);
  assert.match(t, /IP address/);
});

test("banner is the first child of body; page-level listeners exist only while it is open", () => {
  const e = env();
  e.doc.body.appendChild(new El("main"));
  create(e.win).start();
  assert.equal(e.doc.body.children[0], e.banner());
  assert.deepEqual([...e.docListeners].sort(), ["focusin", "keydown", "pointerdown", "touchstart"]);
  e.banner().button("Reject").click();
  assert.equal(e.docListeners.size, 0);
});

test("a first-visit choice moves focus off body without scrolling (preventScroll)", () => {
  const e = env();
  const calls = [];
  e.opener.focus = (o) => calls.push(o);
  e.doc.querySelector = (sel) => (sel === "footer [data-analytics-choices]" ? e.opener : null);
  e.opener.hidden = false;
  create(e.win).start();
  e.banner().button("Reject").click();
  assert.deepEqual(calls, [{ preventScroll: true }]);
});
