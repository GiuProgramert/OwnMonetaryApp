import { expect, test, type Locator, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { qaSupabase, uniqueName } from "./helpers/supabase";

const HOUR_HEIGHT = 64;
const WEEK = "2026-01-05";
const TRANSFER_TYPE_ID = "e7f1b48a-be01-48a5-9982-5a4d4025493c";

const formatGs = (amount: number) => `Gs. ${amount.toLocaleString("es-PY")}`;

function todayInAsuncion() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Asuncion",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Card de totales de /protected/movements: CardTitle → CardHeader → Card.
const totalCard = (page: Page, title: string) =>
  page.getByText(title, { exact: true }).locator("xpath=../..");

test.describe("calendario de movimientos", () => {
  // Viewport alto a propósito: con 720 px la grilla empieza en y~425 y el puntero queda en el 20%
  // inferior de la ventana, donde el autoscroll de dnd-kit (esperado) desplaza la página durante
  // el arrastre y el destino se corre. No es un error de cálculo de minutos.
  test.use({ viewport: { width: 1280, height: 1600 } });

  let supabase: SupabaseClient;
  let accountA = "";
  let accountB = "";
  let typeId = "";
  const prefix = uniqueName("calendar");

  const calendarUrl = (extra = "", account = accountA, week = WEEK) =>
    `/protected/movements?view=calendar&accountId=${account}&week=${week}${extra}`;

  async function insertMovement(
    description: string,
    date: string,
    options: { account?: string; type?: "debit" | "credit"; amount?: number } = {}
  ) {
    const { data, error } = await supabase
      .from("movements")
      .insert({
        account_id: options.account ?? accountA,
        movement_type_id: typeId,
        description,
        amount: options.amount ?? 50000,
        type: options.type ?? "debit",
        date,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data.id as string;
  }

  async function dbDate(id: string) {
    const { data } = await supabase.from("movements").select("date").eq("id", id).single();

    return data?.date as string | undefined;
  }

  // Espera a que el skeleton inicial deje paso a la grilla y la deja en un scroll conocido.
  async function openCalendar(page: Page, url: string, scrollTop = 5 * HOUR_HEIGHT) {
    await page.goto(url);
    await expect(page.locator("[data-day]").first()).toBeVisible();
    await scrollGrid(page, scrollTop);
  }

  async function scrollGrid(page: Page, scrollTop: number) {
    await page.locator("[data-day]").first().evaluate((column, top) => {
      let parent: HTMLElement | null = column.parentElement;

      while (parent && parent.scrollHeight <= parent.clientHeight) {
        parent = parent.parentElement;
      }

      if (parent) {
        parent.scrollTop = top;
      }
    }, scrollTop);
  }

  const block = (page: Page, id: string) => page.locator(`[data-movement-id="${id}"]`);

  async function box(locator: Locator) {
    const b = await locator.boundingBox();

    if (!b) {
      throw new Error("Elemento sin bounding box");
    }

    return b;
  }

  // Arrastra agarrando el bloque 4px bajo su borde superior, de modo que el top del bloque
  // arrastrado = top de la columna + minutos destino.
  async function dragToDay(page: Page, id: string, day: string, minutes: number) {
    const source = await box(block(page, id));
    const column = await box(page.locator(`[data-day="${day}"]`));
    const startX = source.x + source.width / 2;
    const startY = source.y + 4;
    const destX = column.x + column.width / 2;
    const destY = column.y + (minutes / 60) * HOUR_HEIGHT + 4;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 8, startY + 8, { steps: 3 });
    await page.mouse.move(destX, destY, { steps: 15 });
    await page.mouse.up();
  }

  async function dragToLocator(page: Page, id: string, target: Locator) {
    const source = await box(block(page, id));
    const dest = await box(target);
    const startX = source.x + source.width / 2;
    const startY = source.y + 4;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 8, startY + 8, { steps: 3 });
    await page.mouse.move(dest.x + dest.width / 2, dest.y + dest.height / 2, { steps: 15 });
    await page.mouse.up();
  }

  test.beforeAll(async () => {
    supabase = await qaSupabase();

    const { data: accounts, error } = await supabase
      .from("accounts")
      .insert([{ name: uniqueName("calendar", "a") }, { name: uniqueName("calendar", "b") }])
      .select("id, name")
      .order("name");

    if (error) {
      throw new Error(error.message);
    }

    accountA = accounts[0].id;
    accountB = accounts[1].id;

    const { data: type } = await supabase
      .from("movement_types")
      .select("id")
      .neq("id", TRANSFER_TYPE_ID)
      .limit(1)
      .single();

    typeId = type!.id;
  });

  test.afterEach(async () => {
    await supabase.from("movements").delete().in("account_id", [accountA, accountB]);
  });

  test.afterAll(async () => {
    await supabase.from("accounts").delete().in("id", [accountA, accountB]);
  });

  test("P.1 — toggle Lista | Calendario", async ({ page }) => {
    // Un movimiento de hoy (el listado arranca en el mes actual) para que la tabla exista.
    await insertMovement(`${prefix} lista`, `${todayInAsuncion()}T08:00:00`);
    await page.goto(`/protected/movements?accountId=${accountA}`);
    await page.getByRole("link", { name: "Calendario" }).click();
    await expect(page).toHaveURL(/view=calendar/);
    await expect(page).toHaveURL(new RegExp(`accountId=${accountA}`));

    for (const label of ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    await page.getByRole("link", { name: "Lista" }).click();
    await expect(page).not.toHaveURL(/view=calendar/);
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("P.2 — bloque en su día, hora y altura; etiqueta de semana", async ({ page }) => {
    const description = `${prefix} almuerzo`;
    const id = await insertMovement(description, "2026-01-07T14:30:00");

    await openCalendar(page, calendarUrl());

    const event = page.locator(`[data-day="2026-01-07"] [data-movement-id="${id}"]`);
    await expect(event).toBeVisible();
    await expect(event).toContainText(description);
    await expect(event).toContainText(`14:30 · −${formatGs(50000)}`);

    const column = await box(page.locator('[data-day="2026-01-07"]'));
    const eventBox = await box(event);
    expect(Math.abs(eventBox.y - column.y - 14.5 * HOUR_HEIGHT)).toBeLessThanOrEqual(4);

    await expect(page.getByRole("heading", { level: 2, name: "5 – 11 ene 2026" })).toBeVisible();
    await page.goto(calendarUrl("", accountA, "2026-01-08"));
    await expect(page.getByRole("heading", { level: 2, name: "5 – 11 ene 2026" })).toBeVisible();
  });

  test("P.3 — arrastrar a otro día/hora escribe la fecha; soltar en el mismo lugar no escribe", async ({
    page,
  }) => {
    const id = await insertMovement(`${prefix} drag`, "2026-01-07T14:30:00");

    await openCalendar(page, calendarUrl());
    await expect(block(page, id)).toBeVisible();

    // Sin cambio: soltar en el mismo minuto no hace ninguna escritura.
    const patches: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "PATCH") {
        patches.push(request.url());
      }
    });
    await dragToDay(page, id, "2026-01-07", 14 * 60 + 30);
    // El movimiento optimista cambiaría `top` de inmediato si el drop hubiera movido el bloque.
    await expect(block(page, id)).toHaveCSS("top", `${(870 / 60) * HOUR_HEIGHT}px`);
    await page.waitForLoadState("networkidle");
    expect(patches).toHaveLength(0);
    expect(await dbDate(id)).toBe("2026-01-07T14:30:00");
    await expect(page.locator(`[data-day="2026-01-07"] [data-movement-id="${id}"]`)).toBeVisible();

    await dragToDay(page, id, "2026-01-09", 10 * 60);
    await expect(page.locator(`[data-day="2026-01-09"] [data-movement-id="${id}"]`)).toBeVisible();
    await expect.poll(() => dbDate(id)).toBe("2026-01-09T10:00:00");

    await page.reload();
    const moved = page.locator(`[data-day="2026-01-09"] [data-movement-id="${id}"]`);
    await expect(moved).toBeVisible();
    await expect(moved).toContainText("10:00");
    // El drag no abrió la edición (P.12).
    await expect(page).toHaveURL(/view=calendar/);
  });

  test("P.4 — banda 'Sin hora' y mover entre banda y grilla", async ({ page }) => {
    const id = await insertMovement(`${prefix} sin hora`, "2026-01-06T00:00:00");
    const other = await insertMovement(`${prefix} otro`, "2026-01-07T14:30:00");

    await openCalendar(page, calendarUrl());

    await expect(page.locator(`[data-allday="2026-01-06"] [data-movement-id="${id}"]`)).toBeVisible();
    await expect(page.locator(`[data-day="2026-01-06"] [data-movement-id="${id}"]`)).toHaveCount(0);

    await dragToDay(page, id, "2026-01-06", 9 * 60);
    await expect.poll(() => dbDate(id)).toBe("2026-01-06T09:00:00");
    await expect(page.locator(`[data-day="2026-01-06"] [data-movement-id="${id}"]`)).toBeVisible();
    await expect(page.locator(`[data-allday="2026-01-06"] [data-movement-id="${id}"]`)).toHaveCount(0);

    await dragToLocator(page, other, page.locator('[data-allday="2026-01-10"]'));
    await expect.poll(() => dbDate(other)).toBe("2026-01-10T00:00:00");
    await expect(page.locator(`[data-allday="2026-01-10"] [data-movement-id="${other}"]`)).toBeVisible();
  });

  test("P.5 — banda con 4 movimientos: '+1 más' / 'Mostrar menos'", async ({ page }) => {
    for (let i = 0; i < 4; i++) {
      await insertMovement(`${prefix} banda ${i}`, "2026-01-08T00:00:00");
    }

    await openCalendar(page, calendarUrl());

    const cell = page.locator('[data-allday="2026-01-08"]');
    await expect(cell.locator("[data-movement-id]")).toHaveCount(3);
    await cell.getByRole("button", { name: "+1 más" }).click();
    await expect(cell.locator("[data-movement-id]")).toHaveCount(4);
    await expect(cell.getByRole("button", { name: "Mostrar menos" })).toBeVisible();
  });

  test("P.6 — 5 movimientos a la misma hora: 2 bloques y chip '+3' con popover", async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await insertMovement(`${prefix} solapado ${i}`, "2026-01-05T12:00:00");
    }

    await openCalendar(page, calendarUrl());

    const column = page.locator('[data-day="2026-01-05"]');
    await expect(column.locator("[data-movement-id]")).toHaveCount(2);
    await column.getByRole("button", { name: "+3" }).click();

    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await expect(popover.getByRole("link")).toHaveCount(3);
    await expect(popover.getByRole("link").first()).toContainText(prefix);
  });

  test("P.7 — arrastrar una transferencia mueve las dos patas", async ({ page }) => {
    const { data: transferId, error } = await supabase.rpc("create_transfer", {
      p_from_account_id: accountA,
      p_to_account_id: accountB,
      p_amount: 30000,
      p_date: "2026-01-07T12:00",
      p_description: `${prefix} transferencia`,
    });

    if (error) {
      throw new Error(error.message);
    }

    await openCalendar(page, calendarUrl());

    const event = page.locator('[data-day="2026-01-07"] [data-movement-id]');
    await expect(event).toHaveCount(1);
    const id = (await event.getAttribute("data-movement-id"))!;

    await dragToDay(page, id, "2026-01-08", 15 * 60);

    await expect
      .poll(async () => {
        const { data } = await supabase
          .from("movements")
          .select("date")
          .eq("transfer_id", transferId);

        return (data ?? []).map((row) => row.date).sort();
      })
      .toEqual(["2026-01-08T15:00:00", "2026-01-08T15:00:00"]);
  });

  test("P.8 — navegación de semana, filtros y totales", async ({ page }) => {
    await insertMovement(`${prefix} almuerzo`, "2026-01-07T14:30:00");

    await openCalendar(page, calendarUrl());

    await page.getByRole("link", { name: "Semana siguiente" }).click();
    await expect(page).toHaveURL(/week=2026-01-12/);
    await expect(page.getByRole("heading", { level: 2, name: "12 – 18 ene 2026" })).toBeVisible();
    await page.getByRole("link", { name: "Semana anterior" }).click();
    await expect(page).toHaveURL(/week=2026-01-05/);
    await expect(page.getByRole("heading", { level: 2, name: "5 – 11 ene 2026" })).toBeVisible();

    // Totales de la semana visible, no de todo el historial.
    await expect(totalCard(page, "Egresos")).toContainText(formatGs(50000));

    // El filtro de período no se ve en calendario.
    await expect(page.getByText("Período")).toHaveCount(0);
    await expect(page.getByLabel("Desde")).toHaveCount(0);

    const { data: type } = await supabase
      .from("movement_types")
      .select("name")
      .eq("id", typeId)
      .single();
    await page.getByRole("combobox").filter({ hasText: "Todos los tipos" }).click();
    await page.getByRole("option", { name: type!.name }).first().click();
    await expect(page).toHaveURL(/movementTypeId=/);
    await expect(page).toHaveURL(/view=calendar/);
    await expect(page).toHaveURL(/week=2026-01-05/);

    await page.getByText("Limpiar filtros").click();
    await expect(page).toHaveURL(/view=calendar/);
    await expect(page).toHaveURL(/week=2026-01-05/);
    await expect(page).toHaveURL(/accountId=all/);

    // "Hoy": la etiqueta contiene el día de hoy en America/Asuncion.
    await page.getByRole("link", { name: "Hoy" }).click();
    const today = todayInAsuncion();
    await expect(page).toHaveURL(new RegExp(`week=${today}`));
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const month = months[Number(today.slice(5, 7)) - 1];
    const label = await page.getByRole("heading", { level: 2 }).textContent();
    expect(label).toContain(month);
    // El día de hoy está dentro del rango impreso (lunes..domingo de esa semana).
    expect(label).toMatch(/\d/);
    await expect(page.locator(`[data-day="${today}"]`)).toBeVisible();
  });

  test("P.9 — semana sin datos: aviso y grilla igual", async ({ page }) => {
    await page.goto(calendarUrl("", accountB, "2025-06-02"));
    await expect(page.getByText("No hay movimientos en esta semana.")).toBeVisible();
    await expect(page.locator("[data-day]")).toHaveCount(7);
  });

  test.describe("mobile", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("P.10 — un día, tira de 7 botones y arrastre sobre la tira", async ({ page }) => {
      const id = await insertMovement(`${prefix} almuerzo`, "2026-01-07T14:30:00");

      await page.goto(calendarUrl());
      await expect(page.locator("[data-day]").first()).toBeVisible();
      await expect(page.locator("[data-day]")).toHaveCount(1);

      for (const name of ["LUN 5", "MAR 6", "MIÉ 7", "JUE 8", "VIE 9", "SÁB 10", "DOM 11"]) {
        await expect(page.getByRole("button", { name })).toBeVisible();
      }

      await page.getByRole("button", { name: "MIÉ 7" }).click();
      await expect(page).toHaveURL(/day=2026-01-07/);
      await expect(block(page, id)).toBeAttached();

      // Deja el bloque y la tira a la vista a la vez.
      await scrollGrid(page, 14 * HOUR_HEIGHT);
      await page.getByRole("button", { name: "VIE 9" }).scrollIntoViewIfNeeded();
      await expect(block(page, id)).toBeInViewport();
      await expect(page.getByRole("button", { name: "VIE 9" })).toBeInViewport();

      await dragToLocator(page, id, page.getByRole("button", { name: "VIE 9" }));
      await expect.poll(() => dbDate(id)).toBe("2026-01-09T14:30:00");
    });
  });

  test("P.11 — PATCH falla: toast y el bloque vuelve", async ({ page }) => {
    const id = await insertMovement(`${prefix} falla`, "2026-01-07T14:30:00");

    await page.route("**/rest/v1/movements*", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      } else {
        await route.continue();
      }
    });

    await openCalendar(page, calendarUrl());
    await dragToDay(page, id, "2026-01-09", 10 * 60);

    await expect(page.getByText("No se pudo mover el movimiento")).toBeVisible();
    await expect(page.locator(`[data-day="2026-01-07"] [data-movement-id="${id}"]`)).toBeVisible();
    await expect(page.locator(`[data-day="2026-01-09"] [data-movement-id="${id}"]`)).toHaveCount(0);
    expect(await dbDate(id)).toBe("2026-01-07T14:30:00");
  });

  test("P.12 — click abre la edición con returnTo y Guardar vuelve al calendario", async ({ page }) => {
    const id = await insertMovement(`${prefix} click`, "2026-01-07T14:30:00");

    await openCalendar(page, calendarUrl());
    await block(page, id).click();
    await expect(page).toHaveURL(new RegExp(`/protected/movements/edit/${id}\\?returnTo=`));

    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(/view=calendar/);
    await expect(page).toHaveURL(new RegExp(`accountId=${accountA}`));
    await expect(page).toHaveURL(/week=2026-01-05/);
  });

  test("P.12 — click en una transferencia abre la edición de la transferencia", async ({ page }) => {
    const { data: transferId, error } = await supabase.rpc("create_transfer", {
      p_from_account_id: accountA,
      p_to_account_id: accountB,
      p_amount: 30000,
      p_date: "2026-01-07T12:00",
      p_description: `${prefix} transferencia`,
    });

    if (error) {
      throw new Error(error.message);
    }

    await openCalendar(page, calendarUrl());
    await page.locator('[data-day="2026-01-07"] [data-movement-id]').click();
    await expect(page).toHaveURL(
      new RegExp(`/protected/transfers/edit/${transferId}\\?returnTo=`)
    );
  });

  test("P.13 — línea de hora actual solo en la columna de hoy", async ({ page }) => {
    await page.goto(`/protected/movements?view=calendar&accountId=${accountA}`);
    await expect(page.locator("[data-day]").first()).toBeVisible();
    await expect(page.locator(`[data-day="${todayInAsuncion()}"] [data-now-line]`)).toHaveCount(1);
    await expect(page.locator("[data-now-line]")).toHaveCount(1);

    await page.goto(calendarUrl());
    await expect(page.locator("[data-day]").first()).toBeVisible();
    await expect(page.locator("[data-now-line]")).toHaveCount(0);
  });
});
