"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const items = [
  { href: (id: string) => `/operator/firms/${id}`, label: "General", exact: true },
  { href: (id: string) => `/operator/firms/${id}/team`, label: "Equipo", exact: false },
  { href: (id: string) => `/operator/firms/${id}/skills`, label: "Skills", exact: false },
  { href: (id: string) => `/operator/firms/${id}/users`, label: "Usuarios", exact: false },
  { href: (id: string) => `/firm/baselines?firmId=${id}`, label: "Baselines", exact: false, matchPath: "/firm/baselines" },
  { href: (id: string) => `/operator/firms/${id}/edit`, label: "Editar", exact: false },
];

export function FirmSubnav({ firmId, firmName }: { firmId: string; firmName: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function isActive(item: (typeof items)[number]) {
    const href = item.href(firmId);
    if (item.matchPath) {
      return pathname.startsWith(item.matchPath) && searchParams.get("firmId") === firmId;
    }
    if (item.exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div className="border-b border-border bg-muted/40">
      <div className="container-page py-4 space-y-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/operator/firms/${firmId}`}
            className="font-display text-lg font-semibold tracking-tight hover:text-brand transition-colors"
          >
            {firmName}
          </Link>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto -mb-4 pb-0">
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.label}
                href={item.href(firmId)}
                className={
                  active
                    ? "inline-flex items-center h-9 px-3 text-sm font-medium text-foreground border-b-2 border-brand"
                    : "inline-flex items-center h-9 px-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
