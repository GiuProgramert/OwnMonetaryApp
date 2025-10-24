import { MovementType } from "@/lib/types";
import axios from "@/lib/axios";

export default async function EditMovementTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const response = axios.get<MovementType>(
    `/api/movement-types/${id}`
  );

	console.log('Response:', (await response));

  return (
    <div>
      Edit Movement Type: {id}
    </div>
  );
}
