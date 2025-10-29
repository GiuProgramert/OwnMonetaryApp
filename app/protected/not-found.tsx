import Link from "next/link";

export default function Custom404() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20">
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <p className="text-xl mb-8">Página no encontrada</p>
      <Link href="/protected" className="hover:underline">
        Volver al inicio
      </Link>
    </div>
  );
}
