"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  caretAfterFormat,
  calculatorErrorMessages,
  evaluateExpression,
  formatAmount,
  resolveAmountInput,
  sanitizeExpression,
  type CalculatorError,
} from "@/lib/amounts/calculator";
import { Calculator } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface Props {
  id?: string;
  value: number | undefined;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const operatorButtons: {
  text: string;
  label: string;
  insert: string;
}[] = [
  { text: "+", label: "Sumar", insert: "+" },
  { text: "-", label: "Restar", insert: "-" },
  { text: "×", label: "Multiplicar", insert: "*" },
  { text: "÷", label: "Dividir", insert: "/" },
  { text: "(", label: "Abrir paréntesis", insert: "(" },
  { text: ")", label: "Cerrar paréntesis", insert: ")" },
];

export default function AmountInput({ id, value, onChange, disabled }: Props) {
  const [display, setDisplay] = useState(formatAmount(value));
  const [error, setError] = useState<CalculatorError | null>(null);
  const [pendingCaret, setPendingCaret] = useState<{ position: number } | null>(
    null
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<number | undefined>(value);
  const previousAmount = useRef<number | undefined>(undefined);

  const isCalculating = display.startsWith("=");

  const emit = (n: number) => {
    lastEmitted.current = n;
    onChange(n);
  };

  useEffect(() => {
    if (value === lastEmitted.current) {
      return;
    }
    lastEmitted.current = value;
    setDisplay(formatAmount(value));
    setError(null);
  }, [value]);

  useLayoutEffect(() => {
    if (pendingCaret && document.activeElement === inputRef.current) {
      inputRef.current?.setSelectionRange(
        pendingCaret.position,
        pendingCaret.position
      );
    }
  }, [pendingCaret]);

  const applyRaw = (raw: string, rawCaret: number) => {
    const resolved = resolveAmountInput(raw, isCalculating);

    if (resolved.isCalculating && !isCalculating) {
      previousAmount.current = lastEmitted.current;
    }

    setDisplay(resolved.display);
    setError(null);
    setPendingCaret({
      position: caretAfterFormat(
        raw,
        rawCaret,
        resolved.display,
        resolved.isCalculating
      ),
    });

    if (resolved.isCalculating) {
      const result = evaluateExpression(resolved.expression);
      emit(result.ok ? result.value : 0);
    } else {
      emit(resolved.value);
    }
  };

  const resolve = () => {
    if (!isCalculating) {
      return;
    }
    const expression = sanitizeExpression(display);
    if (expression === "") {
      setDisplay("");
      setError(null);
      emit(0);
      return;
    }
    const result = evaluateExpression(expression);
    if (result.ok) {
      setDisplay(formatAmount(result.value));
      setError(null);
      emit(result.value);
    } else {
      setError(result.error);
      emit(0);
    }
  };

  const cancel = () => {
    const previous = previousAmount.current ?? 0;
    const text = formatAmount(previous);
    setDisplay(text);
    setError(null);
    setPendingCaret({ position: text.length });
    emit(previous);
  };

  const insert = (char: string) => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? display.length;
    const end = input?.selectionEnd ?? display.length;
    applyRaw(display.slice(0, start) + char + display.slice(end), start + 1);
    input?.focus();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyRaw(e.target.value, e.target.selectionStart ?? e.target.value.length);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isCalculating) {
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      resolve();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (containerRef.current?.contains(e.relatedTarget as Node | null)) {
      return;
    }
    resolve();
  };

  const handleCalculatorClick = () => {
    if (isCalculating) {
      cancel();
    } else {
      applyRaw("=" + display, display.length + 1);
    }
    inputRef.current?.focus();
  };

  let preview: string | null = null;
  if (isCalculating && !error) {
    const expression = sanitizeExpression(display);
    if (/[+\-*/]/.test(expression)) {
      const result = evaluateExpression(expression);
      if (result.ok) {
        preview = `= ${formatAmount(result.value)}`;
      }
    }
  }

  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="grid gap-2" ref={containerRef}>
      <div className="flex gap-2">
        <Input
          id={id}
          ref={inputRef}
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={disabled}
        />
        <Button
          type="button"
          variant={isCalculating ? "secondary" : "outline"}
          size="icon"
          aria-label={isCalculating ? "Cancelar cálculo" : "Calculadora"}
          aria-pressed={isCalculating}
          tabIndex={-1}
          disabled={disabled}
          onMouseDown={keepFocus}
          onClick={handleCalculatorClick}
        >
          <Calculator />
        </Button>
      </div>
      {isCalculating && (
        <div className="flex flex-wrap gap-2">
          {operatorButtons.map((b) => (
            <Button
              key={b.label}
              type="button"
              variant="outline"
              size="icon"
              aria-label={b.label}
              tabIndex={-1}
              onMouseDown={keepFocus}
              onClick={() => insert(b.insert)}
            >
              {b.text}
            </Button>
          ))}
          <Button
            type="button"
            variant="default"
            size="icon"
            aria-label="Calcular"
            tabIndex={-1}
            onMouseDown={keepFocus}
            onClick={() => {
              resolve();
              inputRef.current?.focus();
            }}
          >
            =
          </Button>
        </div>
      )}
      {error ? (
        <p className="text-sm text-destructive">
          {calculatorErrorMessages[error]}
        </p>
      ) : preview ? (
        <p className="text-sm text-muted-foreground">{preview}</p>
      ) : null}
    </div>
  );
}
