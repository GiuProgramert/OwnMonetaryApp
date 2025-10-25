import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import React from "react";

interface Props {
  children: React.ReactNode;
  title: string;
  href: string;
}

export default function FormContainer({ children, title, href }: Props) {
  return (
    <section className="w-full mt-4">
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
