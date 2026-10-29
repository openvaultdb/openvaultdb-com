import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const BASE = "https://openvaultdb.com";

function alternates(html) {
  return Object.fromEntries(
    [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]),
  );
}

test("Russian home and privacy pages declare ru, canonical, Open Graph locale and Russian text", () => {
  for (const [file, url] of [["public/ru/index.html", "/ru"], ["public/ru/privacy/index.html", "/ru/privacy"]]) {
    const html = read(file);
    assert.match(html, /<html lang="ru">/, file);
    assert.ok(html.includes(`<link rel="canonical" href="${BASE}${url}" />`), file);
    assert.ok(html.includes('<meta property="og:locale" content="ru_RU" />'), file);
    assert.ok(html.includes(`<meta property="og:url" content="${BASE}${url}" />`), file);
    assert.ok(html.includes(`${BASE}/og-ru.png`), file);
    assert.match(html, /[а-яё]{4,}/i, file);
  }
  assert.equal((read("public/ru/index.html").match(/<h1[\s>]/g) || []).length, 1);
});

test("hreflang annotations are reciprocal and x-default is English", () => {
  for (const [en, ru, enFile, ruFile] of [
    ["/", "/ru", "public/index.html", "public/ru/index.html"],
    ["/privacy", "/ru/privacy", "public/privacy/index.html", "public/ru/privacy/index.html"],
  ]) {
    const expected = { en: BASE + en, ru: BASE + ru, "x-default": BASE + en };
    assert.deepEqual(alternates(read(enFile)), expected, enFile);
    assert.deepEqual(alternates(read(ruFile)), expected, ruFile);
  }
});

test("language switch links point at each other", () => {
  assert.match(read("public/index.html"), /<a class="lang-switch" href="\/ru" hreflang="ru"/);
  assert.match(read("public/ru/index.html"), /<a class="lang-switch" href="\/" hreflang="en"/);
  assert.match(read("public/privacy/index.html"), /<a class="lang-switch" href="\/ru\/privacy" hreflang="ru"/);
  assert.match(read("public/ru/privacy/index.html"), /<a class="lang-switch" href="\/privacy" hreflang="en"/);
});

test("sitemap lists the Russian URLs with reciprocal alternates", () => {
  const sitemap = read("public/sitemap.xml");
  for (const url of [`${BASE}/ru`, `${BASE}/ru/privacy`]) {
    assert.ok(sitemap.includes(`<loc>${url}</loc>`), url);
  }
  assert.ok(sitemap.includes('hreflang="ru" href="https://openvaultdb.com/ru"'));
  assert.ok(sitemap.includes('hreflang="x-default" href="https://openvaultdb.com/"'));
  assert.equal(read("content/discovery/sitemap.xml"), sitemap);
});

test("the Russian home makes the same claims as the English one", () => {
  const en = read("public/index.html");
  const ru = read("public/ru/index.html");
  const ids = (html) => [...html.matchAll(/<section class="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids(ru), ids(en), "same section order");
  const count = (html, re) => (html.match(re) || []).length;
  for (const re of [/<article class="card">/g, /<li>/g, /<div class="eco">/g, /<a class="start-card"/g, /<div class="layer/g]) {
    assert.equal(count(ru, re), count(en, re), String(re));
  }
  // every external link on the English page is also on the Russian page
  const ext = (html) => new Set([...html.matchAll(/href="(https:\/\/[^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith(BASE)));
  for (const u of ext(en)) {
    if (u.includes("fonts.g")) continue;
    assert.ok(ext(ru).has(u), `missing on /ru: ${u}`);
  }
});

test("no page claims encryption: the MVP controls access with scoped, revocable tokens and grants", () => {
  for (const file of ["public/index.html", "public/ru/index.html"]) {
    const html = read(file);
    // only the explicit "does not encrypt" / "не шифруются" disclaimers may mention encryption
    assert.doesNotMatch(html, /(?<!not )encrypt|row-level|шифрован|шифрование/i, file);
  }
  const en = read("public/index.html");
  assert.match(en, /Scoped, revocable access/);
  assert.match(en, /the MVP does not encrypt vault data/);
  assert.match(read("public/ru/index.html"), /в MVP данные хранилища не шифруются/);
});

test("film slot ships disabled, with a per-locale id and local poster for en and ru", async () => {
  const src = read("public/js/video-config.js");
  const window = {};
  new Function("window", src)(window);
  const cfg = window.OVDB_VIDEO;
  assert.equal(cfg.enabled, false);
  for (const locale of ["en", "ru"]) {
    assert.equal(cfg.locales[locale].id, "", `${locale} id is filled in only when the film is published`);
    assert.match(cfg.locales[locale].poster, /^\/video\/[^/]+$/);
    assert.ok(cfg.locales[locale].width > 0 && cfg.locales[locale].height > 0);
    assert.ok(read(`public${cfg.locales[locale].poster}`).length > 0);
  }
  for (const file of ["public/index.html", "public/ru/index.html"]) {
    const html = read(file);
    assert.match(html, /<section class="film" data-video-slot hidden/, file);
    assert.doesNotMatch(html, /youtube|ytimg/i, `${file} must not reference YouTube before a click`);
  }
  assert.match(read("public/js/video-embed.js"), /www\.youtube-nocookie\.com\/embed\//);
  assert.doesNotMatch(read("public/js/video-embed.js"), /https:\/\/www\.youtube\.com/);
});

test("DataTug is stated as working with OpenVaultDB, in both languages", () => {
  assert.match(read("public/index.html"), /DataTug works with OpenVaultDB\./);
  assert.match(read("public/ru/index.html"), /DataTug работает с OpenVaultDB\./);
  for (const file of ["public/index.html", "public/ru/index.html"]) {
    assert.doesNotMatch(read(file), /under development|находится в разработке/, file);
  }
});
