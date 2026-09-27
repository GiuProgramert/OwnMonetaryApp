/**
 * `?returnTo=` de los forms a los que se llega desde más de una pantalla (p. ej. pagar una deuda
 * desde el listado, el detalle o el dashboard): define a dónde vuelven la flecha "<" y el redirect
 * después de guardar. Solo acepta rutas de `/protected`; cualquier otro valor sería un open
 * redirect, así que cae en `fallback`.
 */
export function resolveReturnTo(raw: string | undefined, fallback: string): string {
  if (raw && raw.startsWith("/protected")) {
    return raw;
  }

  return fallback;
}

export function withReturnTo(href: string, returnTo: string): string {
  return `${href}?returnTo=${encodeURIComponent(returnTo)}`;
}
