"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AccountSelect from "@/components/account-select";
import ImportFormatError from "@/components/movements/import/import-format-error";
import ImportPreviewTable from "@/components/movements/import/import-preview-table";
import ImportSummary from "@/components/movements/import/import-summary";
import { PreviewRow, PreviewRowStatus } from "@/components/movements/import/types";
import { ADAPTERS } from "@/lib/imports/adapters";
import { FormatCheck } from "@/lib/imports/types";
import { readXlsxMatrix } from "@/lib/imports/readers/xlsx";
import { computeExternalIds } from "@/lib/imports/helpers/fingerprint";
import { Account } from "@/lib/schemas/accounts";
import { MovementType } from "@/lib/schemas/movement-types";
import { createImportedMovement } from "@/lib/schemas/movements";
import { checkExistingExternalIds } from "@/lib/services/movements.import-actions";
import { bulkCreateMovements } from "@/lib/services/movements.client";
import { revalidateMyDataAndRedirect } from "@/lib/services/revalidate";

type Step = "source" | "format-error" | "preview" | "confirm";

interface Props {
  accounts: Pick<Account, "id" | "name" | "color">[];
  movementTypes: Pick<MovementType, "id" | "name" | "color">[];
}

export default function ImportWizard({ accounts, movementTypes }: Props) {
  const [step, setStep] = useState<Step>("source");
  const [accountId, setAccountId] = useState<string>("");
  const [adapterId, setAdapterId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [formatCheck, setFormatCheck] = useState<Extract<FormatCheck, { ok: false }> | null>(
    null
  );
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedAdapter = ADAPTERS.find((adapter) => adapter.id === adapterId);

  const includedRows = useMemo(
    () => previewRows.filter((row) => row.included),
    [previewRows]
  );

  const summary = useMemo(() => {
    const totalCredit = includedRows
      .filter((row) => row.type === "credit")
      .reduce((sum, row) => sum + (row.amount ?? 0), 0);
    const totalDebit = includedRows
      .filter((row) => row.type === "debit")
      .reduce((sum, row) => sum + (row.amount ?? 0), 0);
    const dates = includedRows
      .map((row) => row.date)
      .filter((date): date is string => Boolean(date))
      .sort();

    return {
      includedCount: includedRows.length,
      totalCredit,
      totalDebit,
      startDate: dates[0] ?? null,
      endDate: dates[dates.length - 1] ?? null,
    };
  }, [includedRows]);

  const handleContinueFromSource = async () => {
    if (!accountId || !selectedAdapter || !file) {
      return;
    }

    setIsProcessing(true);

    try {
      const matrix = await readXlsxMatrix(file);
      const check = selectedAdapter.assertFormat({ matrix });

      if (!check.ok) {
        setFormatCheck(check);
        setStep("format-error");
        return;
      }

      const result = await selectedAdapter.extract(file);
      const externalIds = await computeExternalIds(result.rows);
      const existing = new Set(await checkExistingExternalIds(accountId, externalIds));
      const seenInFile = new Set<string>();
      const rows: PreviewRow[] = result.issues.map((issue, index) => ({
        key: `issue-${index}`,
        status: "error",
        included: false,
        movementTypeId: "",
        externalId: null,
        date: null,
        description: "",
        amount: null,
        type: null,
        reason: `Fila ${issue.source.row}: ${issue.reason}`,
      }));

      result.rows.forEach((extracted, index) => {
        const externalId = externalIds[index];
        let status: PreviewRowStatus = "new";

        if (existing.has(externalId)) {
          status = "already-imported";
        } else if (seenInFile.has(externalId)) {
          status = "duplicate-in-file";
        }

        seenInFile.add(externalId);

        rows.push({
          key: `row-${index}`,
          status,
          included: status === "new",
          movementTypeId: "",
          externalId,
          date: extracted.date,
          description: extracted.description,
          amount: extracted.amount,
          type: extracted.type,
          reason: null,
        });
      });

      setPreviewRows(rows);
      setStep("preview");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo leer el archivo");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleIncluded = (key: string, included: boolean) => {
    setPreviewRows((rows) =>
      rows.map((row) => (row.key === key ? { ...row, included } : row))
    );
  };

  const handleChangeType = (key: string, movementTypeId: string) => {
    setPreviewRows((rows) =>
      rows.map((row) => (row.key === key ? { ...row, movementTypeId } : row))
    );
  };

  const handleBulkAssignType = (movementTypeId: string) => {
    setPreviewRows((rows) =>
      rows.map((row) => (row.included ? { ...row, movementTypeId } : row))
    );
  };

  const handleContinueToConfirm = () => {
    const missingType = includedRows.filter((row) => !row.movementTypeId);

    if (missingType.length > 0) {
      toast.error(
        `Asigná un tipo de movimiento a las ${missingType.length} filas seleccionadas antes de continuar.`
      );
      return;
    }

    if (includedRows.length === 0) {
      toast.error("No hay filas seleccionadas para importar.");
      return;
    }

    setStep("confirm");
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);

    const payload: createImportedMovement[] = includedRows.map((row) => ({
      date: row.date as string,
      description: row.description,
      amount: row.amount as number,
      type: row.type as "credit" | "debit",
      account_id: accountId,
      movement_type_id: row.movementTypeId,
      external_id: row.externalId as string,
    }));

    try {
      const result = await bulkCreateMovements(payload);
      toast.success(
        `Se importaron ${result.inserted} movimientos` +
          (result.skipped > 0 ? `, se omitieron ${result.skipped} ya existentes.` : ".")
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo importar");
      setIsSubmitting(false);
      return;
    }

    await revalidateMyDataAndRedirect("/protected/movements");
  };

  if (step === "format-error" && formatCheck && selectedAdapter) {
    return (
      <ImportFormatError
        adapter={selectedAdapter}
        check={formatCheck}
        onBack={() => setStep("source")}
      />
    );
  }

  if (step === "preview") {
    return (
      <div className="flex flex-col gap-4">
        <ImportSummary {...summary} />
        <ImportPreviewTable
          rows={previewRows}
          movementTypes={movementTypes}
          onToggleIncluded={handleToggleIncluded}
          onChangeType={handleChangeType}
          onBulkAssignType={handleBulkAssignType}
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setStep("source")}>
            Volver
          </Button>
          <Button type="button" onClick={handleContinueToConfirm}>
            Continuar
          </Button>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Se van a crear {summary.includedCount} movimientos en la cuenta elegida. Esta acción
          no se puede deshacer.
        </p>
        <ImportSummary {...summary} />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => setStep("preview")}
          >
            Volver
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={handleConfirm}>
            {isSubmitting ? "Importando..." : "Confirmar importación"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Cuenta destino</Label>
          <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} />
        </div>
        <div className="grid gap-2">
          <Label>Banco / formato</Label>
          <Select value={adapterId} onValueChange={setAdapterId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona un formato" />
            </SelectTrigger>
            <SelectContent>
              {ADAPTERS.map((adapter) => (
                <SelectItem key={adapter.id} value={adapter.id}>
                  {adapter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="import-file">Archivo</Label>
          <Input
            id="import-file"
            type="file"
            accept={selectedAdapter?.accept.join(",")}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      <div>
        <Button
          type="button"
          disabled={!accountId || !selectedAdapter || !file || isProcessing}
          onClick={handleContinueFromSource}
        >
          {isProcessing ? "Leyendo..." : "Continuar"}
        </Button>
      </div>
    </div>
  );
}
