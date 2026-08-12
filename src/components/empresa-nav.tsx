"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Paleta AI-Office (ver .aio-canvas en globals.css)
const NAVY_DEEP = "#082130";
const YELLOW = "#f2c94c";

export function EmpresaNav({ isOperator }: { isOperator: boolean }) {
  const pathname = usePathname();

  const items = [
    { href: "/empresa", label: "Comerciales", exact: true },
    { href: "/empresa/prospects", label: "Mis prospects", exact: false },
    ...(isOperator
      ? [
          { href: "/empresa/campaigns", label: "Campañas", exact: false },
          { href: "/empresa/landing", label: "Landing", exact: false },
        ]
      : []),
    { href: "/empresa/commissions", label: "Comisiones", exact: false },
  ];

  return (
    <nav className="hidden sm:flex items-center gap-1">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-1 text-xs rounded-full transition-colors"
            style={
              active
                ? { backgroundColor: YELLOW, color: NAVY_DEEP, fontWeight: 600 }
                : { color: "rgba(245,239,228,0.7)" }
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
