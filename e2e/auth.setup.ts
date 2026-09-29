import { expect, test as setup } from "@playwright/test";
import { loginAs, qaCredentials, qaStorageState } from "./helpers/qa-user";

// Loguea al usuario QA una vez y guarda la sesión: el resto de los tests (y playwright-cli, con
// `state-load e2e/.auth/qa.json`) arrancan ya autenticados.
setup("login del usuario QA", async ({ page }) => {
  const { email, password } = qaCredentials();

  await loginAs(page, email, password);
  await expect(page).toHaveURL(/\/protected/);

  await page.context().storageState({ path: qaStorageState });
});
