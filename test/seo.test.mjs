import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

function jsonLd(html) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, "missing JSON-LD");
  return JSON.parse(match[1]);
}

test("homepage introduces OVDB in the title, description, hero, and structured data", () => {
  const html = read("public/index.html");
  assert.match(html, /<title>OVDB \(OpenVaultDB\) — User-owned application databases<\/title>/);
  assert.match(html, /name="description" content="OpenVaultDB \(OVDB\) is an open protocol for user-owned application databases/);
  assert.match(html, /rel="canonical" href="https:\/\/openvaultdb\.com\/"/);
  assert.match(html, /OpenVaultDB \(OVDB\) is an open protocol and platform/);
  assert.match(html, /property="og:image" content="https:\/\/openvaultdb\.com\/og\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /<h1[\s>]/);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.equal(html.includes("<h4"), false);
  assert.equal(html.includes("<h5"), false);

  const data = jsonLd(html);
  const byType = Object.fromEntries(data["@graph"].map((node) => [node["@type"], node]));
  assert.ok(byType.Organization.alternateName.includes("OVDB"));
  assert.equal(byType.WebSite.alternateName, "OVDB");
  assert.equal(byType.SoftwareApplication.name, "OVDB");
  assert.equal(byType.SoftwareApplication.alternateName, "OpenVaultDB");
  assert.ok(html.includes('href="https://github.com/openvaultdb/ovdb"'));
});

test("install and docs pages have their own OVDB titles, descriptions, and canonical URLs", () => {
  const install = read("public/install/index.html");
  assert.match(install, /<title>Install OVDB · OpenVaultDB<\/title>/);
  assert.match(install, /Install the OVDB CLI and set up OpenVaultDB/);
  assert.match(install, /rel="canonical" href="https:\/\/openvaultdb\.com\/install"/);
  assert.match(install, /<h1>Install OVDB<\/h1>/);
  assert.equal(jsonLd(install)["@type"], "WebPage");

  const docs = read("public/docs/index.html");
  assert.match(docs, /<title>OVDB Docs — OpenVaultDB<\/title>/);
  assert.match(docs, /Documentation for OVDB \(OpenVaultDB\)/);
  assert.match(docs, /rel="canonical" href="https:\/\/openvaultdb\.com\/docs"/);
  assert.match(docs, /<h2>Authentication Model<\/h2>/);
  assert.equal(jsonLd(docs).isPartOf.alternateName, "OVDB");

  const auth = read("public/docs/auth-model/index.html");
  assert.match(auth, /<title>Authentication Model — OpenVaultDB \(OVDB\)<\/title>/);
  assert.match(auth, /How OVDB users connect apps/);
  assert.match(auth, /rel="canonical" href="https:\/\/openvaultdb\.com\/docs\/auth-model"/);
  assert.match(auth, /OpenVaultDB \(OVDB\) only routes/);

  for (const name of ["install", "onboarding", "configure"]) {
    const page = read(`public/agent-instructions/${name}/index.html`);
    assert.match(page, /OVDB/, name);
    assert.match(page, new RegExp(`rel="canonical" href="https://openvaultdb\\.com/agent-instructions/${name}"`), name);
  }
});

test("sitemap lists indexable URLs and skips signed-in routes", () => {
  const sitemap = read("public/sitemap.xml");
  for (const url of [
    "https://openvaultdb.com/",
    "https://openvaultdb.com/install",
    "https://openvaultdb.com/docs",
    "https://openvaultdb.com/docs/auth-model",
    "https://openvaultdb.com/agent-instructions/install",
    "https://openvaultdb.com/agent-instructions/onboarding",
    "https://openvaultdb.com/agent-instructions/configure",
    "https://openvaultdb.com/privacy",
  ]) {
    assert.ok(sitemap.includes(`<loc>${url}</loc>`), url);
  }
  assert.equal(sitemap.includes("/my/"), false);
  assert.equal(sitemap.includes("/connect"), false);
  assert.equal(sitemap.includes("/docs/</loc>"), false);

  const robots = read("public/robots.txt");
  assert.match(robots, /User-agent: \*\nAllow: \/\n/);
  assert.match(robots, /Sitemap: https:\/\/openvaultdb\.com\/sitemap\.xml/);

  const image = join(root, "public/og.png");
  assert.equal(existsSync(image), true);
  assert.ok(statSync(image).size > 1000);
});
