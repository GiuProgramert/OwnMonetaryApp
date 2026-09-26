"use client";

import { useEffect, useState } from "react";

/**
 * Arranca en `false` y se resuelve en el primer efecto: en SSR no hay viewport,
 * así que el primer frame usa el layout ancho y se corrige al montar.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQuery.addEventListener("change", onChange);

    return () => mediaQuery.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** `true` por debajo del breakpoint `md` (768px). */
export function useIsMobile() {
  return !useMediaQuery("(min-width: 768px)");
}
