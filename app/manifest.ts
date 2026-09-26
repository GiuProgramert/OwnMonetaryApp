import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OwnMonetaryApp",
    short_name: "OwnMonetary",
    description:
      "Control de cuentas, movimientos y presupuestos personales.",
    start_url: "/protected",
    // Scope en la raíz: el redirect a /auth/login cuando no hay sesión queda dentro
    // de la app instalada. Con el scope por defecto (/protected/) Chrome abriría el
    // login en una pestaña del navegador en vez de la ventana standalone.
    scope: "/",
    display: "standalone",
    background_color: "#0F3D2E",
    theme_color: "#0F3D2E",
    lang: "es",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { src: "/icon-512.png", type: "image/png", sizes: "512x512" },
      {
        src: "/icon-maskable-512.png",
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable",
      },
    ],
  };
}
