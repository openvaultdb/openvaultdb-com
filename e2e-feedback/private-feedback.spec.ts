import { test, expect, type Page } from '@playwright/test';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
type TestWindow = Window & { __feedbackRoot?: ShadowRoot; __feedbackMessages: {theme?: string}[]; ImproveIt?: object };
const ORIGIN = 'https://openvaultdb.com', APP = '0e96104c8a9188fbdae1ea49369ece23';
const CANARY = 'PRIVATE_URL_TOKEN_CALLBACK_VAULT_ACCOUNT_FORM_7261';
const PUBLIC = path.resolve(__dirname, '../public');
const SDK = readFileSync(path.resolve(__dirname, '../test/fixtures/improveit-widget.js'), 'utf8');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const button = (page: Page) => page.locator('[data-private-feedback]');
type Hit = { url: string; method: string; headers: Record<string, string>; body: string | null };
function allowed(hit: Hit, screen: string) {
  const url = new URL(hit.url);
  expect(hit.method).toBe('GET'); expect(url.origin).toBe('https://improveit.now');
  expect(hit.headers['referer'], url.pathname + ' referrer').toBeUndefined(); expect(hit.body).toBeNull();
  expect(JSON.stringify(hit)).not.toContain(CANARY);
  if (url.pathname === '/widget.js') expect(url.search).toBe('');
  else {
    expect(url.pathname).toBe('/widget'); expect(url.hash).toBe('');
    expect(Object.fromEntries(url.searchParams)).toEqual({ app: APP, space: 'ao58m', screen, theme: 'light' });
  }
}
async function boot(page: Page, options: { failFirst?: boolean; hold?: Promise<void>; foreign?: boolean; origin?: string; holdRedirect?: boolean } = {}) {
  const hits: Hit[] = []; let loads = 0;
  await page.addInitScript(({ foreign }) => {
    const win = window as unknown as TestWindow, original = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) {
      const root = original.call(this, options); if (this.hasAttribute('data-improveit-host')) win.__feedbackRoot = root; return root;
    };
    win.__feedbackMessages = [];
    window.addEventListener('message', e => {
      if (e.origin === 'https://improveit.now' && e.data?.type === 'fixture:received') win.__feedbackMessages.push(e.data.value);
    });
    if (foreign) win.ImproveIt = Object.freeze({ open() { throw new Error('foreign API called'); } });
  }, { foreign: options.foreign });
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === 'https://improveit.now') {
      hits.push({ url: request.url(), method: request.method(), headers: await request.allHeaders(), body: request.postData() });
      if (url.pathname === '/widget.js') {
        loads++; if (options.failFirst && loads === 1) return route.abort(); if (options.hold) await options.hold;
        return route.fulfill({ contentType: 'text/javascript', body: SDK });
      }
      if (url.pathname === '/widget') return route.fulfill({ contentType: 'text/html', body: `<html><body>Local transport fixture<script>addEventListener('message',e=>parent.postMessage({type:'fixture:received',value:e.data},'${ORIGIN}'));parent.postMessage({type:'improveit:ready'},'${ORIGIN}');</script></body></html>` });
      return route.abort();
    }
    if (url.origin !== (options.origin ?? ORIGIN)) return route.abort();
    let file = path.join(PUBLIC, url.pathname);
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    let body: string | Buffer = readFileSync(file);
    // Test only: pause the initial redirect so its own local module can execute.
    if (options.holdRedirect && url.pathname.startsWith('/my/')) body = body.toString().replace(/<meta http-equiv="refresh"[^>]*>/, '').replace('location.replace("/my/vaults");', '');
    return route.fulfill({ contentType: TYPES[path.extname(file)] || 'application/octet-stream', body });
  });
  return { hits, loads: () => loads };
}
async function idle(page: Page) {
  await expect(button(page)).toBeVisible();
  await expect(page.locator('script[src^="https://improveit.now"],iframe[src^="https://improveit.now"],link[href^="https://improveit.now"]')).toHaveCount(0);
}
async function open(page: Page) {
  await button(page).click();
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as TestWindow).__feedbackRoot?.querySelector('dialog')?.open))).toBe(true);
}
async function settle(page: Page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function saveScreenshot(page: Page, name: string) {
  const directory = process.env['WIDGET_ARTIFACT_DIR'];
  if (!directory) return;
  mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, name) });
}
async function assertContrast(page: Page) {
  const ratio = await button(page).evaluate(el => {
    const style = getComputedStyle(el);
    const luminance = (color: string) => (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
      .map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; })
      .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const foreground = luminance(style.color), background = luminance(style.backgroundColor);
    return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
}
test('oracle rejects POSTs, unknown URLs, private query fields, wrong origins and referrers', () => {
  const base = { url: 'https://improveit.now/widget.js', method: 'GET', headers: {}, body: null };
  allowed(base, 'ovdb-apps');
  for (const bad of [{ ...base, method: 'POST' }, { ...base, url: 'https://improveit.now/unknown' },
    { ...base, url: `https://improveit.now/widget.js?token=${CANARY}` }, { ...base, url: 'https://unexpected.example/widget.js' },
    { ...base, headers: { referer: `${ORIGIN}/connect?token=${CANARY}` } }, { ...base, body: CANARY }]) {
    expect(() => allowed(bad, 'ovdb-apps')).toThrow();
  }
  expect(createHash('sha256').update(SDK).digest('hex')).toBe('a0d1d885b2ac5dd95a323471f9caa9e14ad97388dbad70c6986ce0e230bb0e33');
});
for (const [documentPath, screen] of [['/my/apps/', 'ovdb-apps'], ['/my/vaults/', 'ovdb-vaults'], ['/connect/', 'ovdb-connect']]) {
  test(`${documentPath} click lazy launcher sends no private context`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: 'dark' }); const network = await boot(page);
    await page.goto(`${ORIGIN}${documentPath}?token=${CANARY}&callback=${CANARY}#${CANARY}`);
    await page.evaluate(value => {
      document.title = value;
      const input = document.createElement('input'); input.id = 'private-canary'; input.value = value;
      const privateDom = document.createElement('p'); privateDom.textContent = value;
      privateDom.style.overflowWrap = 'anywhere';
      (document.querySelector('main') ?? document.body).append(input, privateDom);
    }, CANARY);
    await page.locator('#private-canary').fill(`${CANARY}_TYPED`);
    await idle(page); await assertContrast(page); await button(page).focus(); await page.keyboard.press('Tab'); await settle(page);
    expect(network.hits).toEqual([]);
    await page.evaluate(() => history.pushState({}, '', `?other=${(document.querySelector('#private-canary') as HTMLInputElement).value}#still-private`));
    await idle(page); expect(network.hits).toEqual([]);
    await button(page).focus(); await page.keyboard.press('Enter');
    await expect.poll(() => network.hits.length).toBe(2);
    await expect.poll(() => page.evaluate(() => (window as unknown as TestWindow).__feedbackMessages.length)).toBeGreaterThan(0);
    for (const hit of network.hits) allowed(hit, screen);
    expect(await page.evaluate(() => JSON.stringify((window as unknown as TestWindow).__feedbackMessages))).not.toContain(CANARY);
    expect(await page.evaluate(() => document.querySelectorAll('[data-improveit-host]').length)).toBe(1);
    await page.keyboard.press('Escape'); await expect(button(page)).toBeFocused();
    await open(page); expect(network.loads()).toBe(1); await page.keyboard.press('Escape');
    const consent = page.getByRole('region', { name: 'Analytics choice' });
    if (await consent.count()) await consent.getByRole('button', { name: 'Reject', exact: true }).click();
    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await page.keyboard.press('Tab');
    await button(page).focus();
    const result = await button(page).evaluate(el => {
      const box = el.getBoundingClientRect(), style = getComputedStyle(el);
      return { x: box.x, bottom: box.bottom, height: box.height, viewport: innerHeight, outline: style.outlineStyle,
        hit: document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === el };
    });
    expect(result.x).toBeGreaterThanOrEqual(0); expect(result.height).toBeGreaterThanOrEqual(48);
    expect(result.bottom).toBeLessThanOrEqual(result.viewport); expect(result.hit).toBe(true); expect(result.outline).toBe('solid');
    for (const link of await page.locator('.site-footer a').all()) {
      await link.scrollIntoViewIfNeeded();
      expect(await link.evaluate(el => {
        const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return hit === el || el.contains(hit);
      })).toBe(true);
    }
    await saveScreenshot(page, `${screen}-${testInfo.project.name}.png`);
  });
}
test('/my preserves redirect and exposes the destination launcher', async ({ page }) => {
  const network = await boot(page); await page.goto(`${ORIGIN}/my/?token=${CANARY}#${CANARY}`);
  await expect(page).toHaveURL(`${ORIGIN}/my/vaults`); await idle(page); expect(network.hits).toEqual([]);
  const html = readFileSync(path.join(PUBLIC, 'my/index.html'), 'utf8');
  expect(html).toContain('data-feedback-screen="ovdb-account"'); expect(html).toContain('location.replace("/my/vaults")');
});
test('failed download retries only after another explicit click', async ({ page }) => {
  const network = await boot(page, { failFirst: true }); await page.goto(`${ORIGIN}/my/apps/`); await idle(page);
  await button(page).click(); await expect(button(page)).toHaveText('Feedback unavailable · Retry');
  await page.evaluate(() => { history.pushState({}, '', '?private=retry'); dispatchEvent(new Event('popstate')); });
  await button(page).focus(); await settle(page); expect(network.loads()).toBe(1);
  await open(page); expect(network.loads()).toBe(2); for (const hit of network.hits) allowed(hit, 'ovdb-apps');
});
test('auth interruption cancels a pending open and later reuses one owned SDK', async ({ page }) => {
  let release!: () => void; const hold = new Promise<void>(resolve => { release = resolve; });
  const network = await boot(page, { hold }); await page.goto(`${ORIGIN}/connect/`); await button(page).click();
  await expect.poll(network.loads).toBe(1);
  await page.evaluate(() => document.documentElement.setAttribute('data-auth-modal-open', ''));
  await expect(button(page)).toBeHidden(); release();
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as TestWindow).ImproveIt))).toBe(true);
  expect(network.hits).toHaveLength(1); await expect(page.locator('[data-improveit-host]')).toHaveCount(0);
  await page.evaluate(() => document.documentElement.removeAttribute('data-auth-modal-open'));
  await open(page); expect(network.loads()).toBe(1); for (const hit of network.hits) allowed(hit, 'ovdb-connect');
});
test('foreign SDK global is never replaced, called or granted a frame', async ({ page }) => {
  const network = await boot(page, { foreign: true }); await page.goto(`${ORIGIN}/my/apps/`); await button(page).click();
  await expect(button(page)).toBeHidden(); expect(network.hits).toEqual([]);
  expect(await page.evaluate(() => Object.isFrozen((window as unknown as TestWindow).ImproveIt))).toBe(true);
});
test('/my initial document opt-in executes when its redirect is intercepted', async ({ page }) => {
  const network = await boot(page, { holdRedirect: true }); await page.goto(`${ORIGIN}/my/?token=${CANARY}#${CANARY}`);
  await idle(page); expect(network.hits).toEqual([]); await open(page); await expect.poll(() => network.hits.length).toBe(2);
  for (const hit of network.hits) allowed(hit, 'ovdb-account');
});
test('unregistered preview origin fails closed before SDK activation', async ({ page }) => {
  const network = await boot(page, { origin: 'https://unregistered.example' });
  await page.goto('https://unregistered.example/my/apps/'); await expect(button(page)).toBeHidden(); expect(network.hits).toEqual([]);
});
