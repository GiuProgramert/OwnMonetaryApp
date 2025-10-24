"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, User, Activity, DollarSign, Shapes, ChevronLeft } from "lucide-react";

const navItems: { label: string; href: string; icon: React.ReactNode }[] = [
  {
    label: "Dashboard",
    href: "/protected",
    icon: <Home className="w-5 h-5" />,
  },
  {
    label: "Cuentas",
    href: "/protected/accounts",
    icon: <User className="w-5 h-5" />,
  },
  {
    label: "Movimientos",
    href: "/protected/movements",
    icon: <Activity className="w-5 h-5" />,
  },
  {
    label: "Tipos de movimientos",
    href: "/protected/movement-types",
    icon: <Shapes className="w-5 h-5" />,
  }
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(true);

  return (
    <aside
      className={cn(
        "transition-all duration-500 shrink-0 bg-card border-r border-border rounded-md",
        open ? "w-64" : "w-20"
      )}
    >
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-b-foreground/10">
          <div className="flex items-center gap-2">
            <div className="ml-1">
              <DollarSign
                className={cn("text-foreground", open ? "w-6 h-6" : "w-5 h-5")}
              />
            </div>
            {<span className={cn("font-semibold truncate", open ? "mx-auto" : "sr-only")}>OwnMonetaryApp</span>}
          </div>

          <button
            aria-label={open ? "Cerrar sidebar" : "Abrir sidebar"}
            onClick={() => setOpen((s) => !s)}
            className="p-1 rounded hover:bg-accent/10"
          >
            <ChevronLeft className={cn("w-5 h-5 transition-all duration-300", open && "rotate-180")} />
          </button>
        </div>

        <nav className="flex-1 overflow-auto py-2">
          <ul className="space-y-1 p-2">
            {navItems.map((item) => {
              const active =
                pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-md hover:bg-accent/5",
                      active ? "bg-accent/10 font-medium" : ""
                    )}
                  >
                    <span
                      className={cn(
                        "text-muted-foreground flex-none transition-all duration-300",
                        open ? "" : "mx-auto"
                      )}
                    >
                      {item.icon}
                    </span>
                    {open && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-3 border-t text-xs text-muted-foreground">
          {open ? "Versión 0.1" : "v0.1"}
        </div>
      </div>
    </aside>
  );
}
