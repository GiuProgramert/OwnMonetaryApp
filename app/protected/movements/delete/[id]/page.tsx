import DeleteMovementForm from "@/components/movements/delete-form";
import FormContainer from "@/components/form-container";
import { getMovementById } from "@/lib/services/movements";
import { notFound, redirect } from "next/navigation";
import { resolveReturnTo, withReturnTo } from "@/lib/return-to";

export default async function DeleteMovementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = resolveReturnTo(rawReturnTo, "/protected/movements");
  const movement = await getMovementById(id);

  if (!movement) {
    notFound();
  }

  if (movement.transfer_id) {
    redirect(
      withReturnTo(`/protected/transfers/delete/${movement.transfer_id}`, returnTo)
    );
  }

  return (
    <FormContainer title="Eliminar movimiento" href={returnTo}>
      <DeleteMovementForm initialValues={movement} returnTo={returnTo} />
    </FormContainer>
  );
}
