// El worker de pdfjs-dist se sirve como asset estático desde /public en vez de resolverlo por
// bundler (Turbopack no soporta bien el patrón `new URL(..., import.meta.url)` con pdfjs-dist).
// No se commitea: se regenera en cada `npm install` a partir de la versión instalada.
import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(rootDir, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const destinationDir = path.join(rootDir, "public");
const destination = path.join(destinationDir, "pdf.worker.min.mjs");

await mkdir(destinationDir, { recursive: true });
await copyFile(source, destination);

console.log("pdfjs worker copiado a public/pdf.worker.min.mjs");
