import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildOutputs,
  canonicalSkill,
  canonicalSkillSHA256,
  escapeHTML,
  instructionOrder,
  readInstructions,
  shortPrompt,
} from "../scripts/build-agent-instructions.mjs";

const root = join(fileURLToPath(new URL("..", import.meta.url)));

test("generated static routes match the canonical instruction sources", () => {
  const outputs = buildOutputs();
  assert.deepEqual(
    [...outputs.keys()],
    [
      "agent-instructions/install/index.html",
      "agent-instructions/onboarding/index.html",
      "agent-instructions/configure/index.html",
      "install/index.html",
      "index.html",
      "agent-skills/openvaultdb/SKILL.md",
      "install.ps1",
      "install-skill.sh",
      "install-skill.ps1",
      "robots.txt",
      "sitemap.xml",
      "llms.txt",
    ],
  );
  for (const [path, expected] of outputs) {
    assert.equal(readFileSync(join(root, "public", path), "utf8"), expected, path);
  }
});

test("install page copies the short prompt and every canonical instruction", () => {
  const installPage = buildOutputs().get("install/index.html");
  assert.match(installPage, new RegExp(escapeHTML(shortPrompt).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const instructions = readInstructions();
  for (const name of instructionOrder) {
    assert.ok(installPage.includes(escapeHTML(instructions[name])), `missing ${name} source`);
  }
  assert.ok(installPage.includes('href="/agent-instructions/install"'));
});

test("homepage shows the AI prompt and canonical direct installers", () => {
  const homepage = buildOutputs().get("index.html");
  assert.ok(homepage.includes(`<code id="home-short-prompt">${escapeHTML(shortPrompt)}</code>`));
  assert.ok(homepage.includes('data-copy-target="home-short-prompt"'));
  assert.ok(homepage.includes('<code id="home-unix-install">(p=$(mktemp) &amp;&amp; trap \'rm -f "$p"\' EXIT &amp;&amp; curl -fsSL https://openvaultdb.com/install.sh -o "$p" &amp;&amp; sh "$p")</code>'));
  assert.ok(homepage.includes('<code id="home-windows-install">$p=Join-Path $env:TEMP ("ovdb-"+[guid]::NewGuid()+".ps1"); try { irm https://openvaultdb.com/install.ps1 -OutFile $p -EA Stop; &amp; $p } finally { Remove-Item $p -EA SilentlyContinue }</code>'));
  assert.match(homepage, /These shortcuts trust the installer served by/);
  assert.match(homepage, /Homebrew through the guided install/);
  assert.ok(homepage.includes('data-copy-target="home-unix-install"'));
  assert.ok(homepage.includes('data-copy-target="home-windows-install"'));
  assert.ok(homepage.includes('href="/install"'));
  assert.ok(homepage.includes('src="/js/copy-text.js"'));
  assert.match(homepage, /Install OpenVaultDB/);
});

test("standalone skill artifacts come from the canonical public source", () => {
  const outputs = buildOutputs();
  assert.equal(outputs.get("agent-skills/openvaultdb/SKILL.md"), canonicalSkill);
  const installer = outputs.get("install-skill.sh");
  assert.ok(installer.includes("https://openvaultdb.com/agent-skills/openvaultdb/SKILL.md"));
  assert.ok(installer.includes(canonicalSkillSHA256()));
  assert.doesNotMatch(installer, /__SKILL_SHA256__/);
});

test("instruction journey names its gates, stops and verifications", () => {
  const instructions = readInstructions();
  assert.match(instructions.install, /ovdb version/);
  assert.match(instructions.install, /https:\/\/openvaultdb\.com\/install\.sh/);
  assert.match(instructions.install, /https:\/\/openvaultdb\.com\/install\.ps1/);
  assert.match(instructions.install, /https:\/\/openvaultdb\.com\/install-skill\.ps1/);
  assert.match(instructions.install, /Get-Command ovdb -ErrorAction SilentlyContinue/);
  assert.match(instructions.install, /Homebrew is unavailable.*Windows/s);
  assert.match(instructions.install, /Do not change the persistent user or machine `PATH`/);
  assert.match(instructions.install, /does not need Go/);
  assert.match(instructions.install, /1\. Install or update the CLI with Homebrew/);
  assert.match(instructions.install, /2\. Install or update the CLI with the checksum-verified direct script/);
  assert.match(instructions.install, /3\. Install or update the official skill only/);
  assert.match(instructions.install, /4\. Abort setup/);
  assert.match(instructions.install, /install-skill\.sh.*--harness HARNESS/s);
  assert.match(instructions.install, /--replace-changed/);
  assert.match(instructions.install, /-ReplaceChanged/);
  assert.match(instructions.install, /rm "\$HOME\/\.cache\/openvaultdb\/install-skill\.sh"/);
  assert.match(instructions.install, /root `\.skills\[\]` array.*selected item's `\.targets\[\]` array/s);
  assert.match(instructions.install, /CLI-dependent setup remains unavailable/);
  assert.match(instructions.install, /ovdb --help/);
  assert.match(instructions.install, /predates AI onboarding/);
  assert.match(instructions.install, /ovdb skills list --json/);
  assert.match(instructions.install, /already up to date/);
  assert.match(instructions.install, /ovdb skills install openvaultdb --harness HARNESS --yes --json/);
  assert.match(instructions.onboarding, /ovdb server status --json/);
  assert.match(instructions.onboarding, /ovdb demo install --yes --json/);
  assert.match(instructions.onboarding, /ovdb databases create NAME --engine ingitdb --json/);
  assert.match(instructions.onboarding, /\.server\.state/);
  assert.match(instructions.onboarding, /root `\.databases\[\]` array.*selected item's `\.state`/s);
  assert.match(instructions.onboarding, /ovdb add \/lists\/to-buy\/items/);
  assert.match(instructions.onboarding, /ovdb get KEY --db todo --json/);
  assert.match(instructions.onboarding, /ovdb set \/welcome\/status/);
  assert.match(instructions.onboarding, /\.data\.message/);
  assert.match(instructions.onboarding, /operation not permitted/);
  assert.match(instructions.onboarding, /no web console or TODO app/);
  assert.match(instructions.configure, /ovdb server restart --json/);
  assert.match(instructions.configure, /\.config\.server\.port/);
  for (const name of instructionOrder) {
    assert.doesNotMatch(instructions[name], /OVDB_PREVIEW/);
    assert.match(instructions[name], /stop/i, `${name} must define stop behavior`);
    assert.match(instructions[name], /successful/i, `${name} must define success`);
  }
});

test("generated pages link every cold static route in the journey", () => {
  const outputs = buildOutputs();
  const all = [...outputs.values()].join("\n");
  for (const route of [
    "/install",
    "/agent-instructions/install",
    "/agent-instructions/onboarding",
    "/agent-instructions/configure",
  ]) {
    assert.ok(all.includes(`href="${route}"`), `missing link to ${route}`);
  }
});

test("crawler discovery points to the canonical AI install journey", () => {
  const sitemap = readFileSync(join(root, "public", "sitemap.xml"), "utf8");
  const robots = readFileSync(join(root, "public", "robots.txt"), "utf8");
  const llms = readFileSync(join(root, "public", "llms.txt"), "utf8");

  assert.match(sitemap, /https:\/\/openvaultdb\.com\/install/);
  assert.match(sitemap, /https:\/\/openvaultdb\.com\/agent-instructions\/install/);
  assert.match(sitemap, /https:\/\/openvaultdb\.com\/agent-instructions\/onboarding/);
  assert.match(sitemap, /https:\/\/openvaultdb\.com\/agent-instructions\/configure/);
  assert.match(robots, /User-agent: \*\nAllow: \/\n/);
  assert.match(robots, /Sitemap: https:\/\/openvaultdb\.com\/sitemap\.xml/);
  assert.match(llms, /Canonical AI install instructions/);
  assert.match(llms, /https:\/\/openvaultdb\.com\/install\.sh/);
  assert.match(llms, /https:\/\/openvaultdb\.com\/install\.ps1/);
});
