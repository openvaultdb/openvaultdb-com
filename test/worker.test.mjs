import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import worker, { CACHE_CONTROL, NO_STORE, SECURITY_HEADERS } from "../worker/index.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

function assetsReturning(response, onRequest = () => {}) {
  return {
    ASSETS: {
      async fetch(request) {
        onRequest(request);
        return response;
      },
    },
  };
}

test("worker routes the original request through ASSETS and controls response headers", async () => {
  const request = new Request("https://openvaultdb.com/install?source=test", { method: "GET" });
  let received;
  const response = await worker.fetch(
    request,
    assetsReturning(
      new Response("install page", {
        status: 200,
        headers: {
          "Cache-Control": "private",
          "Content-Type": "text/html; charset=utf-8",
          ETag: '"asset-digest"',
        },
      }),
      (value) => {
        received = value;
      },
    ),
  );

  assert.equal(received, request);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "install page");
  assert.equal(response.headers.get("Content-Type"), "text/html; charset=utf-8");
  assert.equal(response.headers.get("ETag"), '"asset-digest"');
  assert.equal(response.headers.get("Cache-Control"), CACHE_CONTROL);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    assert.equal(response.headers.get(name), value);
  }
});

test("worker prevents caching error and non-read responses", async () => {
  for (const [method, status] of [
    ["GET", 404],
    ["POST", 405],
  ]) {
    const response = await worker.fetch(
      new Request("https://openvaultdb.com/missing", { method }),
      assetsReturning(new Response("not served", { status })),
    );
    assert.equal(response.status, status);
    assert.equal(response.headers.get("Cache-Control"), NO_STORE);
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  }
});

test("Wrangler config preserves clean static routes through a worker-first ASSETS binding", () => {
  const config = JSON.parse(readFileSync(join(root, "wrangler.jsonc"), "utf8"));
  assert.equal(config.name, "openvaultdb-com");
  assert.equal(config.main, "worker/index.mjs");
  assert.equal(config.compatibility_date, "2026-09-19");
  assert.deepEqual(config.routes, [{ pattern: "openvaultdb.com", custom_domain: true }]);
  assert.deepEqual(config.assets, {
    directory: "./public",
    binding: "ASSETS",
    run_worker_first: true,
    html_handling: "drop-trailing-slash",
    not_found_handling: "none",
  });

  for (const path of [
    "index.html",
    "install/index.html",
    "install.sh",
    "install-skill.sh",
    "agent-instructions/install/index.html",
    "agent-instructions/onboarding/index.html",
    "agent-instructions/configure/index.html",
    "agent-skills/openvaultdb/SKILL.md",
    "docs/index.html",
    "connect/index.html",
    "my/index.html",
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

test("local Worker preview example assigns its configurable port", () => {
  const deployGuide = readFileSync(join(root, "DEPLOY.md"), "utf8");
  assert.match(deployGuide, /PORT=\d+\nnpx wrangler dev --local --port "\$PORT"/);
  assert.match(deployGuide, /example port may already be in use/i);
});
