import { notFound, redirect } from "next/navigation";
import PaymentForm from "@/components/debts/payment-form";
import FormContainer from "@/components/form-container";
import { getPrimaryAccountId } from "@/lib/accounts/primary";
import { getAccounts } from "@/lib/services/accounts";
import { resolveReturnTo } from "@/lib/return-to";
import { getDebtById } from "@/lib/services/debts";

export default async function DebtPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const returnTo = resolveReturnTo((await searchParams).returnTo, `/protected/debts/${id}`);
  const [debt, accounts] = await Promise.all([getDebtById(id), getAccounts()]);

  if (!debt) {
    notFound();
  }

  if (debt.finished) {
    redirect(`/protected/debts/${id}`);
  }

  const defaultAccountId = getPrimaryAccountId(accounts) ?? "";

  return (
    <FormContainer
      title={`Registrar pago – ${debt.name}`}
      href={returnTo}
    >
      <PaymentForm
        debt={debt}
        accounts={accounts}
        defaultAccountId={defaultAccountId}
        returnTo={returnTo}
      />
    </FormContainer>
  );
}
