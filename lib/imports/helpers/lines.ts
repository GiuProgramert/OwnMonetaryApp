import { PdfTextItem } from "@/lib/imports/readers/pdf";

export type TextLine = { page: number; y: number; raw: string };

/**
 * Agrupa items de texto en líneas por coordenada Y (con tolerancia, por si el motor de PDF no da
 * exactamente el mismo Y para toda una fila) y las ordena por X dentro de cada línea. `raw` es la
 * concatenación de los `str` en orden de lectura — como pdfjs ya emite items de espacio entre
 * campos con ancho real, el resultado es una línea con separación simple entre columnas.
 */
export function groupIntoLines(items: PdfTextItem[], yTolerance = 1): TextLine[] {
  const byPage = new Map<number, PdfTextItem[]>();

  for (const item of items) {
    const pageItems = byPage.get(item.page) ?? [];
    pageItems.push(item);
    byPage.set(item.page, pageItems);
  }

  const lines: TextLine[] = [];

  for (const [page, pageItems] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
    const remaining = [...pageItems];
    // Y decreciente: en coordenadas de PDF el origen está abajo, así que el orden de lectura
    // (arriba hacia abajo) es Y de mayor a menor.
    remaining.sort((a, b) => b.y - a.y || a.x - b.x);

    while (remaining.length > 0) {
      const anchorY = remaining[0].y;
      const sameLine = remaining.filter((item) => Math.abs(item.y - anchorY) <= yTolerance);
      sameLine.sort((a, b) => a.x - b.x);

      lines.push({
        page,
        y: anchorY,
        raw: sameLine
          .map((item) => item.str)
          .join("")
          .trim(),
      });

      const consumed = new Set(sameLine);
      for (let i = remaining.length - 1; i >= 0; i--) {
        if (consumed.has(remaining[i])) {
          remaining.splice(i, 1);
        }
      }
    }
  }

  return lines;
}
