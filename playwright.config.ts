import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { qaStorageState } from "./e2e/helpers/qa-user";

// Playwright no carga .env.local como Next: QA_EMAIL / QA_PASSWORD salen de acá.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

// Next 16 no permite dos `next dev` sobre el mismo proyecto (lock en .next/dev/lock), así que se
// reusa el server de desarrollo si ya está corriendo en vez de levantar otro en un puerto aparte.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  // Todos los tests comparten la base remota real y el mismo usuario QA: en paralelo se pisan.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    // La app calcula "hoy" en America/Asuncion y formatea montos con es-PY.
    timezoneId: "America/Asuncion",
    locale: "es-PY",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: qaStorageState },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
