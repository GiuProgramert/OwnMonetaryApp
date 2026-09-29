import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Salida generada (build de Next, reportes de Playwright) y el worker de pdf.js que copia
  // scripts/copy-pdf-worker.mjs: no es código nuestro.
  {
    ignores: [
      ".next/**",
      "public/pdf.worker.min.mjs",
      "test-results/**",
      "playwright-report/**",
      "blob-report/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
