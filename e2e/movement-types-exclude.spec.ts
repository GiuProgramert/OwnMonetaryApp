import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { qaSupabase, uniqueName } from "./helpers/supabase";

const transferMovementTypeId = "e7f1b48a-be01-48a5-9982-5a4d4025493c";

const card = (page: Page, title: string) =>
  page.getByText(title, { exact: true }).locator("xpath=../..");

/** `YYYY-MM-DD` de hoy en la zona horaria de la app. */
function appToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(new Date());
}

// El eje de "Gastos por tipo" recorta los nombres largos (18 caracteres en escritorio).
const axisLabel = (name: string, max = 18) => (name.length > max ? `${name.slice(0, max - 1)}…` : name);

type TypeRow = { id: string; name: string };

test.describe("movement-types-exclude", () => {
  let supabase: SupabaseClient;
  let typeE: TypeRow;
  let typeN: TypeRow;
  const accountIds: string[] = [];
  let mainId: string;
  let onlyExcludedId: string;

  test.beforeAll(async () => {
    supabase = await qaSupabase();

    const { data: excluded, error: excludedError } = await supabase
      .from("movement_types")
      .select("id,name")
      .eq("exclude_from_expense_charts", true)
      .neq("id", transferMovementTypeId)
      .order("name")
      .limit(1);

    if (excludedError) {
      throw new Error(excludedError.message);
    }

    if (!excluded || excluded.length === 0) {
      throw new Error(
        "No hay ningún tipo marcado como excluido; el punto 1.2 marca Prestado"
      );
    }

    typeE = excluded[0];

    const { data: normal, error: normalError } = await supabase
      .from("movement_types")
      .select("id,name")
      .eq("exclude_from_expense_charts", false)
      .neq("id", transferMovementTypeId)
      .order("name")
      .limit(1);

    if (normalError || !normal || normal.length === 0) {
      throw new Error(normalError?.message ?? "Hace falta un tipo no excluido");
    }

    typeN = normal[0];

    const { data: accounts, error } = await supabase
      .from("accounts")
      .insert([
        { name: uniqueName("movement-types-exclude", "principal") },
        { name: uniqueName("movement-types-exclude", "solo-excluido") },
      ])
      .select("id");

    if (error) {
      throw new Error(error.message);
    }

    accountIds.push(...accounts.map((account) => account.id));
    [mainId, onlyExcludedId] = accountIds;

    const movement = (accountId: string, typeId: string, amount: number) => ({
      date: `${appToday()}T12:00`,
      description: uniqueName("movement-types-exclude"),
      amount,
      type: "debit",
      account_id: accountId,
      movement_type_id: typeId,
    });

    const { error: movementsError } = await supabase.from("movements").insert([
      movement(mainId, typeE.id, 900_000),
      movement(mainId, typeN.id, 100_000),
      movement(onlyExcludedId, typeE.id, 50_000),
    ]);

    if (movementsError) {
      throw new Error(movementsError.message);
    }
  });

  test.afterAll(async () => {
    // Borrar las cuentas borra en cascada sus movimientos.
    if (accountIds.length > 0) {
      await supabase.from("accounts").delete().in("id", accountIds);
    }
  });

  test("P.1 — Gastos por tipo muestra el tipo normal y no el excluido", async ({ page }) => {
    await page.goto(`/protected?accountId=${mainId}`);
    const chart = card(page, "Gastos por tipo").locator("svg");

    await expect(chart.getByText(axisLabel(typeN.name), { exact: true })).toBeVisible();
    await expect(chart.getByText(axisLabel(typeE.name), { exact: true })).toHaveCount(0);
  });

  test("P.2 — Gastos diarios: leyenda sin el excluido y total de hoy solo del normal", async ({
    page,
  }) => {
    await page.goto(`/protected?accountId=${mainId}&dailyRange=7d`);
    const daily = card(page, "Gastos diarios por tipo");
    const legend = daily.locator("ul li");

    await expect(legend.filter({ hasText: typeN.name }).first()).toBeVisible();
    await expect(legend.getByText(typeE.name, { exact: true })).toHaveCount(0);
    await expect(daily.locator("text.fill-foreground")).toHaveText(["100 mil"]);
  });

  test("P.3 — Egresos y el listado de movimientos siguen contando el tipo excluido", async ({
    page,
  }) => {
    await page.goto(`/protected?accountId=${mainId}`);
    const egresos = page.getByText("Egresos", { exact: true }).locator("xpath=../..");

    await expect(egresos).toContainText(`Gs. ${(1_000_000).toLocaleString("es-PY")}`);

    await page.goto(`/protected/movements?accountId=${mainId}`);
    await expect(page.getByText(typeE.name, { exact: true }).first()).toBeVisible();
  });

  test("P.4 — una cuenta con solo gastos excluidos muestra el estado vacío en los dos cards", async ({
    page,
  }) => {
    await page.goto(`/protected?accountId=${onlyExcludedId}&dailyRange=7d`);

    for (const title of ["Gastos por tipo", "Gastos diarios por tipo"]) {
      await expect(card(page, title)).toContainText("No hay gastos registrados en este período.");
    }
  });

  test("P.5 — listado: badge solo en el excluido (escritorio y mobile); edición con checkbox marcado/desmarcado", async ({
    page,
  }) => {
    const badge = "Excluido de gráficos";

    await page.goto("/protected/movement-types");
    const desktopRow = (name: string) =>
      page.locator("tbody tr").filter({ has: page.getByText(name, { exact: true }) });

    await expect(desktopRow(typeE.name).getByText(badge)).toBeVisible();
    await expect(desktopRow(typeN.name)).toBeVisible();
    await expect(desktopRow(typeN.name).getByText(badge)).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/protected/movement-types");
    const mobileItem = (name: string) =>
      page.locator("ul > li").filter({ has: page.getByText(name, { exact: true }) });

    await expect(mobileItem(typeE.name).getByText(badge)).toBeVisible();
    await expect(mobileItem(typeN.name)).toBeVisible();
    await expect(mobileItem(typeN.name).getByText(badge)).toHaveCount(0);

    const checkboxName = "Excluir de los gráficos de gastos";

    await page.goto(`/protected/movement-types/edit/${typeE.id}`);
    await expect(page.getByRole("checkbox", { name: checkboxName })).toBeChecked();

    await page.goto(`/protected/movement-types/edit/${typeN.id}`);
    await expect(page.getByRole("checkbox", { name: checkboxName })).not.toBeChecked();
  });

  test("P.6 — alta: checkbox desmarcado con su texto de ayuda", async ({ page }) => {
    await page.goto("/protected/movement-types/create");

    await expect(
      page.getByRole("checkbox", { name: "Excluir de los gráficos de gastos" })
    ).not.toBeChecked();
    await expect(
      page.getByText(
        "No aparece en «Gastos por tipo» ni en «Gastos diarios por tipo». Sigue contando en saldos, egresos y flujo mensual."
      )
    ).toBeVisible();
  });

  test("P.7 — los dos cards avisan qué tipos no incluyen", async ({ page }) => {
    await page.goto(`/protected?accountId=${mainId}&dailyRange=7d`);

    for (const title of ["Gastos por tipo", "Gastos diarios por tipo"]) {
      const description = card(page, title);

      await expect(description).toContainText("No incluye:");
      await expect(description).toContainText(typeE.name);
    }
  });
});
