import { Button } from "@/components/ui/button";
import { BankAdapter, FormatCheck } from "@/lib/imports/types";

interface Props {
  adapter: BankAdapter;
  check: Extract<FormatCheck, { ok: false }>;
  onBack: () => void;
}

export default function ImportFormatError({ adapter, check, onBack }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 space-y-2 text-sm">
        <p className="font-semibold text-destructive">
          El archivo no coincide con el formato esperado para &quot;{adapter.label}&quot;.
        </p>
        <p>
          Falta{check.missing.length > 1 ? "n" : ""} la{check.missing.length > 1 ? "s" : ""}{" "}
          columna{check.missing.length > 1 ? "s" : ""}:{" "}
          <span className="font-mono">{check.missing.join(", ")}</span>.
        </p>
        <p>
          Columnas encontradas:{" "}
          <span className="font-mono">
            {check.found.length > 0 ? check.found.join(", ") : "ninguna"}
          </span>
          .
        </p>
        <p className="text-muted-foreground">
          Puede que el banco haya cambiado el formato. Hay que actualizar el adaptador.
        </p>
      </div>
      <div>
        <Button type="button" variant="outline" onClick={onBack}>
          Volver
        </Button>
      </div>
    </div>
  );
}
