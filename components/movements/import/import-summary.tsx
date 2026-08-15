interface Props {
  includedCount: number;
  totalCredit: number;
  totalDebit: number;
  startDate: string | null;
  endDate: string | null;
}

export default function ImportSummary({
  includedCount,
  totalCredit,
  totalDebit,
  startDate,
  endDate,
}: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 rounded-md border p-4 text-sm">
      <div>
        <p className="text-muted-foreground">Filas a importar</p>
        <p className="text-lg font-semibold">{includedCount}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Total créditos</p>
        <p className="text-lg font-semibold">Gs. {totalCredit.toLocaleString("es-PY")}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Total débitos</p>
        <p className="text-lg font-semibold">Gs. {totalDebit.toLocaleString("es-PY")}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Rango de fechas</p>
        <p className="text-lg font-semibold">
          {startDate && endDate
            ? `${new Date(startDate).toLocaleDateString("es-PY")} - ${new Date(endDate).toLocaleDateString("es-PY")}`
            : "—"}
        </p>
      </div>
    </div>
  );
}
