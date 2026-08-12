"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/sales", label: "Prospects", exact: true },
  { href: "/sales/campaigns", label: "Campañas", exact: false },
  { href: "/sales/commissions", label: "Comisiones", exact: false },
  { href: "/sales/profile", label: "Perfil", exact: false },
];

// Paleta AI-Office (ver .aio-canvas en globals.css)
const NAVY_DEEP = "#082130";
const YELLOW = "#f2c94c";

export function SalesNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden sm:flex items-center gap-0.5">
      {navItems.map((item) => {
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
