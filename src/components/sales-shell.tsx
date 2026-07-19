import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

export function SalesShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="sticky top-0 z-30 border-b border-emerald-700/30"
        style={{ backgroundColor: "#064e3b" }}
      >
        <div className="container-page flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <Link
              href="/sales"
              className="text-sm font-semibold tracking-tight text-white hover:text-emerald-100 transition-colors"
            >
              AI-Office · Mis ventas
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              <Link
                href="/sales"
                className="px-3 py-1 text-xs text-emerald-200/80 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                Mis prospects
              </Link>
              <Link
                href="/sales/campaigns"
                className="px-3 py-1 text-xs text-emerald-200/80 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                Campañas
              </Link>
              <Link
                href="/sales/commissions"
                className="px-3 py-1 text-xs text-emerald-200/80 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                Mis comisiones
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-xs text-emerald-200/70">
              {email}
            </span>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="flex-1 bg-background">
        <div className="container-page py-8 sm:py-10">{children}</div>
      </div>
    </div>
  );
}
