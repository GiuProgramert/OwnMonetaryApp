"use client";

import { Button } from "@/components/ui/button";
import { Account } from "@/lib/schemas/accounts";
import { deleteAccount } from "@/lib/services/accounts.client";
import { revalidateMyDataAndRedirect } from "@/lib/services/revalidate";
import { useRouter } from "next/navigation";

export default function DeleteAccountForm({
  initialValues,
}: {
  initialValues: Account;
}) {
  const router = useRouter();

  const onSubmit = async () => {
    await deleteAccount(initialValues.id);
    await revalidateMyDataAndRedirect("/protected/accounts");
  };

  return (
    <div className="flex flex-col gap-4">
      <p>
        ¿Estás seguro de que deseas eliminar la cuenta &quot;
        {initialValues.name}&quot;?
      </p>
      <div className="flex gap-2">
        <Button type="submit" onClick={onSubmit}>
          Eliminar
        </Button>
        <Button variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
