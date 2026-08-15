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
import { Label } from "@/components/ui/label";
import MovementTypeSelect from "@/components/movement-type-select";
import { MovementType } from "@/lib/schemas/movement-types";
import { PreviewRow, PreviewRowStatus } from "@/components/movements/import/types";

const STATUS_LABEL: Record<PreviewRowStatus, string> = {
  new: "Nueva",
  "already-imported": "Ya importada",
  "duplicate-in-file": "Duplicada en el archivo",
  error: "Error de lectura",
};

const STATUS_VARIANT: Record<PreviewRowStatus, "default" | "secondary" | "outline" | "destructive"> = {
  new: "default",
  "already-imported": "secondary",
  "duplicate-in-file": "outline",
  error: "destructive",
};

interface Props {
  rows: PreviewRow[];
  movementTypes: Pick<MovementType, "id" | "name" | "color">[];
  onToggleIncluded: (key: string, included: boolean) => void;
  onChangeType: (key: string, movementTypeId: string) => void;
  onBulkAssignType: (movementTypeId: string) => void;
}

export default function ImportPreviewTable({
  rows,
  movementTypes,
  onToggleIncluded,
  onChangeType,
  onBulkAssignType,
}: Props) {
  const [bulkMovementTypeId, setBulkMovementTypeId] = useState<string | undefined>(undefined);
  const selectedCount = rows.filter((row) => row.included).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4 rounded-md border p-4">
        <div className="grid gap-2 min-w-64">
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
                  onCheckedChange={(checked) => onToggleIncluded(row.key, checked === true)}
                />
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
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
                  <TableCell className="max-w-56 truncate">{row.description}</TableCell>
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
  );
}
