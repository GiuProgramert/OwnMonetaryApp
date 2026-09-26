import { Badge } from "@/components/ui/badge";
import { PreviewRowStatus } from "@/components/movements/import/types";

const STATUS_LABEL: Record<PreviewRowStatus, string> = {
  new: "Nueva",
  "already-imported": "Ya importada",
  "duplicate-in-file": "Duplicada en el archivo",
  error: "Error de lectura",
};

const STATUS_VARIANT: Record<
  PreviewRowStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  new: "default",
  "already-imported": "secondary",
  "duplicate-in-file": "outline",
  error: "destructive",
};

export default function RowStatusBadge({
  status,
}: {
  status: PreviewRowStatus;
}) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
