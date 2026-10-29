import { test, expect, type Page } from "@playwright/test";
import { existsSync, readFileSync, statSync } from "fs";
import path from "path";

// Self-contained locale and film-slot tests: ./public is served at a non-local
// origin through request interception, everything else is blocked, and every
// request URL is recorded. Run: npm run e2e:analytics
const ORIGIN = "https://openvaultdb.test";
const PUBLIC = path.resolve(__dirname, "..", "public");
const YOUTUBE = /youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com/;
const TYPES: Record<string, string> = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".webp": "image/webp",
};

async function boot(page: Page, overrides: Record<string, string> = {}): Promise<string[]> {
  const seen: string[] = [];
  page.on("request", (r) => seen.push(r.url()));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) {
      // YouTube is stubbed (the iframe document) so a click can be observed; the rest is blocked.
      if (url.hostname === "www.youtube-nocookie.com") return route.fulfill({ contentType: "text/html", body: "<title>player</title>" });
      return route.abort();
    }
    if (overrides[url.pathname]) return route.fulfill({ contentType: "text/javascript", body: overrides[url.pathname] });
    let file = path.join(PUBLIC, url.pathname);
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!existsSync(file)) return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill({ contentType: TYPES[path.extname(file)] || "text/plain", body: readFileSync(file) });
  });
  return seen;
}

const hreflangs = (page: Page) =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => [l.getAttribute("hreflang"), l.getAttribute("href")]),
    ),
  );

test("the Russian home page renders in Russian with its own lang, canonical and Open Graph", async ({ page }) => {
  await boot(page);
  await page.goto(`${ORIGIN}/ru`);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Приложения не владеют вашими данными");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://openvaultdb.com/ru");
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "ru_RU");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://openvaultdb.com/og-ru.png");
  await expect(page).toHaveTitle(/базы данных приложений/);
  // the generated install block is translated, the commands are not
  await expect(page.getByRole("heading", { name: /Попросите агента/ })).toBeVisible();
  await expect(page.locator("#home-unix-install")).toContainText("curl -fsSL https://openvaultdb.com/install.sh");
});

test("language switch works both ways", async ({ page }) => {
  await boot(page);
  await page.goto(`${ORIGIN}/`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator("a.lang-switch").click();
  await expect(page).toHaveURL(`${ORIGIN}/ru`);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await page.locator("a.lang-switch").click();
  await expect(page).toHaveURL(`${ORIGIN}/`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("hreflang is reciprocal on both locales and x-default is English", async ({ page }) => {
  await boot(page);
  const pairs: Array<[string, string]> = [["/", "/ru"], ["/privacy", "/ru/privacy"]];
  for (const [en, ru] of pairs) {
    const expected = {
      en: `https://openvaultdb.com${en}`,
      ru: `https://openvaultdb.com${ru}`,
      "x-default": `https://openvaultdb.com${en}`,
    };
    await page.goto(`${ORIGIN}${en}`);
    expect(await hreflangs(page)).toEqual(expected);
    await page.goto(`${ORIGIN}${ru}`);
    expect(await hreflangs(page)).toEqual(expected);
  }
});

test("the consent banner and install block are Russian on /ru", async ({ page }) => {
  await boot(page);
  await page.goto(`${ORIGIN}/ru`);
  await expect(page.getByRole("region", { name: "Выбор по аналитике" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Отклонить" })).toBeVisible();
});

const disabled = `window.OVDB_VIDEO={enabled:false,locales:{}};`;

test("film slot is hidden and makes no YouTube request while disabled", async ({ page }) => {
  const seen = await boot(page, { "/js/video-config.js": disabled });
  for (const p of ["/", "/ru"]) {
    await page.goto(`${ORIGIN}${p}`);
    await page.waitForTimeout(300);
    await expect(page.locator("[data-video-slot]")).toBeHidden();
  }
  expect(seen.filter((u) => YOUTUBE.test(u))).toEqual([]);
});

test("published film: own poster, duration badge and label, no request before click, own id after", async ({ page }) => {
  const seen = await boot(page);
  const films: [string, string, string, string, RegExp][] = [
    ["/", "en", "LMTcLntUWJM", "1:35", /^Play the 1:35 film: OpenVaultDB film: Your data, your vault$/],
    ["/ru", "ru", "G6qINgqifaQ", "1:45", /^Смотреть фильм \(1:45\): Фильм об OpenVaultDB/],
  ];
  for (const [p, lang, id, duration, label] of films) {
    seen.length = 0;
    await page.goto(`${ORIGIN}${p}`);
    const slot = page.locator("[data-video-slot]");
    await expect(slot).toBeVisible();
    const img = slot.locator("img.film-poster");
    await expect(img).toHaveAttribute("src", `/video/poster-${lang}.webp`);
    await expect(img).toHaveAttribute("width", "1280");
    await expect(img).toHaveAttribute("height", "720");
    await expect(slot.locator(".film-duration")).toHaveText(duration);
    const button = slot.getByRole("button");
    await expect(button).toHaveAttribute("lang", lang);
    expect(await button.getAttribute("aria-label")).toMatch(label);
    await page.waitForTimeout(300);
    expect(seen.filter((u) => YOUTUBE.test(u)), `${p} before click`).toEqual([]);
    expect(await page.locator("iframe").count()).toBe(0);

    await button.click();
    await expect(slot.locator("iframe")).toHaveAttribute("src", new RegExp(`^https://www\\.youtube-nocookie\\.com/embed/${id}\\?autoplay=1`));
    expect(seen.filter((u) => YOUTUBE.test(u) && !/youtube-nocookie\.com\/embed\//.test(u))).toEqual([]);
  }
});

const enabled = (en: string, ru: string) =>
  `window.OVDB_VIDEO={enabled:true,locales:{en:{id:"${en}",poster:"/video/poster-en.webp",width:1280,height:720},ru:{id:"${ru}",poster:"/video/poster-ru.webp",width:1280,height:720}}};`;

test("enabled film: poster only until click, then youtube-nocookie, per-locale id", async ({ page }) => {
  const seen = await boot(page, { "/js/video-config.js": enabled("AAAAAAAAAAA", "BBBBBBBBBBB") });
  for (const [p, id, poster] of [["/", "AAAAAAAAAAA", "poster-en.webp"], ["/ru", "BBBBBBBBBBB", "poster-ru.webp"]]) {
    seen.length = 0;
    await page.goto(`${ORIGIN}${p}`);
    const slot = page.locator("[data-video-slot]");
    await expect(slot).toBeVisible();
    const img = slot.locator("img.film-poster");
    await expect(img).toHaveAttribute("src", `/video/${poster}`);
    await expect(img).toHaveAttribute("width", "1280");
    await expect(img).toHaveAttribute("height", "720");
    await page.waitForTimeout(300);
    expect(seen.filter((u) => YOUTUBE.test(u)), `${p} before click`).toEqual([]);
    expect(await page.locator("iframe").count()).toBe(0);

    await slot.getByRole("button").click();
    const frame = slot.locator("iframe");
    await expect(frame).toHaveAttribute("src", new RegExp(`^https://www\\.youtube-nocookie\\.com/embed/${id}\\?`));
    expect(await frame.getAttribute("src")).toContain(`hl=${p === "/" ? "en" : "ru"}`);
    expect(seen.filter((u) => /youtube\.com/.test(u) && !/youtube-nocookie\.com/.test(u))).toEqual([]);
  }
});

test("enabled flag without an id for the locale keeps the slot hidden", async ({ page }) => {
  await boot(page, { "/js/video-config.js": enabled("AAAAAAAAAAA", "") });
  await page.goto(`${ORIGIN}/ru`);
  await expect(page.locator("[data-video-slot]")).toBeHidden();
  await page.goto(`${ORIGIN}/`);
  await expect(page.locator("[data-video-slot]")).toBeVisible();
});
