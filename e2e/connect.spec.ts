import { test, expect, type Page } from "@playwright/test";

// The flow under test:
//   demo frontend → demo backend /connect → OVDB Connect (wallet) → vault
//   server /authorize (consent) → demo /callback?...&iss → token exchange at
//   {iss} → record CRUD against the chosen vault.

const FRONTEND = "http://localhost:5173";
const DEMO_CONNECT = "http://localhost:5180/connect";
const WALLET = "http://localhost:8787";
const OVDB = "http://localhost:8088";

async function approveConsent(page: Page) {
  await page.waitForURL(/localhost:8088\/authorize/);
  await page.getByRole("button", { name: "Approve" }).click();
}

async function expectConnectedAndAddTask(page: Page, title: string) {
  await page.waitForURL(/localhost:5173/);
  await expect(page.getByText("Vault connected")).toBeVisible();
  const input = page.getByPlaceholder("What needs doing?");
  await input.fill(title);
  await input.press("Enter");
  await expect(page.getByText(title)).toBeVisible();
}

test("manual path: route through OVDB Connect, enter server + vault", async ({ page }) => {
  // Sanity-check the frontend's Connect entry point.
  await page.goto(FRONTEND);
  await expect(page.getByRole("button", { name: "Connect your vault" })).toBeVisible();

  // Drive the flow (the button just navigates to the backend's /connect).
  await page.goto(DEMO_CONNECT);
  await page.waitForURL(/localhost:8787\/connect/);
  await expect(page.getByText("todo-demo.openvaultdb.app").first()).toBeVisible();

  await page.locator("[data-manual-url]").fill(OVDB);
  await page.locator("[data-manual-vault]").fill("personal");
  await page.locator("[data-manual-go]").click();

  await approveConsent(page);

  const title = "manual-" + Date.now();
  await expectConnectedAndAddTask(page, title);

  // Persisted in the vault: a fresh load reads it back through the backend.
  await page.goto(FRONTEND);
  await expect(page.getByText(title)).toBeVisible();
});

test("registered path: sign in and pick a wallet vault", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  // 1. Sign up against the Auth emulator on the wallet origin.
  await page.goto(WALLET + "/");
  await page.locator(".btn-signin").first().click();
  await page.locator("[data-toggle-link]").click(); // switch to "Create account"
  await page.locator('.auth-input[name="email"]').fill(email);
  await page.locator('.auth-input[name="password"]').fill("test1234");
  await page.locator(".auth-submit").click();
  await page.waitForURL(/localhost:8787\/my\/vaults/);
  await expect(page.locator(".user-chip")).toBeVisible();

  // 2. Seed a registered server-vault pointer in the wallet.
  await page.evaluate(() => {
    localStorage.setItem(
      "ovdb_vaults",
      JSON.stringify([
        {
          id: "v1",
          kind: "server",
          name: "Personal",
          hostName: "Local OVDB",
          baseUrl: "http://localhost:8088",
          ownerToken: "seed-token",
          vaultId: "personal",
          backend: "ingit",
        },
      ]),
    );
  });

  // 3. Start the connect flow; OVDB Connect should offer the registered vault.
  await page.goto(DEMO_CONNECT);
  await page.waitForURL(/localhost:8787\/connect/);
  await page.locator("[data-pick-vault]").first().click();

  await approveConsent(page);

  const title = "registered-" + Date.now();
  await expectConnectedAndAddTask(page, title);
});
