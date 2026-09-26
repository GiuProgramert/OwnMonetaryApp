"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MovementTypeSelect from "@/components/movement-type-select";
import RowStatusBadge from "@/components/movements/import/row-status-badge";
import { PreviewRow } from "@/components/movements/import/types";
import { MovementType } from "@/lib/schemas/movement-types";

interface Props {
  rows: PreviewRow[];
  movementTypes: Pick<MovementType, "id" | "name" | "color">[];
  onToggleIncluded: (key: string, included: boolean) => void;
  onChangeType: (key: string, movementTypeId: string) => void;
  onChangeDescription: (key: string, description: string) => void;
}

/**
 * La tabla de preview tiene 7 columnas más un input y un select por fila: en
 * móvil solo se puede usar apilada.
 */
export default function ImportPreviewCards({
  rows,
  movementTypes,
  onToggleIncluded,
  onChangeType,
  onChangeDescription,
}: Props) {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {rows.map((row) => (
        <li key={row.key} className="min-w-0">
          <Card className="min-w-0 overflow-hidden shadow-none">
            <CardHeader className="flex-row items-center justify-between gap-3 p-4 pb-2 space-y-0">
              <div className="flex min-w-0 items-center gap-2">
                <Checkbox
                  id={`include-${row.key}`}
                  checked={row.included}
                  disabled={row.status === "error"}
                  onCheckedChange={(checked) =>
                    onToggleIncluded(row.key, checked === true)
                  }
                />
                <Label htmlFor={`include-${row.key}`} className="text-sm">
                  Incluir
                </Label>
              </div>
              <RowStatusBadge status={row.status} />
            </CardHeader>

            <CardContent className="grid gap-3 p-4 pt-0 text-sm">
              {row.status === "error" ? (
                <p className="text-muted-foreground">{row.reason}</p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="shrink-0 text-muted-foreground">
                      Fecha
                    </span>
                    <span>
                      {row.date &&
                        new Date(row.date).toLocaleDateString("es-PY")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="shrink-0 text-muted-foreground">
                      Monto
                    </span>
                    <span>Gs. {row.amount?.toLocaleString("es-PY")}</span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="shrink-0 text-muted-foreground">
                      Naturaleza
                    </span>
                    <Badge
                      variant={row.type === "credit" ? "default" : "destructive"}
                    >
                      {row.type === "credit" ? "Crédito" : "Débito"}
                    </Badge>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`description-${row.key}`}>Descripción</Label>
                    <Input
                      id={`description-${row.key}`}
                      value={row.description}
                      onChange={(e) =>
                        onChangeDescription(row.key, e.target.value)
                      }
                      maxLength={255}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Tipo de movimiento</Label>
                    <MovementTypeSelect
                      movementTypes={movementTypes}
                      value={row.movementTypeId || undefined}
                      onChange={(value) => onChangeType(row.key, value)}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
