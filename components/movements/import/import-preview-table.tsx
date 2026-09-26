"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MovementTypeSelect from "@/components/movement-type-select";
import ImportPreviewCards from "@/components/movements/import/import-preview-cards";
import RowStatusBadge from "@/components/movements/import/row-status-badge";
import { MovementType } from "@/lib/schemas/movement-types";
import { PreviewRow } from "@/components/movements/import/types";

interface Props {
  rows: PreviewRow[];
  movementTypes: Pick<MovementType, "id" | "name" | "color">[];
  onToggleIncluded: (key: string, included: boolean) => void;
  onChangeType: (key: string, movementTypeId: string) => void;
  onChangeDescription: (key: string, description: string) => void;
  onBulkAssignType: (movementTypeId: string) => void;
}

export default function ImportPreviewTable({
  rows,
  movementTypes,
  onToggleIncluded,
  onChangeType,
  onChangeDescription,
  onBulkAssignType,
}: Props) {
  const [bulkMovementTypeId, setBulkMovementTypeId] = useState<string | undefined>(undefined);
  const selectedCount = rows.filter((row) => row.included).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4 rounded-md border p-4">
        <div className="grid gap-2 w-full sm:w-auto sm:min-w-64">
          <Label>Asignar tipo a las filas seleccionadas ({selectedCount})</Label>
          <MovementTypeSelect
            movementTypes={movementTypes}
            value={bulkMovementTypeId}
            onChange={setBulkMovementTypeId}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!bulkMovementTypeId || selectedCount === 0}
          onClick={() => bulkMovementTypeId && onBulkAssignType(bulkMovementTypeId)}
        >
          Asignar
        </Button>
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Incluir</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Naturaleza</TableHead>
              <TableHead>Tipo de movimiento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell>
                  <Checkbox
                    checked={row.included}
                    disabled={row.status === "error"}
                    onCheckedChange={(checked) =>
                      onToggleIncluded(row.key, checked === true)
                    }
                  />
                </TableCell>
                <TableCell>
                  <RowStatusBadge status={row.status} />
                </TableCell>
                {row.status === "error" ? (
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    {row.reason}
                  </TableCell>
                ) : (
                  <>
                    <TableCell>
                      {row.date && new Date(row.date).toLocaleDateString("es-PY")}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.description}
                        onChange={(e) =>
                          onChangeDescription(row.key, e.target.value)
                        }
                        maxLength={255}
                        className="w-full md:min-w-56"
                      />
                    </TableCell>
                    <TableCell>Gs. {row.amount?.toLocaleString("es-PY")}</TableCell>
                    <TableCell>
                      <Badge variant={row.type === "credit" ? "default" : "destructive"}>
                        {row.type === "credit" ? "Crédito" : "Débito"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <MovementTypeSelect
                        movementTypes={movementTypes}
                        value={row.movementTypeId || undefined}
                        onChange={(value) => onChangeType(row.key, value)}
                      />
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ImportPreviewCards
        rows={rows}
        movementTypes={movementTypes}
        onToggleIncluded={onToggleIncluded}
        onChangeType={onChangeType}
        onChangeDescription={onChangeDescription}
      />
    </div>
  );
}
