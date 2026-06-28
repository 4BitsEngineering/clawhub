"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/operator", label: "Panel", exact: true },
  { href: "/operator/mass-actions", label: "Comandos masivos", exact: false },
  { href: "/operator/stack", label: "Stack", exact: false },
  { href: "/operator/mcp", label: "MCP", exact: false },
  { href: "/operator/activity", label: "Actividad", exact: false },
];

export function OperatorNav() {
  const pathname = usePathname();

  function isActive(item: (typeof navItems)[number]) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <nav
      className="border-b border-blue-800/30"
      style={{ backgroundColor: "#16325a" }}
    >
      <div className="container-page flex items-center justify-between h-10">
        <div className="flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "inline-flex items-center h-7 px-3 text-xs font-medium rounded-md bg-white/15 text-white border-b-2 border-white"
                    : "inline-flex items-center h-7 px-3 text-xs text-blue-200/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <Link
          href="/operator/firms/new"
          className="inline-flex items-center h-7 px-3 text-xs font-semibold rounded-md shadow-sm bg-white text-blue-900 shrink-0"
        >
          + Nueva empresa
        </Link>
      </div>
    </nav>
  );
}
