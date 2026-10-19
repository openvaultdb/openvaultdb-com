import { test, expect, type Page } from "@playwright/test";
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
