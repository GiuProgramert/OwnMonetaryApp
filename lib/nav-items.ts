import {
  Activity,
  HandCoins,
  Home,
  Shapes,
  Target,
  User,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  /** Etiqueta corta para la barra inferior en móvil. */
  shortLabel: string;
  href: string;
  icon: LucideIcon;
  /** `true` = ítem fijo en la barra inferior de móvil; `false` = va al menú "Más". */
  mobilePinned: boolean;
}

export const navItems: NavItem[] = [
  {
    label: "Dashboard",
    shortLabel: "Inicio",
    href: "/protected",
    icon: Home,
    mobilePinned: true,
  },
  {
    label: "Cuentas",
    shortLabel: "Cuentas",
    href: "/protected/accounts",
    icon: User,
    mobilePinned: true,
  },
  {
    label: "Movimientos",
    shortLabel: "Movs.",
    href: "/protected/movements",
    icon: Activity,
    mobilePinned: true,
  },
  {
    label: "Tipos de movimientos",
    shortLabel: "Tipos",
    href: "/protected/movement-types",
    icon: Shapes,
    mobilePinned: false,
  },
  {
    label: "Presupuestos",
    shortLabel: "Topes",
    href: "/protected/budgets",
    icon: Target,
    mobilePinned: true,
  },
  {
    label: "Deudas",
    shortLabel: "Deudas",
    href: "/protected/debts",
    icon: HandCoins,
    mobilePinned: false,
  },
];

export function isNavItemActive(pathname: string | null, href: string) {
  if (!pathname) {
    return false;
  }

  // El dashboard vive en la raíz de /protected, así que un startsWith lo marcaría
  // activo en todas las pantallas.
  if (href === "/protected") {
    return pathname === "/protected";
  }

  return pathname === href || pathname.startsWith(href + "/");
}
