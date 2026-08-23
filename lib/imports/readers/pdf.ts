export type PdfTextItem = { page: number; x: number; y: number; str: string };

/**
 * File -> items de texto con su posición (x/y por página).
 *
 * El worker de pdfjs-dist se sirve como asset estático desde `/public` (ver
 * `scripts/copy-pdf-worker.mjs`) en vez de resolverlo por bundler: Turbopack no tiene el soporte
 * que webpack sí tiene para el patrón `new URL(..., import.meta.url)` con pdfjs-dist, así que
 * apuntar `workerSrc` a una ruta pública evita esa fricción por completo.
 */
export async function readPdfItems(file: File): Promise<PdfTextItem[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const items: PdfTextItem[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();

    for (const item of content.items) {
      if ("str" in item) {
        items.push({
          page: pageNumber,
          x: item.transform[4],
          y: item.transform[5],
          str: item.str,
        });
      }
    }
  }

  return items;
}
