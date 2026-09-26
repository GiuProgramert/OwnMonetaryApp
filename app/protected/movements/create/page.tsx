import CreateMovementForm from "@/components/movements/create-form";
import FormContainer from "@/components/form-container";
import { resolveAccountFilter } from "@/lib/accounts/primary";
import { getAccounts } from "@/lib/services/accounts";
import { getMovementTypes } from "@/lib/services/movement-types";

export default async function CreateMovementPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string }>;
}) {
  const rawParams = await searchParams;

  const [accounts, movementTypes] = await Promise.all([
    getAccounts(),
    getMovementTypes(),
  ]);

  // Hereda la cuenta desde la que se entró al alta; sin `accountId`, la principal.
  const { accountId } = resolveAccountFilter(rawParams, accounts);

  return (
    <FormContainer title="Crear un nuevo movimiento" href="/protected/movements">
      <CreateMovementForm
        accounts={accounts}
        movementTypes={movementTypes}
        defaultAccountId={accountId ?? ""}
      />
    </FormContainer>
  );
}
