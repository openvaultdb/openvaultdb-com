import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("security and cache headers are static _headers rules", () => {
  const headers = readFileSync(join(root, "public/_headers"), "utf8");
  for (const line of [
    "Cache-Control: public, max-age=0, must-revalidate",
    "Permissions-Policy: camera=(), geolocation=(), microphone=()",
    "Referrer-Policy: strict-origin-when-cross-origin",
    "Strict-Transport-Security: max-age=31536000",
    "X-Content-Type-Options: nosniff",
    "X-Frame-Options: DENY",
  ]) {
    assert.match(headers, new RegExp(`^  ${line.replace(/[()]/g, "\\$&")}$`, "m"));
  }
  assert.match(headers, /^\/\*$/m);
});

test("Wrangler config is assets-only (no Worker script) and keeps clean static routes", () => {
  const config = JSON.parse(readFileSync(join(root, "wrangler.jsonc"), "utf8"));
  assert.equal(config.name, "openvaultdb-com");
  assert.equal(config.main, undefined);
  assert.equal(existsSync(join(root, "worker")), false);
  assert.equal(config.compatibility_date, "2026-09-19");
  assert.deepEqual(config.routes, [{ pattern: "openvaultdb.com", custom_domain: true }]);
  assert.deepEqual(config.assets, {
    directory: "./public",
    html_handling: "drop-trailing-slash",
    not_found_handling: "404-page",
  });

  for (const path of [
    "index.html",
    "ru/index.html",
    "ru/privacy/index.html",
    "og-ru.png",
    "video/poster-en.svg",
    "video/poster-ru.svg",
    "js/video-config.js",
    "js/video-embed.js",
    "install/index.html",
    "install.sh",
    "install.ps1",
    "install-skill.sh",
    "install-skill.ps1",
    "robots.txt",
    "sitemap.xml",
    "llms.txt",
    "og.png",
    "logo.png",
    "agent-instructions/install/index.html",
    "agent-instructions/onboarding/index.html",
    "agent-instructions/configure/index.html",
    "agent-skills/openvaultdb/SKILL.md",
    "docs/index.html",
    "connect/index.html",
    "my/index.html",
    "privacy/index.html",
  ]) {
    assert.equal(existsSync(join(root, "public", path)), true, `missing public/${path}`);
  }
});

test("Firebase deploys rules only while client services and local emulation remain", () => {
  const workflow = readFileSync(
    join(root, ".github/workflows/firebase-deploy.yml"),
    "utf8",
  );
  assert.match(workflow, /deploy --only firestore:rules/);
  assert.doesNotMatch(workflow, /action-hosting-deploy/);
  assert.doesNotMatch(workflow, /deploy --only [^\n]*hosting/);

  const firebase = JSON.parse(readFileSync(join(root, "firebase.json"), "utf8"));
  assert.equal(firebase.hosting.public, "public");
  assert.equal(firebase.hosting.cleanUrls, true);
  assert.equal(firebase.hosting.trailingSlash, false);
  assert.equal(firebase.firestore.rules, "firestore.rules");
  assert.ok(firebase.emulators.hosting);

  const client = readFileSync(join(root, "public/js/firebase-init.js"), "utf8");
  assert.match(client, /firebase-auth\.js/);
  assert.match(client, /firebase-firestore\.js/);
});

test("website verification covers every public asset change", () => {
  const workflow = readFileSync(
    join(root, ".github/workflows/verify-agent-instructions.yml"),
    "utf8",
  );
  assert.equal(workflow.match(/- "public\/\*\*"/g)?.length, 2);
});

test("local preview example assigns its configurable port", () => {
  const deployGuide = readFileSync(join(root, "DEPLOY.md"), "utf8");
  assert.match(deployGuide, /PORT=\d+\nnpx wrangler dev --local --port "\$PORT"/);
  assert.match(deployGuide, /example port may already be in use/i);
});
