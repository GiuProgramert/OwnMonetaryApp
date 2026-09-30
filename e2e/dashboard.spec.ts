import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { qaSupabase, uniqueName } from "./helpers/supabase";

const formatGs = (amount: number) => `Gs. ${amount.toLocaleString("es-PY")}`;

// Card del dashboard: CardTitle → CardHeader → Card.
const card = (page: Page, title: string) =>
  page.getByText(title, { exact: true }).locator("xpath=../..");

const transferMovementTypeId = "e7f1b48a-be01-48a5-9982-5a4d4025493c";

/** `YYYY-MM-DD` de hoy menos `daysAgo`, en la zona horaria de la app. */
function appDay(daysAgo: number) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(
    new Date()
  );
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day - daysAgo));

  return date.toISOString().slice(0, 10);
}

const toFullDate = (day: string) => day.split("-").reverse().join("/");

test.describe("dashboard", () => {
  let supabase: SupabaseClient;
  const accountIds: string[] = [];
  const mainName = uniqueName("dashboard", "principal");
  const otherName = uniqueName("dashboard", "otra");
  let typeX: { id: string; name: string };
  let typeY: { id: string; name: string };

  // hook que se utiliza para preparar los datos de prueba antes de ejecutar los tests
  // se consultan 2 movement_types distintos al de transferencias y se crean 2 cuentas con movimientos de esos tipos
  test.beforeAll(async () => {
    supabase = await qaSupabase();

    const { data: types, error: typesError } = await supabase
      .from("movement_types")
      .select("id,name")
      .neq("id", transferMovementTypeId)
      .order("name")
      .limit(2);

    if (typesError || !types || types.length < 2) {
      throw new Error(typesError?.message ?? "Hacen falta dos tipos de movimiento");
    }

    [typeX, typeY] = types;

    const { data: accounts, error } = await supabase
      .from("accounts")
      .insert([{ name: mainName }, { name: otherName }])
      .select("id");

    if (error) {
      throw new Error(error.message);
    }

    accountIds.push(...accounts.map((account) => account.id));
    const [mainId, otherId] = accountIds;

    const movement = (
      accountId: string,
      daysAgo: number,
      type: "credit" | "debit",
      typeId: string,
      amount: number
    ) => ({
      date: `${appDay(daysAgo)}T12:00`,
      description: uniqueName("dashboard"),
      amount,
      type,
      account_id: accountId,
      movement_type_id: typeId,
    });

    // Cada tipo gasta 0 algunos días: es lo que corría el índice del tooltip en Recharts 3.8.
    const { error: movementsError } = await supabase.from("movements").insert([
      movement(mainId, 3, "credit", typeX.id, 1_000_000),
      movement(otherId, 3, "credit", typeX.id, 300_000),
      movement(mainId, 2, "debit", typeX.id, 100_000),
      movement(mainId, 1, "debit", typeY.id, 50_000),
      movement(mainId, 0, "debit", typeX.id, 30_000),
      movement(mainId, 0, "debit", typeY.id, 25_000),
    ]);

    if (movementsError) {
      throw new Error(movementsError.message);
    }
  });

  // hook que se utiliza para limpiar los datos de prueba después de ejecutar los tests
  test.afterAll(async () => {
    // Borrar las cuentas borra en cascada sus movimientos.
    if (accountIds.length > 0) {
      await supabase.from("accounts").delete().in("id", accountIds);
    }
  });

  test("el sidebar queda fijo al scrollear el contenido", async ({ page }) => {
    await page.goto(`/protected?accountId=${accountIds[0]}`);
    const sidebar = page.locator("aside");
    const before = await sidebar.boundingBox();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    expect((await sidebar.boundingBox())?.y).toBe(before?.y);
  });

  test("el tooltip del donut se dibuja por encima del total del centro", async ({ page }) => {
    await page.goto(`/protected?accountId=${accountIds[0]}`);
    const donut = card(page, "Distribución del saldo actual");
    const chart = donut.locator(".recharts-wrapper");
    const tooltip = chart.locator(".recharts-tooltip-wrapper");

    // Reintenta: hasta que Recharts hidrata y mide el contenedor, el hover no hace nada.
    await expect(async () => {
      const box = await chart.boundingBox();

      if (!box) {
        throw new Error("No se dibujó el donut");
      }

      // Lado izquierdo del anillo (entre el 60% y el 90% del radio): el tooltip cae sobre el centro.
      const radius = Math.min(box.width, box.height) / 2;
      await page.mouse.move(0, 0);
      await page.mouse.move(box.x + box.width / 2 - radius * 0.75, box.y + box.height / 2);
      await expect(tooltip).toContainText("Gs.", { timeout: 1000 });
    }).toPass();

    // El overlay del total y el tooltip son `pointer-events: none` (y `elementFromPoint` los
    // saltea); se los habilita solo para preguntar qué está pintado arriba en el centro del tooltip.
    const tooltipOnTop = await donut.getByText("Total", { exact: true }).evaluate((total) => {
      const overlay = total.parentElement as HTMLElement;
      const tip = overlay.parentElement!.querySelector<HTMLElement>(".recharts-tooltip-wrapper")!;
      overlay.style.pointerEvents = "auto";
      tip.style.pointerEvents = "auto";
      const rect = tip.getBoundingClientRect();
      const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);

      return tip.contains(top);
    });

    expect(tooltipOnTop).toBe(true);
  });

  test("el tooltip de gastos diarios muestra el día y el tipo del segmento bajo el cursor", async ({
    page,
  }) => {
    await page.goto(`/protected?accountId=${accountIds[0]}&dailyRange=7d`);
    const daily = card(page, "Gastos diarios por tipo");
    const tooltip = daily.locator(".recharts-tooltip-wrapper");

    const expected = [
      { day: appDay(2), type: typeX, amount: 100_000, total: 100_000 },
      { day: appDay(1), type: typeY, amount: 50_000, total: 50_000 },
      { day: appDay(0), type: typeX, amount: 30_000, total: 55_000 },
      { day: appDay(0), type: typeY, amount: 25_000, total: 55_000 },
    ];

    for (const { day, type, amount, total } of expected) {
      // Segmentos de ese tipo en orden de día: el índice de `expected` para ese tipo.
      const sameType = expected.filter((e) => e.type.id === type.id);
      const segment = daily
        .locator(".recharts-bar-rectangle path")
        .and(daily.locator(`path[name="${type.name}"]`))
        .nth(sameType.findIndex((e) => e.day === day));

      // Reintenta: el `ResponsiveContainer` puede volver a dibujar las barras tras hidratar.
      await expect(async () => {
        await segment.hover();
        await expect(tooltip).toContainText(toFullDate(day), { timeout: 1000 });
        await expect(tooltip).toContainText(type.name, { timeout: 1000 });
        await expect(tooltip).toContainText(formatGs(amount), { timeout: 1000 });
        await expect(tooltip).toContainText(formatGs(total), { timeout: 1000 });
      }).toPass();
    }

    // Total del día arriba de cada barra (`DayTotalLabel`, no los ticks del eje).
    await expect(daily.locator("text.fill-foreground")).toHaveText(["100 mil", "50 mil", "55 mil"]);
  });
});
