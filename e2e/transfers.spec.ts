import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { qaSupabase, uniqueName } from "./helpers/supabase";

const formatGs = (amount: number) => `Gs. ${amount.toLocaleString("es-PY")}`;

// Card de totales de /protected/movements: CardTitle → CardHeader → Card.
const totalCard = (page: Page, title: string) =>
  page.getByText(title, { exact: true }).locator("xpath=../..");

test.describe("transferencias", () => {
  let supabase: SupabaseClient;
  const accountIds: string[] = [];
  const fromName = uniqueName("transfers", "origen");
  const toName = uniqueName("transfers", "destino");
  const amount = 50000;

  test.beforeAll(async () => {
    supabase = await qaSupabase();

    const { data, error } = await supabase
      .from("accounts")
      .insert([{ name: fromName }, { name: toName }])
      .select("id");

    if (error) {
      throw new Error(error.message);
    }

    accountIds.push(...data.map((account) => account.id));
  });

  test.afterAll(async () => {
    // Borrar las cuentas borra en cascada los movimientos de la transferencia.
    if (accountIds.length > 0) {
      await supabase.from("accounts").delete().in("id", accountIds);
    }
  });

  test("con una cuenta filtrada, los totales cuentan la transferencia como egreso/ingreso", async ({
    page,
  }) => {
    const [fromId, toId] = accountIds;

    await page.goto("/protected/transfers/create");
    await page.getByLabel("Descripción").fill(uniqueName("transfers"));
    await page.getByLabel("Monto").fill(String(amount));
    await page.getByLabel("Cuenta de origen").click();
    await page.getByRole("option", { name: fromName }).click();
    await page.getByLabel("Cuenta de destino").click();
    await page.getByRole("option", { name: toName }).click();
    await page.getByRole("button", { name: "Crear" }).click();
    await expect(page).toHaveURL(/\/protected\/movements/);

    // La transferencia se crea con fecha de ahora: cae en el mes actual, el rango por defecto.
    await page.goto(`/protected/movements?accountId=${fromId}`);
    await expect(totalCard(page, "Ingresos")).toContainText(formatGs(0));
    await expect(totalCard(page, "Egresos")).toContainText(formatGs(amount));
    await expect(totalCard(page, "Balance neto")).toContainText(formatGs(-amount));

    await page.goto(`/protected/movements?accountId=${toId}`);
    await expect(totalCard(page, "Ingresos")).toContainText(formatGs(amount));
    await expect(totalCard(page, "Egresos")).toContainText(formatGs(0));
    await expect(totalCard(page, "Balance neto")).toContainText(formatGs(amount));
  });
});
