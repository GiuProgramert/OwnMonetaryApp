/** File -> matriz de celdas. Import dinámico: `xlsx` no debe entrar al bundle inicial de /protected/movements. */
export async function readXlsxMatrix(file: File): Promise<unknown[][]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
  }) as unknown[][];
}
