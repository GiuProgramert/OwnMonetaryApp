"use client";
import { MovementType } from "@/lib/schemas/movement-types";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";
import { deleteMovementType } from "@/lib/services/movement-types.client";
import { revalidateMyDataAndRedirect } from "@/lib/services/revalidate";

interface Props {
  initialValues: MovementType;
}

export default function DeleteMovementTypeForm({ initialValues }: Props) {
  const router = useRouter();

  const onSubmit = async () => {
    await deleteMovementType(initialValues.id);
    await revalidateMyDataAndRedirect("/protected/movement-types");
  };

  return (
    <div className="flex flex-col gap-2">
      <span>
        ¿Esta seguro que quiere eliminar el tipo de movimiento &quot;
        {initialValues.name}&quot;?
      </span>
      <div className="flex gap-2">
        <Button onClick={onSubmit}>Eliminar</Button>
        <Button variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
