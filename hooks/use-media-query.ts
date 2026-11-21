"use client";

import { useSyncExternalStore } from "react";

/**
 * `undefined` en el servidor y durante la hidratación; después, si `query` coincide. Quien lo usa
 * decide qué dibujar mientras es `undefined` (no hay forma de saber el ancho antes de montar).
 */
export function useMediaQuery(query: string): boolean | undefined {
  return useSyncExternalStore<boolean | undefined>(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);

      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => undefined
  );
}
