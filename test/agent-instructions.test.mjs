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
      "install-skill.sh",
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
});

test("homepage shows the exact short prompt with copy and install actions", () => {
  const homepage = buildOutputs().get("index.html");
  assert.ok(homepage.includes(`<code id="home-short-prompt">${escapeHTML(shortPrompt)}</code>`));
  assert.ok(homepage.includes('data-copy-target="home-short-prompt"'));
  assert.ok(homepage.includes('href="/install"'));
  assert.ok(homepage.includes('src="/js/copy-text.js"'));
  assert.match(homepage, /AI onboarding preview/);
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
  assert.match(instructions.install, /does not need Go/);
  assert.match(instructions.install, /1\. Install or update the CLI with Homebrew/);
  assert.match(instructions.install, /2\. Install or update the CLI with the checksum-verified direct script/);
  assert.match(instructions.install, /3\. Install or update the official skill only/);
  assert.match(instructions.install, /4\. Abort setup/);
  assert.match(instructions.install, /install-skill\.sh.*--harness HARNESS/s);
  assert.match(instructions.install, /--replace-changed/);
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
