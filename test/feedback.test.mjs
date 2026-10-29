import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addFeedback, buildOutputs} from '../scripts/build-agent-instructions.mjs';
const publicDir = new URL('../public/', import.meta.url);

test('all generated and static public pages have one exact product feedback widget', () => {
  const outputs = buildOutputs();
  for (const path of ['docs/index.html', 'docs/auth-model/index.html', 'privacy/index.html']) outputs.set(path, readFileSync(new URL(path, publicDir), 'utf8'));
  for (const [path, html] of outputs) {
    if (!path.endsWith('.html')) continue;
    assert.equal(addFeedback(html), html, path);
    assert.equal((html.match(/https:\/\/improveit.now\/widget.js/g) ?? []).length, 1, path);
    assert.match(html, /data-space="ao58m" data-app="0e96104c8a9188fbdae1ea49369ece23"/);
    assert.match(html, /data-launcher="hidden"/);
    assert.doesNotMatch(html, /data-screen|data-url|data-path/);
  }
});

test('private documents expose only a local opt-in launcher with a fixed screen', () => {
  const screens = new Map([
    ['connect/index.html', 'ovdb-connect'], ['my/index.html', 'ovdb-account'],
    ['my/apps/index.html', 'ovdb-apps'], ['my/vaults/index.html', 'ovdb-vaults'],
  ]);
  for (const [path, screen] of screens) {
    const html = readFileSync(new URL(path, publicDir), 'utf8');
    assert.match(html, /data-private-feedback aria-haspopup="dialog" hidden/);
    assert.ok(html.includes(`data-feedback-screen="${screen}"`), path);
    assert.match(html, /type="module" src="\/js\/private-feedback.js"/);
    assert.doesNotMatch(html, /improveit.now|src="[^" ]*feedback.js"[^>]*data-app|rel="(?:preconnect|prefetch)"[^>]*improveit/);
  }
});
