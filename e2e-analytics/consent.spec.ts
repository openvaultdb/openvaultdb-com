import { test, expect, type Locator, type Page } from "@playwright/test";
import { existsSync, readFileSync, statSync } from "fs";
import path from "path";

const ORIGIN = "https://openvaultdb.test";
const PUBLIC = path.resolve(__dirname, "..", "public");
const GOOGLE = /googletagmanager\.com|google-analytics\.com|analytics\.google\.com/;
const TYPES: Record<string, string> = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml",
};

// Serves ./public at ORIGIN, stubs gtag.js, blocks everything else, and records
// every request URL the page makes.
async function boot(page: Page): Promise<string[]> {
  const seen: string[] = [];
  page.on("request", (r) => seen.push(r.url()));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "www.googletagmanager.com" && url.pathname === "/gtag/js") {
      return route.fulfill({ contentType: "text/javascript", body: "/* stub gtag.js */" });
    }
    if (url.origin !== ORIGIN) return route.abort();
    let file = path.join(PUBLIC, url.pathname);
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!existsSync(file)) return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "text/plain", body: readFileSync(file) });
  });
  return seen;
}

const googleHits = (seen: string[]) => seen.filter((u) => GOOGLE.test(u));
const banner = (page: Page) => page.getByRole("region", { name: "Analytics choice" });

test("no Google request and no _ga cookie before consent; banner is shown", async ({ page }) => {
  const seen = await boot(page);
  await page.goto(`${ORIGIN}/`);
  await expect(banner(page)).toBeVisible();
  await page.waitForTimeout(500);
  expect(googleHits(seen)).toEqual([]);
  expect(await page.evaluate(() => document.cookie)).not.toContain("_ga");
});

test("Reject: no Google request now or after reload, choice persists", async ({ page }) => {
  const seen = await boot(page);
  await page.goto(`${ORIGIN}/`);
  await banner(page).getByRole("button", { name: "Reject" }).click();
  await expect(banner(page)).toHaveCount(0);
  await page.reload();
  await expect(banner(page)).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(googleHits(seen)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("openvaultdb.analytics-consent.v1"))).toBe("denied");
});

test("Accept: gtag.js for G-B2RWRSXVZE requested once; withdrawal removes _ga cookies", async ({ page }) => {
  const seen = await boot(page);
  await page.goto(`${ORIGIN}/`);
  await banner(page).getByRole("button", { name: "Accept analytics" }).click();
  await expect.poll(() => googleHits(seen)).toEqual(["https://www.googletagmanager.com/gtag/js?id=G-B2RWRSXVZE"]);
  const cfg = await page.evaluate(() =>
    (window as any).dataLayer.map((a: any) => Array.from(a)).find((a: any[]) => a[0] === "config"));
  expect(cfg).toEqual(["config", "G-B2RWRSXVZE", {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: `${ORIGIN}/`,
  }]);

  // The stub sets no cookies, so plant the ones gtag.js would set.
  await page.evaluate(() => {
    document.cookie = "_ga=GA1.1.1.1; path=/";
    document.cookie = "_ga_B2RWRSXVZE=GS2.1.x; path=/";
    document.cookie = "keep=1; path=/";
  });
  await page.getByRole("button", { name: "Analytics choices" }).click();
  await banner(page).getByRole("button", { name: "Reject" }).click();
  const cookies = await page.evaluate(() => document.cookie);
  expect(cookies).not.toContain("_ga");
  expect(cookies).toContain("keep=1");
});

test("a granted choice loads the tag on the next page; query and fragment are scrubbed", async ({ page }) => {
  const seen = await boot(page);
  await page.goto(`${ORIGIN}/`);
  await banner(page).getByRole("button", { name: "Accept analytics" }).click();
  await page.goto(`${ORIGIN}/docs/?secret=1#frag`);
  await expect.poll(() => googleHits(seen).length).toBe(2);
  const loc = await page.evaluate(() =>
    (window as any).dataLayer.map((a: any) => Array.from(a)).find((a: any[]) => a[0] === "config")[2].page_location);
  expect(loc).toBe(`${ORIGIN}/docs/`);
});

test("banner is keyboard reachable and fits 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await boot(page);
  await page.goto(`${ORIGIN}/privacy/`);
  await expect(banner(page)).toBeVisible();
  const box = (await banner(page).boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  let reached = "";
  for (let i = 0; i < 60 && reached !== "Accept analytics"; i++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => document.activeElement?.textContent?.trim() || "");
  }
  expect(reached).toBe("Accept analytics");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe("Reject");
  await page.keyboard.press("Enter");
  await expect(banner(page)).toHaveCount(0);
});

test("privacy link lands on the analytics section", async ({ page }) => {
  await boot(page);
  await page.goto(`${ORIGIN}/`);
  await banner(page).getByRole("link", { name: "Privacy notice" }).click();
  await expect(page).toHaveURL(`${ORIGIN}/privacy/#analytics`);
  await expect(page.locator("#analytics")).toBeVisible();
});

test("connect query values never reach Google", async ({ page }) => {
  const seen = await boot(page);
  const q = "?client_id=cid123&redirect_uri=https%3A%2F%2Fapp.example%2Fcb&state=st4te";
  await page.goto(`${ORIGIN}/connect/${q}`);
  await banner(page).getByRole("button", { name: "Accept analytics" }).click();
  await expect.poll(() => googleHits(seen).length).toBe(1);
  const layer = await page.evaluate(() => JSON.stringify((window as any).dataLayer.map((a: any) => Array.from(a))));
  for (const v of ["cid123", "st4te", "app.example"]) {
    expect(layer).not.toContain(v);
    expect(googleHits(seen).join()).not.toContain(v);
  }
});

test("privacy page mentions Google Fonts and the Firebase SDK", async ({ page }) => {
  await boot(page);
  await page.goto(`${ORIGIN}/privacy/`);
  const text = await page.locator("main").innerText();
  expect(text).toContain("Google Fonts");
  expect(text).toContain("Firebase SDK");
  expect(text).toContain("apis.google.com");
});

// ---- Banner layout, reservation and focus (contract 4b) ----
const VIEWPORTS: [number, number][] = [[320, 568], [375, 667], [390, 844], [1280, 800], [1366, 768]];
const PAGES = ["/", "/docs/", "/connect/", "/privacy/"];

const atCentre = (loc: Locator) => loc.evaluate((el) => {
  const r = el.getBoundingClientRect();
  const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return !!top && (top === el || el.contains(top)) && !top.closest(".consent-banner");
});
const reachable = async (loc: Locator) => {
  await loc.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior }));
  return atCentre(loc);
};
// Smooth scrolling moves the page after the event that started it: wait until it stops.
async function settledY(page: Page) {
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const y = await page.evaluate(() => Math.round(window.scrollY));
    if (y === last) return y;
    last = y;
    await page.waitForTimeout(120);
  }
  return last;
}
const reservedVar = (page: Page) => page.evaluate(() => document.documentElement.style.getPropertyValue("--consent-banner-h"));
const toBottom = (page: Page) =>
  page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" as ScrollBehavior }));

for (const [w, h] of VIEWPORTS) {
  test(`layout, reservation and footer reachability at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page);
    for (const path of PAGES) {
      await page.goto(`${ORIGIN}${path}`);
      await expect(banner(page)).toBeVisible();
      const b = (await banner(page).boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(16 - 1);
      expect(b.x + b.width).toBeLessThanOrEqual(w - 16 + 1);
      expect(Math.round(h - (b.y + b.height))).toBe(16); // 16px bottom gutter
      expect(b.height).toBeLessThanOrEqual(h * 0.35 + 1);
      if (w >= 768) {
        expect(b.width).toBeLessThanOrEqual(448 + 1);
        expect(Math.round(w - (b.x + b.width))).toBe(16); // bottom-right corner card
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
      // reserved = banner height plus the 16px gutter
      expect(await reservedVar(page)).toBe(`${Math.ceil(h - b.y)}px`);
      expect(await page.evaluate(() => getComputedStyle(document.body).paddingBottom)).toBe(`${Math.ceil(h - b.y)}px`);
      await toBottom(page);
      const foot = page.locator(".site-footer");
      expect(await atCentre(foot.getByRole("link", { name: "Privacy", exact: true })), `${path} footer Privacy`).toBe(true);
      expect(await atCentre(foot.getByRole("button", { name: "Analytics choices" })), `${path} footer Analytics choices`).toBe(true);
    }
  });

  test(`Tab and Shift+Tab never leave a focused control under the banner at ${w}x${h}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: w, height: h });
    await boot(page);
    // Smooth scrolling would leave the page mid-flight when probed; the final position is what matters.
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const st = document.createElement("style");
        st.textContent = "html{scroll-behavior:auto!important}";
        document.head.appendChild(st);
      });
    });
    const probe = () => page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || el.closest(".consent-banner")) return { skip: true, name: "", ok: true };
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { skip: false, name: (el.textContent || el.id || el.tagName).trim().slice(0, 30), ok: !!top && !top.closest(".consent-banner") };
    });
    for (const path of PAGES) {
      await page.goto(`${ORIGIN}${path}`);
      await expect(banner(page)).toBeVisible();
      for (let i = 0; i < 200; i++) {
        await page.keyboard.press("Tab");
        if (i > 0 && await page.evaluate(() => document.activeElement === document.body)) break;
        const s = await probe();
        if (!s.skip) expect(s.ok, `${path} Tab ${i + 1}: ${s.name}`).toBe(true);
      }
      // and backwards from the end of the document
      for (let i = 0; i < 200; i++) {
        await page.keyboard.press("Shift+Tab");
        if (i > 0 && await page.evaluate(() => document.activeElement === document.body)) break;
        const s = await probe();
        if (!s.skip) expect(s.ok, `${path} Shift+Tab ${i + 1}: ${s.name}`).toBe(true);
      }
    }
  });

  test(`a first-visit choice does not scroll the page; space and listeners are released at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page);
    for (const label of ["Reject", "Accept analytics"]) {
      await page.goto(`${ORIGIN}/`);
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await expect(banner(page)).toBeVisible();
      // mid-page, so a stray focus() scroll would show
      await page.evaluate(() => window.scrollTo({ top: 1500, behavior: "instant" as ScrollBehavior }));
      const before = await settledY(page);
      await banner(page).getByRole("button", { name: label }).click();
      await expect(banner(page)).toHaveCount(0);
      expect(await settledY(page)).toBe(before);
      expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe("Analytics choices");
      expect(await reservedVar(page)).toBe("");
      expect(await page.evaluate(() => getComputedStyle(document.body).paddingBottom)).toBe("0px");
      expect(await page.evaluate(() => document.documentElement.classList.contains("has-consent-banner"))).toBe(false);
    }
  });
}

test("with no footer control to return to, focus goes to main, not body, and the page does not scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await boot(page);
  await page.goto(`${ORIGIN}/`);
  await expect(banner(page)).toBeVisible();
  await page.evaluate(() => {
    document.querySelectorAll("[data-analytics-choices]").forEach((e) => e.remove());
    window.scrollTo({ top: 1500, behavior: "instant" as ScrollBehavior });
  });
  const before = await settledY(page);
  await banner(page).getByRole("button", { name: "Reject" }).click();
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("MAIN");
  expect(await settledY(page)).toBe(before);
});

test("the banner is first in the DOM and a few Tab presses away; focus returns to the footer control", async ({ page }) => {
  await boot(page);
  for (const path of PAGES) {
    await page.goto(`${ORIGIN}${path}`);
    await expect(banner(page)).toBeVisible();
    expect(await page.evaluate(() => document.body.firstElementChild?.id)).toBe("analytics-consent");
    await page.keyboard.press("Tab"); // the Privacy notice link comes first
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim()), path).toBe("Privacy notice");
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.textContent?.trim()), path).toBe("Accept analytics");
  }
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(banner(page)).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe("Analytics choices");
});

// A pointer press must reach click: focus that follows it may not scroll the page.
async function pressNearBanner(page: Page, loc: Locator, gap: number, tap: boolean | "held") {
  const pos = await loc.evaluate((el, gap) => {
    el.scrollIntoView({ block: "end", behavior: "instant" as ScrollBehavior });
    const bannerTop = document.querySelector(".consent-banner")!.getBoundingClientRect().top;
    window.scrollBy({ top: el.getBoundingClientRect().bottom - (bannerTop + gap), behavior: "instant" as ScrollBehavior });
    (window as any).__clicked = false;
    el.addEventListener("click", (e) => { (window as any).__clicked = true; e.preventDefault(); }, { once: true });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, gap);
  const before = await settledY(page);
  if (tap === "held") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pos.x, y: pos.y }] });
    await page.waitForTimeout(700);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else if (tap) await page.touchscreen.tap(pos.x, pos.y);
  else await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => (window as any).__clicked), "click fired").toBe(true);
  expect(await settledY(page), "page did not jump").toBe(before);
}

const NEAR_BANNER: [string, (p: Page) => Locator][] = [
  ["/", (p) => p.locator(".hero .btn").first()],
  ["/", (p) => p.locator(".site-footer").getByRole("button", { name: "Analytics choices" })],
  ["/connect/", (p) => p.locator("input.ovin").first()],
];

test.describe("mouse click at 1280x800", () => {
  for (const gap of [-4, 6]) {
    test(`controls whose edge is ${gap} px from the banner still receive the click`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await boot(page);
      for (const [path, pick] of NEAR_BANNER) {
        await page.goto(`${ORIGIN}${path}`);
        await expect(banner(page)).toBeVisible();
        await pressNearBanner(page, pick(page), gap, false);
      }
    });
  }
});

test.describe("touch tap at 375x667", () => {
  test.use({ hasTouch: true, viewport: { width: 375, height: 667 } });
  for (const gap of [-4, 6]) {
    for (const mode of [true, "held"] as const) {
      test(`controls whose edge is ${gap} px from the banner still receive the ${mode === "held" ? "held (700 ms) " : ""}tap`, async ({ page }) => {
        await boot(page);
        for (const [path, pick] of NEAR_BANNER) {
          await page.goto(`${ORIGIN}${path}`);
          await expect(banner(page)).toBeVisible();
          await pressNearBanner(page, pick(page), gap, mode);
        }
      });
    }
  }
});

test("a keyboard-focused control under the banner is scrolled clear, and the helper is removed on choice", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await boot(page);
  await page.goto(`${ORIGIN}/connect/`);
  await expect(banner(page)).toBeVisible();
  const input = page.locator("input.ovin").first();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
  await input.focus(); // a script focus is not pointer-initiated
  expect(await atCentre(input)).toBe(true);
  await banner(page).getByRole("button", { name: "Reject" }).click();
  // no listener left: focusing under where the banner was must not move the page
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
  const before = await settledY(page);
  await page.locator(".site-footer").getByRole("button", { name: "Analytics choices" }).focus();
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  expect(await settledY(page)).toBe(before);
});

for (const [w, h] of [[320, 568], [375, 667]]) {
  test(`the open phone menu stays above the banner and every link is hittable at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page);
    await page.goto(`${ORIGIN}/`);
    await expect(banner(page)).toBeVisible();
    await page.locator("#navToggle").click();
    const nav = page.locator("#nav");
    await expect(nav).toHaveClass(/open/);
    const bannerTop = (await banner(page).boundingBox())!.y;
    const navBox = (await nav.boundingBox())!;
    expect(navBox.y + navBox.height).toBeLessThanOrEqual(bannerTop);
    for (const link of await nav.getByRole("link").all()) {
      await link.scrollIntoViewIfNeeded();
      expect(await atCentre(link), await link.innerText()).toBe(true);
    }
  });
}

test("reserved space is released by a choice in another tab, returns on reopen and follows a resize", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page);
  await page.goto(`${ORIGIN}/`);
  await expect(banner(page)).toBeVisible();
  await page.evaluate((k) => { localStorage.setItem(k, "denied"); window.dispatchEvent(new StorageEvent("storage", { key: k })); }, "openvaultdb.analytics-consent.v1");
  await expect(banner(page)).toHaveCount(0);
  expect(await reservedVar(page)).toBe("");
  expect(await page.evaluate(() => getComputedStyle(document.body).paddingBottom)).toBe("0px");
  await page.locator(".site-footer").getByRole("button", { name: "Analytics choices" }).click();
  await expect(banner(page)).toBeVisible();
  const wide = await reservedVar(page);
  expect(wide).not.toBe("");
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(() => reservedVar(page)).not.toBe(wide);
  const b = (await banner(page).boundingBox())!;
  expect(await reservedVar(page)).toBe(`${Math.ceil(568 - b.y)}px`);
});

// CLS 0.112 on /privacy/ (0.023 without the banner) came from the banner text using the Google web
// font: the late swap resized the bottom-fixed box. The harness blocks Google Fonts, so assert the
// cause instead of the metric: the banner and its buttons use system fonts, which never swap.
test("banner text uses system fonts, so a web-font swap cannot resize it (CLS)", async ({ page }) => {
  await boot(page);
  await page.goto(`${ORIGIN}/privacy/`);
  await expect(banner(page)).toBeVisible();
  const fonts = await banner(page).evaluate((el) =>
    [el, el.querySelector("p")!, ...Array.from(el.querySelectorAll("button, a"))].map((e) => getComputedStyle(e).fontFamily));
  for (const f of fonts) expect(f).not.toMatch(/Source Sans|Libre Franklin|IBM Plex/);
});
