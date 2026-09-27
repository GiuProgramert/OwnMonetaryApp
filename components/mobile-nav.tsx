"use client";

import { LayoutGrid, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isNavItemActive, navItems } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

function NavIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
      )}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

const barItemClass = "flex h-16 w-full flex-col items-center justify-center gap-1";

function barLabelClass(active: boolean) {
  return cn(
    "text-[11px] leading-none",
    active ? "font-medium text-foreground" : "text-muted-foreground"
  );
}

export default function MobileNav() {
  const pathname = usePathname();

  const pinnedItems = navItems.filter((item) => item.mobilePinned);
  const menuItems = navItems.filter((item) => !item.mobilePinned);
  const menuActive = menuItems.some((item) => isNavItemActive(pathname, item.href));

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-3 bottom-3 z-40 md:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5 rounded-2xl border border-border bg-card/95 px-1 shadow-lg backdrop-blur">
        {pinnedItems.map((item) => {
          const active = isNavItemActive(pathname, item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={barItemClass}
              >
                <NavIcon icon={item.icon} active={active} />
                <span className={barLabelClass(active)}>{item.shortLabel}</span>
              </Link>
            </li>
          );
        })}

        <li>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Abrir menú" className={barItemClass}>
                <NavIcon icon={LayoutGrid} active={menuActive} />
                <span className={barLabelClass(menuActive)}>Menú</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="end"
              sideOffset={12}
              collisionPadding={12}
              // Mismo ancho que la barra (`inset-x-3`): con `collisionPadding={12}` Radix lo
              // corre hasta que entra entre los dos márgenes, así que queda centrado.
              className="w-[calc(100vw-1.5rem)] rounded-3xl p-4 shadow-xl"
            >
              <p className="px-1 pb-3 text-sm font-medium text-muted-foreground">
                Más secciones
              </p>
              {/* flex + ancho de 1/3 en vez de grid: una fila incompleta queda centrada. */}
              <div className="flex flex-wrap justify-center gap-3">
                {menuItems.map((item) => {
                  const active = isNavItemActive(pathname, item.href);
                  const Icon = item.icon;

                  return (
                    // `asChild` + `Link`: el menú se cierra solo al navegar.
                    <DropdownMenuItem key={item.href} asChild>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className="flex w-[calc((100%-1.5rem)/3)] flex-col items-center gap-2 rounded-2xl p-2 text-center"
                      >
                        <span
                          className={cn(
                            "flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-gradient-to-b from-muted to-muted/40 text-foreground"
                          )}
                        >
                          <Icon className="h-7 w-7" />
                        </span>
                        <span className="text-xs leading-tight">{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ul>
    </nav>
  );
}
