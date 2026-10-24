"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** `redirectTo` puede llevar query string; `revalidatePath` recibe solo la ruta. */
export async function revalidateMyDataAndRedirect(
  path: string,
  redirectTo: string = path,
) {
  revalidatePath(path);
  redirect(redirectTo);
}

export async function revalidatePathServer(path: string) {
  revalidatePath(path);
}