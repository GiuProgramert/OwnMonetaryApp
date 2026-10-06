export const MAX_AMOUNT = 9_999_999_999_999;

export type CalculatorError =
  | "incomplete"
  | "division_by_zero"
  | "not_positive"
  | "too_large";

export type CalculatorResult =
  | { ok: true; value: number }
  | { ok: false; error: CalculatorError };

export const calculatorErrorMessages: Record<CalculatorError, string> = {
  incomplete: "Cálculo incompleto",
  division_by_zero: "No se puede dividir por cero",
  not_positive: "El resultado debe ser mayor a cero",
  too_large: "El resultado es demasiado grande",
};

class SyntaxFailure extends Error {}

/**
 * Evalúa una expresión (solo `0-9 + - * / ( )`) con un parser de descenso
 * recursivo. Nunca usa `eval` ni `new Function`. Solo se redondea el
 * resultado final, nunca los intermedios.
 */
export function evaluateExpression(expression: string): CalculatorResult {
  let pos = 0;
  let divisionByZero = false;

  const peek = () => expression[pos];

  const parseFactor = (): number => {
    const ch = peek();
    if (ch === "(") {
      pos++;
      const inner = parseExpr();
      if (peek() !== ")") {
        throw new SyntaxFailure();
      }
      pos++;
      return inner;
    }
    if (ch !== undefined && ch >= "0" && ch <= "9") {
      const start = pos;
      while (pos < expression.length && expression[pos] >= "0" && expression[pos] <= "9") {
        pos++;
      }
      return Number(expression.slice(start, pos));
    }
    throw new SyntaxFailure();
  };

  const parseTerm = (): number => {
    let left = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = expression[pos++];
      const right = parseFactor();
      if (op === "*") {
        left = left * right;
      } else {
        if (right === 0) {
          divisionByZero = true;
        }
        left = left / right;
      }
    }
    return left;
  };

  function parseExpr(): number {
    let left = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = expression[pos++];
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  let result: number;
  try {
    result = parseExpr();
    if (pos !== expression.length) {
      throw new SyntaxFailure();
    }
  } catch (e) {
    if (e instanceof SyntaxFailure) {
      return { ok: false, error: "incomplete" };
    }
    throw e;
  }

  if (divisionByZero) {
    return { ok: false, error: "division_by_zero" };
  }
  if (!Number.isFinite(result)) {
    return { ok: false, error: "too_large" };
  }
  const rounded = Math.round(result);
  if (rounded <= 0) {
    return { ok: false, error: "not_positive" };
  }
  if (rounded > MAX_AMOUNT) {
    return { ok: false, error: "too_large" };
  }
  return { ok: true, value: rounded };
}

/** Separador de miles `.` a cada corrida de dígitos; operadores intactos. */
export function formatExpression(expression: string): string {
  return expression.replace(/\d+/g, (run) =>
    run.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  );
}

export function sanitizeExpression(raw: string): string {
  return raw
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/[^0-9+\-*/()]/g, "");
}

export function formatAmount(value: number | undefined): string {
  return value ? value.toLocaleString("es-PY") : "";
}

export type AmountInputResolution =
  | { isCalculating: true; display: string; expression: string }
  | { isCalculating: false; display: string; value: number };

export function resolveAmountInput(
  raw: string,
  wasCalculating: boolean
): AmountInputResolution {
  const expression = sanitizeExpression(raw);

  let isCalculating = raw.trimStart().startsWith("=");
  if (!isCalculating) {
    if (!wasCalculating) {
      isCalculating = /\d[+\-*/]/.test(expression);
    } else {
      isCalculating = /[+\-*/()]/.test(expression);
    }
  }

  if (isCalculating) {
    return {
      isCalculating: true,
      display: "=" + formatExpression(expression),
      expression,
    };
  }

  const digits = raw.replace(/\D/g, "");
  const value = digits ? parseInt(digits, 10) : 0;
  return {
    isCalculating: false,
    display: digits ? value.toLocaleString("es-PY") : "",
    value,
  };
}

export function caretAfterFormat(
  raw: string,
  rawCaret: number,
  display: string,
  isCalculating: boolean
): number {
  const n = isCalculating
    ? sanitizeExpression(raw.slice(0, rawCaret)).length
    : raw.slice(0, rawCaret).replace(/\D/g, "").length;

  if (n === 0) {
    return isCalculating ? 1 : 0;
  }

  const significant = isCalculating ? /[0-9+\-*/()]/ : /\d/;
  let count = 0;
  for (let i = 0; i < display.length; i++) {
    if (significant.test(display[i])) {
      count++;
      if (count === n) {
        return i + 1;
      }
    }
  }
  return display.length;
}
