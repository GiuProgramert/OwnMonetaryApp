export function formatCurrency(amount: number): string {
  return `Gs. ${amount.toLocaleString("es-PY")}`;
}

/**
 * Formato abreviado para ejes de gráfico (`1,2 M`, `850 mil`) — el monto completo
 * en `Gs. 12.500.000` en cada tick se come la mitad del ancho del gráfico.
 */
export function formatCompactAmount(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toLocaleString("es-PY", { maximumFractionDigits: 1 })} M`;
  }

  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toLocaleString("es-PY", { maximumFractionDigits: 0 })} mil`;
  }

  return `${sign}${abs.toLocaleString("es-PY")}`;
}
