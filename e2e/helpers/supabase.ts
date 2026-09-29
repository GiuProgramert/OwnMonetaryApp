import { createClient } from "@supabase/supabase-js";
import { qaCredentials } from "./qa-user";

// Cliente logueado como el usuario QA con la publishable key: pasa por RLS igual que la app.
// Sirve para preparar y limpiar datos de prueba sin recorrer la UI.
export async function qaSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { email, password } = qaCredentials();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(`No se pudo loguear al usuario QA: ${error.message}`);
  }

  return supabase;
}

export function uniqueName(feature: string, suffix?: string) {
  const base = `e2e-${feature}-${Date.now()}`;

  return suffix ? `${base}-${suffix}` : base;
}
