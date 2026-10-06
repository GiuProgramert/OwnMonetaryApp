import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { qaSupabase, uniqueName } from "./helpers/supabase";

const TRANSFER_TYPE_ID = "e7f1b48a-be01-48a5-9982-5a4d4025493c";
const CREATE = "/protected/movements/create";

const formatGs = (amount: number) => `Gs. ${amount.toLocaleString("es-PY")}`;
const amountField = (page: Page) => page.getByLabel("Monto");
const btn = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

function todayAsuncion() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(
    new Date()
  );
}

async function typeKeys(page: Page, text: string) {
  await amountField(page).pressSequentially(text);
}

test.describe("calculadora en el campo de monto", () => {
  test("P.1 — modo normal sin cambios, botón Calculadora visible y sin operadores", async ({
    page,
  }) => {
    await page.goto(CREATE);
    await amountField(page).fill("40000");
    await expect(amountField(page)).toHaveValue("40.000");
    await expect(btn(page, "Calculadora")).toBeVisible();
    await expect(btn(page, "Sumar")).toHaveCount(0);
  });

  test("P.2 — expresión con formateo en vivo, vista previa y Enter resuelve sin enviar", async ({
    page,
  }) => {
    await page.goto(CREATE);
    await typeKeys(page, "=20000+10000");
    await expect(amountField(page)).toHaveValue("=20.000+10.000");
    await expect(page.getByText("= 30.000", { exact: true })).toBeVisible();
    await amountField(page).press("Enter");
    await expect(amountField(page)).toHaveValue("30.000");
    await expect(page).toHaveURL(/\/protected\/movements\/create/);
    await expect(page.getByText("La descripción es requerida")).toHaveCount(0);
    await expect(btn(page, "Sumar")).toHaveCount(0);
  });

  test("P.3 — resultados de expresiones", async ({ page }) => {
    const cases: [string, string][] = [
      ["=2+3*4", "14"],
      ["=(2+3)*4", "20"],
      ["=3*25000", "75.000"],
      ["=100000-15000", "85.000"],
      ["=100000/3", "33.333"],
      ["=100000/3*3", "100.000"],
      ["=((1+2)*(3+4))", "21"],
      ["=5000", "5.000"],
    ];
    await page.goto(CREATE);
    for (const [expr, expected] of cases) {
      await amountField(page).fill("");
      await typeKeys(page, expr);
      await amountField(page).press("Enter");
      await expect(amountField(page), expr).toHaveValue(expected);
    }
  });

  test("P.4 — errores de cálculo", async ({ page }) => {
    const cases: [string, string][] = [
      ["=20000+", "Cálculo incompleto"],
      ["=(2+3", "Cálculo incompleto"],
      ["=2++3", "Cálculo incompleto"],
      ["=5/0", "No se puede dividir por cero"],
      ["=1000-5000", "El resultado debe ser mayor a cero"],
      ["=1/3", "El resultado debe ser mayor a cero"],
      ["=9999999999999*10", "El resultado es demasiado grande"],
    ];
    await page.goto(CREATE);
    for (const [expr, message] of cases) {
      await amountField(page).fill("");
      await typeKeys(page, expr);
      await amountField(page).press("Enter");
      await expect(page.getByText(message, { exact: true }), expr).toBeVisible();
      await expect(amountField(page), expr).toHaveValue(
        "=" + expr.slice(1).replace(/\d+/g, (d) => Number(d).toLocaleString("es-PY"))
      );
      await expect(page).toHaveURL(/\/protected\/movements\/create/);
      await typeKeys(page, "1");
      await expect(page.getByText(message, { exact: true }), expr).toHaveCount(0);
    }
  });

  test("P.5 — operador sobre un monto y Escape", async ({ page }) => {
    await page.goto(CREATE);
    await amountField(page).fill("40000");
    await typeKeys(page, "+");
    await expect(amountField(page)).toHaveValue("=40.000+");
    await typeKeys(page, "5000");
    await expect(amountField(page)).toHaveValue("=40.000+5.000");
    await amountField(page).press("Escape");
    await expect(amountField(page)).toHaveValue("40.000");
    await expect(btn(page, "Sumar")).toHaveCount(0);

    await amountField(page).fill("");
    await typeKeys(page, "+");
    await expect(amountField(page)).toHaveValue("");
    await typeKeys(page, "(");
    await expect(amountField(page)).toHaveValue("");

    await typeKeys(page, "=123");
    await amountField(page).press("Escape");
    await expect(amountField(page)).toHaveValue("");
  });

  test("P.6 — el cursor se conserva al reformatear", async ({ page }) => {
    await page.goto(CREATE);
    await typeKeys(page, "=20000+10000");
    for (let i = 0; i < 7; i++) {
      await amountField(page).press("ArrowLeft");
    }
    await typeKeys(page, "51");
    await expect(amountField(page)).toHaveValue("=2.000.051+10.000");
    await amountField(page).press("Enter");
    await expect(amountField(page)).toHaveValue("2.010.051");

    await amountField(page).fill("40000");
    for (let i = 0; i < 3; i++) {
      await amountField(page).press("ArrowLeft");
    }
    await typeKeys(page, "12");
    await expect(amountField(page)).toHaveValue("4.012.000");
  });

  test("P.7 — salir del campo resuelve", async ({ page }) => {
    await page.goto(CREATE);
    await typeKeys(page, "=20000+10000");
    await amountField(page).press("Tab");
    await expect(amountField(page)).toHaveValue("30.000");
    await expect(page.locator("#type")).toBeFocused();

    await amountField(page).fill("");
    await typeKeys(page, "=");
    await amountField(page).press("Tab");
    await expect(amountField(page)).toHaveValue("");
    await expect(page.getByText("Cálculo incompleto")).toHaveCount(0);

    await amountField(page).focus();
    await typeKeys(page, "=20000+");
    await amountField(page).press("Tab");
    await expect(amountField(page)).toHaveValue("=20.000+");
    await expect(page.getByText("Cálculo incompleto", { exact: true })).toBeVisible();
  });

  test("P.8 — mobile: botones de calculadora", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const noOverflow = async () => {
      const ok = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      );
      expect(ok, "scroll horizontal").toBe(true);
    };
    await page.goto(CREATE);
    await noOverflow();
    await btn(page, "Calculadora").click();
    await expect(amountField(page)).toHaveValue("=");
    await expect(amountField(page)).toBeFocused();
    for (const name of [
      "Sumar",
      "Restar",
      "Multiplicar",
      "Dividir",
      "Abrir paréntesis",
      "Cerrar paréntesis",
      "Calcular",
    ]) {
      await expect(btn(page, name)).toBeVisible();
    }
    await noOverflow();
    await page.keyboard.type("20000");
    await btn(page, "Sumar").click();
    await expect(amountField(page)).toHaveValue("=20.000+");
    await page.keyboard.type("10000");
    await expect(amountField(page)).toHaveValue("=20.000+10.000");
    await noOverflow();
    await btn(page, "Calcular").click();
    await expect(amountField(page)).toHaveValue("30.000");
    await expect(btn(page, "Sumar")).toHaveCount(0);
    await btn(page, "Calculadora").click();
    await expect(amountField(page)).toHaveValue("=30.000");
    await btn(page, "Multiplicar").click();
    await page.keyboard.type("2");
    await expect(amountField(page)).toHaveValue("=30.000*2");
    await noOverflow();
    await btn(page, "Cancelar cálculo").click();
    await expect(amountField(page)).toHaveValue("30.000");
    await noOverflow();
  });

  test.describe("con datos", () => {
    let supabase: SupabaseClient;
    let accountId: string;
    let movementTypeId: string;
    let movementTypeName: string;
    const debtIds: string[] = [];
    let fixedDebtId: string;
    let variableDebtId: string;
    const accountName = uniqueName("amount-input-calculator");

    test.beforeAll(async () => {
      supabase = await qaSupabase();
      const { data: account, error } = await supabase
        .from("accounts")
        .insert({ name: accountName })
        .select("id")
        .single();
      if (error) {
        throw new Error(error.message);
      }
      accountId = account.id;

      const { data: types, error: typesError } = await supabase
        .from("movement_types")
        .select("id, name")
        .neq("id", TRANSFER_TYPE_ID)
        .limit(1);
      if (typesError || !types?.length) {
        throw new Error(typesError?.message ?? "No hay tipos de movimiento");
      }
      movementTypeId = types[0].id;
      movementTypeName = types[0].name;

      const base = {
        kind: "service",
        amount: 50000,
        movement_type_id: movementTypeId,
        first_due_date: todayAsuncion(),
      };
      const { data: debts, error: debtsError } = await supabase
        .from("debts")
        .insert([
          { ...base, name: uniqueName("amount-input-calculator", "fija"), amount_mode: "fixed" },
          {
            ...base,
            name: uniqueName("amount-input-calculator", "variable"),
            amount_mode: "variable",
          },
        ])
        .select("id, amount_mode");
      if (debtsError) {
        throw new Error(debtsError.message);
      }
      for (const debt of debts) {
        debtIds.push(debt.id);
        if (debt.amount_mode === "fixed") {
          fixedDebtId = debt.id;
        } else {
          variableDebtId = debt.id;
        }
      }
    });

    test.afterAll(async () => {
      if (debtIds.length > 0) {
        await supabase.from("debts").delete().in("id", debtIds);
      }
      if (accountId) {
        await supabase.from("accounts").delete().eq("id", accountId);
      }
    });

    async function fillBasics(page: Page, description: string) {
      await page.getByLabel("Descripción").fill(description);
      await page.locator("#type").click();
      await page.getByRole("option", { name: "Débito" }).click();
      await page.locator("#account_id").click();
      await page.getByRole("option", { name: accountName }).click();
      await page.locator("#movement_type_id").click();
      await page.getByRole("option", { name: movementTypeName, exact: true }).first().click();
    }

    test("P.9 — guardar sin resolver y editar con +5000", async ({ page }) => {
      const description = uniqueName("amount-input-calculator", "p9");
      await page.goto(`${CREATE}?accountId=${accountId}`);
      await fillBasics(page, description);
      await typeKeys(page, "=20000+10000");
      await btn(page, "Crear").click();
      await expect(page).toHaveURL(/\/protected\/movements(\?|$)/);

      await page.goto(`/protected/movements?accountId=${accountId}`);
      const row = page.getByRole("row").filter({ hasText: description });
      await expect(row).toContainText(formatGs(30000));

      const { data } = await supabase
        .from("movements")
        .select("id")
        .eq("description", description)
        .single();
      await page.goto(`/protected/movements/edit/${data!.id}`);
      await expect(amountField(page)).toHaveValue("30.000");
      await amountField(page).focus();
      await amountField(page).press("End");
      await typeKeys(page, "+5000");
      await amountField(page).press("Enter");
      await expect(amountField(page)).toHaveValue("35.000");
      await btn(page, "Guardar").click();
      await expect(page).toHaveURL(/\/protected\/movements(\?|$)/);

      await page.goto(`/protected/movements?accountId=${accountId}`);
      await expect(page.getByRole("row").filter({ hasText: description })).toContainText(
        formatGs(35000)
      );
    });

    test("P.10 — expresión inválida no guarda; Crear y agregar otro vacía el campo", async ({
      page,
    }) => {
      const description = uniqueName("amount-input-calculator", "p10");
      await page.goto(`${CREATE}?accountId=${accountId}`);
      await fillBasics(page, description);
      await typeKeys(page, "=20000+");
      await btn(page, "Crear").click();
      await expect(page).toHaveURL(/\/protected\/movements\/create/);
      await expect(
        page.getByText("El monto debe ser un número entero positivo")
      ).toBeVisible();
      const { data: none } = await supabase
        .from("movements")
        .select("id")
        .eq("description", description);
      expect(none).toHaveLength(0);

      await amountField(page).fill("");
      await typeKeys(page, "=20000+10000");
      await amountField(page).press("Enter");
      await btn(page, "Crear y agregar otro").click();
      await expect(page).toHaveURL(/\/protected\/movements\/create/);
      await expect(amountField(page)).toHaveValue("");
      await typeKeys(page, "5000");
      await expect(amountField(page)).toHaveValue("5.000");

      await expect
        .poll(async () => {
          const { data } = await supabase
            .from("movements")
            .select("amount")
            .eq("description", description);
          return data?.map((m) => Number(m.amount));
        })
        .toEqual([30000]);
      await page.goto(`/protected/movements?accountId=${accountId}`);
      await expect(page.getByRole("row").filter({ hasText: description })).toContainText(
        formatGs(30000)
      );
    });

    test("P.12 — pago de deuda fija deshabilitado y variable con +5000", async ({ page }) => {
      await page.goto(`/protected/debts/${fixedDebtId}/pay`);
      await expect(page.locator("#amount")).toBeDisabled();
      await expect(page.locator("#amount")).toHaveValue("50.000");
      await expect(btn(page, "Calculadora")).toBeDisabled();

      await page.goto(`/protected/debts/${variableDebtId}/pay`);
      const amount = page.locator("#amount");
      await expect(amount).toHaveValue("50.000");
      await amount.focus();
      await amount.press("End");
      await amount.pressSequentially("+5000");
      await amount.press("Enter");
      await expect(amount).toHaveValue("55.000");
      await expect(page).toHaveURL(new RegExp(`/protected/debts/${variableDebtId}/pay`));
    });
  });

  test("P.11 — otros módulos y layout sin saltos", async ({ page }) => {
    for (const path of [
      "/protected/budgets/create",
      "/protected/transfers/create",
      "/protected/debts/create",
    ]) {
      await page.goto(path);
      const amount = page.locator("#amount");
      await amount.pressSequentially("=20000+10000");
      await amount.press("Enter");
      await expect(amount, path).toHaveValue("30.000");
      await expect(page).toHaveURL(new RegExp(path));
    }

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(CREATE);
    const before = (await page.locator("#type").boundingBox())!.y;
    await typeKeys(page, "=20000+10000");
    await expect(btn(page, "Sumar")).toBeVisible();
    const after = (await page.locator("#type").boundingBox())!.y;
    expect(after).toBe(before);
  });
});
