import { expect, test, type Locator, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { qaSupabase, uniqueName } from "./helpers/supabase";

const HOUR_HEIGHT = 64;
const WEEK = "2026-01-05";
const TRANSFER_TYPE_ID = "e7f1b48a-be01-48a5-9982-5a4d4025493c";

const formatGs = (amount: number) => `Gs. ${amount.toLocaleString("es-PY")}`;

test.describe("popover de detalle del calendario", () => {
  test.use({ viewport: { width: 1280, height: 1600 } });

  let supabase: SupabaseClient;
  let accountA = "";
  let accountB = "";
  let accountAName = "";
  let typeId = "";
  let typeName = "";
  const prefix = uniqueName("calpopover");

  const calendarUrl = (extra = "") =>
    `/protected/movements?view=calendar&accountId=${accountA}&week=${WEEK}${extra}`;

  async function insertMovement(description: string, date: string) {
    const { data, error } = await supabase
      .from("movements")
      .insert({
        account_id: accountA,
        movement_type_id: typeId,
        description,
        amount: 50000,
        type: "debit",
        date,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data.id as string;
  }

  async function createTransfer(description: string) {
    const { data, error } = await supabase.rpc("create_transfer", {
      p_from_account_id: accountA,
      p_to_account_id: accountB,
      p_amount: 30000,
      p_date: "2026-01-07T12:00",
      p_description: description,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data as string;
  }

  async function rowExists(id: string) {
    const { data } = await supabase.from("movements").select("id").eq("id", id);

    return (data ?? []).length > 0;
  }

  async function dbDate(id: string) {
    const { data } = await supabase.from("movements").select("date").eq("id", id).single();

    return data?.date as string | undefined;
  }

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
  const dialog = (page: Page, name: string) => page.getByRole("dialog", { name });

  async function box(locator: Locator) {
    const b = await locator.boundingBox();

    if (!b) {
      throw new Error("Elemento sin bounding box");
    }

    return b;
  }

  async function dragToDay(page: Page, id: string, day: string, minutes: number) {
    const source = await box(block(page, id));
    const column = await box(page.locator(`[data-day="${day}"]`));
    const startX = source.x + source.width / 2;
    const startY = source.y + 4;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 8, startY + 8, { steps: 3 });
    await page.mouse.move(
      column.x + column.width / 2,
      column.y + (minutes / 60) * HOUR_HEIGHT + 4,
      { steps: 15 }
    );
    await page.mouse.up();
  }

  test.beforeAll(async () => {
    supabase = await qaSupabase();
    accountAName = uniqueName("calpopover", "a");

    const { data: accounts, error } = await supabase
      .from("accounts")
      .insert([{ name: accountAName }, { name: uniqueName("calpopover", "b") }])
      .select("id, name")
      .order("name");

    if (error) {
      throw new Error(error.message);
    }

    accountA = accounts[0].id;
    accountB = accounts[1].id;

    const { data: type } = await supabase
      .from("movement_types")
      .select("id, name")
      .neq("id", TRANSFER_TYPE_ID)
      .limit(1)
      .single();

    typeId = type!.id;
    typeName = type!.name;
  });

  test.afterEach(async () => {
    await supabase.from("movements").delete().in("account_id", [accountA, accountB]);
  });

  test.afterAll(async () => {
    await supabase.from("accounts").delete().in("id", [accountA, accountB]);
  });

  test("P.1 — click en el bloque abre el popover con el detalle y no cambia la URL", async ({
    page,
  }) => {
    const description = `${prefix} detalle`;
    const id = await insertMovement(description, "2026-01-07T14:30:00");

    await openCalendar(page, calendarUrl());
    const url = page.url();
    await block(page, id).click();

    const popover = dialog(page, description);
    await expect(popover).toBeVisible();
    await expect(popover).toContainText("Miércoles, 7 de enero · 14:30");
    await expect(popover).toContainText(`−${formatGs(50000)}`);
    await expect(popover).toContainText(accountAName);
    await expect(popover).toContainText(typeName);
    expect(page.url()).toBe(url);
    await expect(page).toHaveURL(/view=calendar/);
  });

  test("P.2 — Cerrar, Escape y click fuera cierran el popover", async ({ page }) => {
    const description = `${prefix} cierre`;
    const id = await insertMovement(description, "2026-01-07T14:30:00");

    await openCalendar(page, calendarUrl());
    const url = page.url();
    const popover = dialog(page, description);

    await block(page, id).click();
    await expect(popover).toBeVisible();
    await popover.getByRole("button", { name: "Cerrar" }).click();
    await expect(popover).toHaveCount(0);

    await block(page, id).click();
    await expect(popover).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);

    await block(page, id).click();
    await expect(popover).toBeVisible();
    const column = await box(page.locator('[data-day="2026-01-10"]'));
    await page.mouse.click(column.x + column.width / 2, column.y + 100);
    await expect(popover).toHaveCount(0);

    expect(page.url()).toBe(url);
    expect(await rowExists(id)).toBe(true);
  });

  test("P.3 — Editar lleva a la edición con returnTo y Guardar vuelve al calendario", async ({
    page,
  }) => {
    const description = `${prefix} editar`;
    const id = await insertMovement(description, "2026-01-07T14:30:00");

    await openCalendar(page, calendarUrl());
    await block(page, id).click();
    await dialog(page, description).getByRole("link", { name: "Editar" }).click();
    await expect(page).toHaveURL(new RegExp(`/protected/movements/edit/${id}\\?returnTo=`));

    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(/view=calendar/);
    await expect(page).toHaveURL(new RegExp(`accountId=${accountA}`));
    await expect(page).toHaveURL(/week=2026-01-05/);
  });

  test("P.4 — transferencia: popover muestra 'Transferencia' y Editar va a transfers/edit", async ({
    page,
  }) => {
    const description = `${prefix} transferencia`;
    const transferId = await createTransfer(description);

    await openCalendar(page, calendarUrl());
    await page.locator('[data-day="2026-01-07"] [data-movement-id]').click();

    const popover = dialog(page, description);
    await expect(popover).toContainText("Transferencia");
    await popover.getByRole("link", { name: "Editar" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/protected/transfers/edit/${transferId}\\?returnTo=`)
    );
  });

  test("P.5 — Eliminar lleva a la página de borrado; confirmar borra y Cancelar conserva", async ({
    page,
  }) => {
    const description = `${prefix} borrar`;
    const keepDescription = `${prefix} conservar`;
    const id = await insertMovement(description, "2026-01-07T14:30:00");
    const keepId = await insertMovement(keepDescription, "2026-01-08T10:00:00");

    await openCalendar(page, calendarUrl());
    await block(page, id).click();
    await dialog(page, description).getByRole("link", { name: "Eliminar" }).click();
    await expect(page).toHaveURL(new RegExp(`/protected/movements/delete/${id}\\?returnTo=`));
    await page.getByRole("button", { name: "Eliminar" }).click();

    await expect(page).toHaveURL(/view=calendar/);
    await expect(page).toHaveURL(/week=2026-01-05/);
    await expect(page.locator("[data-day]").first()).toBeVisible();
    await expect(block(page, id)).toHaveCount(0);
    expect(await rowExists(id)).toBe(false);

    await scrollGrid(page, 5 * HOUR_HEIGHT);
    await block(page, keepId).click();
    await dialog(page, keepDescription).getByRole("link", { name: "Eliminar" }).click();
    await expect(page).toHaveURL(new RegExp(`/protected/movements/delete/${keepId}\\?returnTo=`));
    await page.getByRole("button", { name: "Cancelar" }).click();

    await expect(page).toHaveURL(/view=calendar/);
    await expect(page).toHaveURL(/week=2026-01-05/);
    await expect(page.locator("[data-day]").first()).toBeVisible();
    await expect(block(page, keepId)).toHaveCount(1);
    expect(await rowExists(keepId)).toBe(true);
  });

  test("P.6 — Eliminar una transferencia va directo a transfers/delete y borra las dos patas", async ({
    page,
  }) => {
    const description = `${prefix} transferencia borrar`;
    const transferId = await createTransfer(description);

    await openCalendar(page, calendarUrl());
    await page.locator('[data-day="2026-01-07"] [data-movement-id]').click();
    await dialog(page, description).getByRole("link", { name: "Eliminar" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/protected/transfers/delete/${transferId}\\?returnTo=`)
    );
    await page.getByRole("button", { name: "Eliminar" }).click();

    await expect(page).toHaveURL(/view=calendar/);
    await expect(page).toHaveURL(/week=2026-01-05/);
    await expect
      .poll(async () => {
        const { data } = await supabase
          .from("movements")
          .select("id")
          .eq("transfer_id", transferId);

        return (data ?? []).length;
      })
      .toBe(0);
  });

  test("P.7 — movimiento a las 00:00 en la banda 'Sin hora' dice 'Sin hora'", async ({ page }) => {
    const description = `${prefix} sin hora`;
    const id = await insertMovement(description, "2026-01-08T00:00:00");

    await openCalendar(page, calendarUrl());
    await page.locator(`[data-allday="2026-01-08"] [data-movement-id="${id}"]`).click();
    await expect(dialog(page, description)).toContainText("Jueves, 8 de enero · Sin hora");
  });

  test("P.8 — la lista del chip '+3' abre el popover del ítem elegido", async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await insertMovement(`${prefix} solapado ${i}`, "2026-01-05T12:00:00");
    }

    await openCalendar(page, calendarUrl());
    const url = page.url();
    const column = page.locator('[data-day="2026-01-05"]');
    await column.getByRole("button", { name: "+3" }).click();

    const list = page.locator("[data-radix-popper-content-wrapper]");
    const items = list.getByRole("button");
    await expect(items).toHaveCount(3);
    await expect(items.first()).toContainText(prefix);

    const text = (await items.first().textContent()) ?? "";
    const description = text.match(new RegExp(`${prefix} solapado \\d`))![0];
    await items.first().click();

    const popover = dialog(page, description);
    await expect(popover).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    expect(page.url()).toBe(url);
  });

  test("P.9 — click en otro bloque cambia el detalle; queda un solo dialog", async ({ page }) => {
    const first = await insertMovement(`${prefix} primero`, "2026-01-06T09:00:00");
    const second = await insertMovement(`${prefix} segundo`, "2026-01-08T16:00:00");

    await openCalendar(page, calendarUrl());
    await block(page, first).click();
    await expect(dialog(page, `${prefix} primero`)).toBeVisible();

    await block(page, second).click();
    await expect(dialog(page, `${prefix} segundo`)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
  });

  test("P.10 — arrastrar un bloque no deja ningún dialog abierto y escribe la fecha", async ({
    page,
  }) => {
    const id = await insertMovement(`${prefix} arrastre`, "2026-01-07T14:30:00");

    await openCalendar(page, calendarUrl());
    await dragToDay(page, id, "2026-01-09", 10 * 60);

    await expect.poll(() => dbDate(id)).toBe("2026-01-09T10:00:00");
    await expect(page.locator(`[data-day="2026-01-09"] [data-movement-id="${id}"]`)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/view=calendar/);
  });

  test.describe("mobile", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("P.11 — el popover entra completo en el viewport", async ({ page }) => {
      const description = `${prefix} movil`;
      const id = await insertMovement(description, "2026-01-07T14:30:00");

      await openCalendar(page, calendarUrl("&day=2026-01-07"), 12 * HOUR_HEIGHT);
      await block(page, id).click();

      const popover = dialog(page, description);
      await expect(popover).toBeVisible();
      const b = await box(popover);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(390);
    });
  });

  test("P.12 — Tab + Enter abre el popover y Escape devuelve el foco al bloque", async ({
    page,
  }) => {
    const description = `${prefix} teclado`;
    const id = await insertMovement(description, "2026-01-07T14:30:00");

    await openCalendar(page, calendarUrl());
    const target = block(page, id);
    await target.focus();
    await expect(target).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(dialog(page, description)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page, description)).toHaveCount(0);
    await expect(target).toBeFocused();
  });
});
