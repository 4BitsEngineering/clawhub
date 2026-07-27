"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/sales", label: "Prospects", exact: true },
  { href: "/sales/campaigns", label: "Campañas", exact: false },
  { href: "/sales/commissions", label: "Comisiones", exact: false },
];

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
            className={
              active
                ? "px-3 py-1 text-xs font-semibold text-white bg-white/20 rounded-md"
                : "px-3 py-1 text-xs text-emerald-200/75 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
