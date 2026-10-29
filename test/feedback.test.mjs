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

test('private account and connect pages do not load feedback scripts', () => {
  for (const path of ['connect/index.html', 'my/index.html', 'my/apps/index.html', 'my/vaults/index.html']) {
    assert.doesNotMatch(readFileSync(new URL(path, publicDir), 'utf8'), /improveit.now|feedback.js/);
  }
});
