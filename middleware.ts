import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * - .mjs, .js - static assets served from /public (p. ej. el worker de pdfjs-dist);
     *   ninguna URL de página autenticada termina en estas extensiones.
     * - .webmanifest - el manifest PWA (/manifest.webmanifest). Chrome lo pide sin
     *   cookies, así que si el middleware lo redirige a /auth/login la app deja de
     *   ser instalable.
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mjs|js|webmanifest)$).*)",
  ],
};
