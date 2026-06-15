import { defineConfig } from "@playwright/test";
import path from "path";

// End-to-end test for the OVDB Connect routing flow. Playwright orchestrates the
// four services the flow spans, then drives a browser through both the manual
// and the registered-vault connect paths. Assumes the sibling repos
// (openvaultdb-go, openvaultdb-todo-demo) are checked out next to this one.
const REPO = path.resolve(__dirname, "..");
const OVDB_DATA = `${__dirname}/.e2e-data/ovdb`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5173", trace: "retain-on-failure" },
  webServer: [
    {
      command: `go run ./cmd/ovdb-server serve --port 8088 --data-dir ${OVDB_DATA}`,
      cwd: `${REPO}/openvaultdb-go`,
      url: "http://localhost:8088/.well-known/openvaultdb",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command:
        "go run ./cmd/todo-backend serve --port 5180 --connect-url http://localhost:8787/connect",
      cwd: `${REPO}/openvaultdb-todo-demo/backend`,
      url: "http://localhost:5180/api/status",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --port 5173 --strictPort",
      cwd: `${REPO}/openvaultdb-todo-demo/frontend`,
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "firebase emulators:start --only hosting,auth,firestore --project openvaultdb",
      cwd: `${REPO}/openvaultdb-com`,
      url: "http://localhost:8787",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
