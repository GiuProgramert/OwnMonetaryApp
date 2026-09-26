"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isNavItemActive, navItems } from "@/lib/nav-items";
import { DollarSign, ChevronLeft } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(true);

  return (
    <aside
      className={cn(
        "hidden md:block sticky top-5 h-[calc(100dvh-2.5rem)] transition-all duration-500 shrink-0 bg-card border-r border-border rounded-md",
        open ? "w-64" : "w-20"
      )}
    >
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-b-foreground/10">
          <div className="flex items-center gap-2 min-w-0">
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
            className="p-1 rounded hover:bg-accent/10 shrink-0"
          >
            <ChevronLeft className={cn("w-5 h-5 transition-all duration-300", open && "rotate-180")} />
          </button>
        </div>

        <nav className="flex-1 overflow-auto py-2">
          <ul className="space-y-1 p-2">
            {navItems.map((item) => {
              const active = isNavItemActive(pathname, item.href);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
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
                      <Icon className="w-5 h-5" />
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
