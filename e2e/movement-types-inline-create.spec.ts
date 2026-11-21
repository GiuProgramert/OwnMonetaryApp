import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { qaSupabase, uniqueName } from "./helpers/supabase";

const TRANSFER_TYPE_ID = "e7f1b48a-be01-48a5-9982-5a4d4025493c";
const CREATE = "/protected/movements/create";
const NOT_OWNER = "Solo el dueño de la app puede crear tipos de movimiento";

const stripAccents = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "");

const field = (page: Page) => page.getByLabel("Tipo de movimiento");
const search = (page: Page) => page.getByPlaceholder("Buscar tipo…");
const dialog = (page: Page) => page.getByRole("dialog");
// El label "Descripción" del modal comparte id con el del movimiento, así que se localiza por name.
const dialogDescription = (page: Page) => dialog(page).locator('input[name="description"]');
const dialogName = (page: Page) => dialog(page).locator('input[name="name"]');

async function openCreateDialog(page: Page, name: string) {
  await field(page).click();
  await search(page).fill(name);
  await page.getByRole("option", { name: `Crear «${name}»` }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(search(page)).toBeHidden();
}

test.describe("crear tipo de movimiento desde el formulario del movimiento", () => {
  let supabase: SupabaseClient;
  let accountId: string;
  let accountName: string;
  let typeName: string;
  const movementIds: string[] = [];

  test.beforeAll(async () => {
    supabase = await qaSupabase();
    accountName = uniqueName("movement-types-inline");
    const { data: account, error } = await supabase
      .from("accounts")
      .insert({ name: accountName, color: "#112233", current_balance: 0 })
      .select("id")
      .single();
    if (error) {
      throw new Error(`No se pudo crear la cuenta de prueba: ${error.message}`);
    }
    accountId = account.id;

    const { data: types } = await supabase
      .from("movement_types")
      .select("id, name")
      .neq("id", TRANSFER_TYPE_ID);
    const candidate = (types ?? []).find(
      (t) => t.name.length >= 4 && stripAccents(t.name).toLowerCase().slice(0, 4).trim().length === 4
    );
    if (!candidate) {
      throw new Error("No hay un tipo existente con nombre de 4 o más caracteres");
    }
    typeName = candidate.name;
  });

  test.afterAll(async () => {
    if (movementIds.length > 0) {
      await supabase.from("movements").delete().in("id", movementIds);
    }
    if (accountId) {
      await supabase.from("accounts").delete().eq("id", accountId);
    }
  });

  test("P.1 — buscar sin acentos ni mayúsculas, elegir y guardar el movimiento", async ({
    page,
  }) => {
    const description = uniqueName("movement-types-inline", "p1");
    const prefix = stripAccents(typeName).toLowerCase().slice(0, 4);

    await page.goto(CREATE);
    await field(page).click();
    await search(page).fill(prefix);
    const option = page.getByRole("option", { name: typeName, exact: true }).first();
    await expect(option).toBeVisible();
    await option.click();
    await expect(field(page)).toContainText(typeName);

    await page.getByLabel("Descripción").fill(description);
    await page.getByLabel("Monto").fill("1000");
    await page.locator("#type").click();
    await page.getByRole("option", { name: "Débito" }).click();
    await page.locator("#account_id").click();
    await page.getByRole("option", { name: accountName }).click();
    await page.getByRole("button", { name: "Crear", exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`/protected/movements\\?accountId=${accountId}`));
    const row = page.getByRole("row").filter({ hasText: description });
    await expect(row).toBeVisible();
    await expect(row).toContainText(typeName);

    const { data } = await supabase.from("movements").select("id").eq("description", description);
    movementIds.push(...(data ?? []).map((m) => m.id));
  });

  test("P.2 — el nombre exacto en mayúsculas no ofrece crear", async ({ page }) => {
    await page.goto(CREATE);
    await field(page).click();
    await search(page).fill(typeName.toUpperCase());
    await expect(page.getByRole("option", { name: typeName, exact: true }).first()).toBeVisible();
    await expect(page.getByRole("option", { name: /^Crear «/ })).toHaveCount(0);
  });

  test("P.3 — Crear «X» abre el modal con el nombre cargado, con Enter y con clic", async ({
    page,
  }) => {
    const name = uniqueName("movement-types-inline", "p3");
    await page.goto(CREATE);
    await field(page).click();
    await search(page).fill(name);
    await expect(page.getByRole("option", { name: `Crear «${name}»` })).toBeVisible();
    await search(page).press("Enter");
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByText("Nuevo tipo de movimiento")).toBeVisible();
    await expect(dialogName(page)).toHaveValue(name);
    await expect(search(page)).toBeHidden();

    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);

    await field(page).click();
    await search(page).fill(name);
    await page.getByRole("option", { name: `Crear «${name}»` }).click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialogName(page)).toHaveValue(name);
  });

  test("P.4 — usuario no dueño: toast, modal abierto y el movimiento intacto", async ({
    page,
  }) => {
    const name = uniqueName("movement-types-inline", "p4");
    await page.goto(CREATE);
    await page.getByLabel("Descripción").fill("inline-test");
    await page.getByLabel("Monto").fill("5000");

    await openCreateDialog(page, name);
    await dialogDescription(page).fill("desc del tipo");
    await dialog(page).getByRole("button", { name: "Crear", exact: true }).click();

    await expect(page.getByText(NOT_OWNER)).toBeVisible();
    await expect(dialog(page)).toBeVisible();
    await expect(page).toHaveURL(/\/protected\/movements\/create/);

    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByLabel("Descripción")).toHaveValue("inline-test");
    await expect(page.getByLabel("Monto")).toHaveValue("5.000");
    await expect(page).toHaveURL(/\/protected\/movements\/create/);

    const { data } = await supabase
      .from("movements")
      .select("id")
      .eq("account_id", accountId)
      .eq("description", "inline-test");
    expect(data ?? []).toHaveLength(0);
  });

  test("P.5 — camino exitoso con respuesta simulada: queda seleccionado", async ({ page }) => {
    const name = uniqueName("movement-types-inline", "p5");
    await page.route("**/rest/v1/movement_types*", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const now = new Date().toISOString();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          name,
          description: "d",
          color: "#6B7280",
          exclude_from_expense_charts: false,
          created_at: now,
          updated_at: now,
        }),
      });
    });

    await page.goto(CREATE);
    await openCreateDialog(page, name);
    await dialogDescription(page).fill("d");
    await dialog(page).getByRole("button", { name: "Crear", exact: true }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByText("Tipo de movimiento creado")).toBeVisible();
    await expect(field(page)).toContainText(name);

    await field(page).click();
    await expect(page.getByRole("option", { name, exact: true })).toBeVisible();
  });

  test("P.6 — descripción vacía muestra el error dentro del modal solamente", async ({
    page,
  }) => {
    const name = uniqueName("movement-types-inline", "p6");
    await page.goto(CREATE);
    await openCreateDialog(page, name);
    await dialog(page).getByRole("button", { name: "Crear", exact: true }).click();

    await expect(dialog(page).getByText("La descripción es requerida")).toBeVisible();
    await expect(page.getByText("La descripción es requerida")).toHaveCount(1);
  });

  test("P.7 — cerrar el modal con Escape conserva el tipo elegido", async ({ page }) => {
    const name = uniqueName("movement-types-inline", "p7");
    await page.goto(CREATE);
    await field(page).click();
    await page.getByRole("option", { name: typeName, exact: true }).first().click();
    await expect(field(page)).toContainText(typeName);

    await openCreateDialog(page, name);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(field(page)).toContainText(typeName);
  });

  test("P.8 — en mobile el modal muestra todo y no hay scroll horizontal", async ({ page }) => {
    const name = uniqueName("movement-types-inline", "p8");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(CREATE);
    await openCreateDialog(page, name);

    const d = dialog(page);
    await expect(d.getByText("Nuevo tipo de movimiento")).toBeVisible();
    await expect(dialogName(page)).toBeVisible();
    await expect(dialogDescription(page)).toBeVisible();
    await expect(d.locator('input[type="color"]')).toBeVisible();
    await expect(d.getByText("Excluir de los gráficos de gastos")).toBeVisible();
    const submit = d.getByRole("button", { name: "Crear", exact: true });
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });

  test("P.9 — en la edición el campo muestra el tipo actual y ofrece crear", async ({ page }) => {
    const description = uniqueName("movement-types-inline", "p9");
    const { data: type } = await supabase
      .from("movement_types")
      .select("id")
      .eq("name", typeName)
      .limit(1)
      .single();
    const { data: movement, error } = await supabase
      .from("movements")
      .insert({
        description,
        amount: 1000,
        type: "debit",
        account_id: accountId,
        movement_type_id: type!.id,
      })
      .select("id")
      .single();
    if (error) {
      throw new Error(`No se pudo crear el movimiento: ${error.message}`);
    }
    movementIds.push(movement.id);

    const name = uniqueName("movement-types-inline", "p9n");
    await page.goto(`/protected/movements/edit/${movement.id}`);
    await expect(field(page)).toContainText(typeName);
    await openCreateDialog(page, name);
    await expect(dialogName(page)).toHaveValue(name);
  });
  test("I-1 — clic directo en Crear con una expresión sin resolver guarda 30.000", async ({
    page,
  }) => {
    const description = uniqueName("movement-types-inline", "i1");
    await page.goto(`${CREATE}?accountId=${accountId}`);
    await page.getByLabel("Descripción").fill(description);
    await page.locator("#type").click();
    await page.getByRole("option", { name: "Débito" }).click();
    await page.locator("#account_id").click();
    await page.getByRole("option", { name: accountName }).click();
    await field(page).click();
    await page.getByRole("option", { name: typeName, exact: true }).first().click();
    await page.getByLabel("Monto").pressSequentially("=20000+10000");
    await page.getByRole("button", { name: "Crear", exact: true }).click();

    await expect(page).toHaveURL(/\/protected\/movements(\?|$)/);
    const { data } = await supabase
      .from("movements")
      .select("id, amount")
      .eq("description", description);
    movementIds.push(...(data ?? []).map((m) => m.id));
    expect(data).toHaveLength(1);
    expect(Number(data![0].amount)).toBe(30000);
  });

  test("I-2 — el modal no duplica ids y su label apunta a su input", async ({ page }) => {
    const name = uniqueName("movement-types-inline", "i2");
    await page.goto(CREATE);
    await openCreateDialog(page, name);

    await expect(dialog(page).getByLabel("Descripción")).toHaveAttribute("name", "description");
    await expect(dialog(page).getByLabel("Nombre")).toHaveValue(name);
    const duplicated = await page.evaluate(() => {
      const seen = new Set<string>();
      const dups: string[] = [];
      document.querySelectorAll("[id]").forEach((el) => {
        if (seen.has(el.id)) {
          dups.push(el.id);
        }
        seen.add(el.id);
      });
      return dups;
    });
    expect(duplicated).toEqual([]);
  });

  test("C-1 — el buscador del combobox no muestra el contorno de foco del navegador", async ({
    page,
  }, testInfo) => {
    await page.goto(CREATE);
    await field(page).click();
    await search(page).click();
    await expect(search(page)).toBeFocused();

    const style = await search(page).evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        outlineStyle: cs.outlineStyle,
        outlineWidth: cs.outlineWidth,
        outlineColor: cs.outlineColor,
        boxShadow: cs.boxShadow,
      };
    });
    // Tailwind 3 `outline-none` = outline 2px solid transparent: invisible, no es el contorno del navegador.
    const invisible =
      style.outlineStyle === "none" ||
      style.outlineWidth === "0px" ||
      style.outlineColor === "rgba(0, 0, 0, 0)";
    expect(invisible).toBe(true);
    expect(style.boxShadow).toBe("none");
    await page.screenshot({ path: testInfo.outputPath("c1-search-focus.png") });

    // El ítem activo sigue resaltado con ArrowDown.
    await search(page).press("ArrowDown");
    const active = page.locator('[role="option"][data-selected="true"], [role="option"][aria-selected="true"]');
    await expect(active.first()).toBeVisible();
    const bg = await active.first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("C-1 — el botón de cerrar del modal tiene foco visible con teclado", async ({ page }) => {
    const name = uniqueName("movement-types-inline", "c1");
    await page.goto(CREATE);
    await openCreateDialog(page, name);
    const close = dialog(page).getByRole("button", { name: /cerrar|close/i });
    await close.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    const ring = await close.evaluate((el) => {
      const cs = getComputedStyle(el);
      return cs.boxShadow !== "none" || (cs.outlineStyle !== "none" && cs.outlineWidth !== "0px");
    });
    expect(ring).toBe(true);
  });
});
