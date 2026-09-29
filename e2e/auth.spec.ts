import { expect, test } from "@playwright/test";
import { loginAs, qaCredentials } from "./helpers/qa-user";

test.describe("sin sesión", () => {
  // Resetear el estado de la sesión para que los tests de este bloque no tengan sesión guardada.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login con el usuario QA entra a /protected", async ({ page }) => {
    const { email, password } = qaCredentials();

    await loginAs(page, email, password);

    await expect(page).toHaveURL(/\/protected/);
    await expect(page.getByText("OwnMonetaryApp")).toBeVisible();
  });

  test("contraseña incorrecta muestra el error y no entra", async ({ page }) => {
    const { email } = qaCredentials();

    await loginAs(page, email, "contraseña-incorrecta");

    await expect(page.getByText("Invalid login credentials")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("/protected sin sesión redirige al login", async ({ page }) => {
    await page.goto("/protected");

    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test("con la sesión guardada del usuario QA, /protected carga sin pasar por el login", async ({
  page,
}) => {
  await page.goto("/protected");

  await expect(page).toHaveURL(/\/protected/);
  await expect(page.getByText("OwnMonetaryApp")).toBeVisible();
});
