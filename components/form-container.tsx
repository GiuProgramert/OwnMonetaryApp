import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import React from "react";

import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  title: string;
  href: string;
  /** Usar todo el ancho disponible en vez del ancho angosto de formulario. */
  wide?: boolean;
}

export default function FormContainer({ children, title, href, wide }: Props) {
  return (
    <section className={cn("w-full mt-4", !wide && "max-w-2xl")}>
      <div className="mb-4 flex flex-wrap items-center gap-3 sm:gap-4">
        <Link href={href}>
          <ChevronLeft />
        </Link>
        <h1 className="min-w-0 text-xl sm:text-2xl font-semibold">{title}</h1>
      </div>
      <div className="space-y-6">
        <div className="p-3 sm:p-4 border rounded-md bg-card">{children}</div>
      </div>
    </section>
  );
}
