import React from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface RecordCardField {
  /** Etiqueta del campo. Vacía = el valor ocupa todo el ancho. */
  label: string;
  value: React.ReactNode;
}

interface Props {
  title: React.ReactNode;
  /** Los mismos enlaces de íconos que usa la columna "Acciones" de la tabla. */
  actions?: React.ReactNode;
  fields: RecordCardField[];
  className?: string;
}

/**
 * Representación de una fila de tabla para pantallas angostas: las tablas de
 * esta app tienen 6-7 columnas y solo se leen con scroll horizontal en móvil.
 *
 * Los valores envuelven en vez de truncarse: `truncate` aplica
 * `white-space: nowrap`, y eso hace que el `min-content` de la tarjeta sea el
 * texto completo, que es lo que terminaba desbordando el ancho.
 */
export default function RecordCard({
  title,
  actions,
  fields,
  className,
}: Props) {
  return (
    <Card className={cn("min-w-0 overflow-hidden shadow-none", className)}>
      <CardHeader className="flex-row items-start justify-between gap-3 p-4 pb-2 space-y-0">
        <div className="min-w-0 flex-1 break-words font-medium">{title}</div>
        {actions && <div className="flex shrink-0 gap-1">{actions}</div>}
      </CardHeader>

      <CardContent className="p-4 pt-0">
        <dl className="flex flex-col gap-1.5 text-sm">
          {fields.map((field, index) => {
            if (!field.label) {
              return (
                <div key={index} className="min-w-0 pt-1">
                  <dd className="min-w-0">{field.value}</dd>
                </div>
              );
            }

            return (
              <div
                key={index}
                className="flex min-w-0 items-start justify-between gap-3"
              >
                <dt className="shrink-0 text-muted-foreground">
                  {field.label}
                </dt>
                <dd className="min-w-0 flex-1 break-words text-right">
                  {field.value}
                </dd>
              </div>
            );
          })}
        </dl>
      </CardContent>
    </Card>
  );
}
