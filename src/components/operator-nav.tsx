"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/operator", label: "Panel", exact: true },
  { href: "/operator/mass-actions", label: "Comandos masivos", exact: false },
  { href: "/operator/stack", label: "Stack", exact: false },
  { href: "/operator/mcp", label: "MCP", exact: false },
  { href: "/operator/activity", label: "Actividad", exact: false },
  { href: "/empresa", label: "Ventas", exact: false },
];

// Paleta AI-Office (ver .aio-canvas en globals.css)
const NAVY_DEEP = "#082130";
const CREAM = "#f5efe4";
const YELLOW = "#f2c94c";

export function OperatorNav() {
  const pathname = usePathname();

  function isActive(item: (typeof navItems)[number]) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <nav
      className="border-b"
      style={{
        backgroundColor: NAVY_DEEP,
        borderColor: "rgba(245,239,228,0.12)",
      }}
    >
      <div className="container-page flex items-center justify-between h-10">
        <div className="flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center h-7 px-3 text-xs rounded-full transition-colors"
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
        </div>
        <Link
          href="/operator/firms/new"
          className="inline-flex items-center h-7 px-3 text-xs font-semibold rounded-full shadow-sm shrink-0"
          style={{ backgroundColor: CREAM, color: NAVY_DEEP }}
        >
          + Nueva empresa
        </Link>
      </div>
    </nav>
  );
}
