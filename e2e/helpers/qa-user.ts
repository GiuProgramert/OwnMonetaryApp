import type { Page } from "@playwright/test";

// Sesión del usuario QA que genera e2e/auth.setup.ts (ignorada por git).
export const qaStorageState = "e2e/.auth/qa.json";

export function qaCredentials() {
  const email = process.env.QA_EMAIL;
  const password = process.env.QA_PASSWORD;

  if (!email || !password) {
    throw new Error("Faltan QA_EMAIL / QA_PASSWORD en .env.local");
  }

  return { email, password };
}

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
}
