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
      <div className="mb-4 flex gap-4 items-center">
        <Link href={href}>
          <ChevronLeft />
        </Link>
        <h1 className="text-2xl font-semibold">{title}</h1>
      </div>
      <div className="space-y-6">
        <div className="p-4 border rounded-md bg-card">{children}</div>
      </div>
    </section>
  );
}
