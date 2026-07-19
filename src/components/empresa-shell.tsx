import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

export function EmpresaShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="sticky top-0 z-30 border-b border-violet-700/30"
        style={{ backgroundColor: "#2e1065" }}
      >
        <div className="container-page flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <Link
              href="/empresa"
              className="text-sm font-semibold tracking-tight text-white hover:text-violet-100 transition-colors"
            >
              AI-Office · Empresa
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              <Link
                href="/empresa"
                className="px-3 py-1 text-xs text-violet-200/80 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                Comerciales
              </Link>
              <Link
                href="/empresa/prospects"
                className="px-3 py-1 text-xs text-violet-200/80 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                Mis prospects
              </Link>
              <Link
                href="/empresa/campaigns"
                className="px-3 py-1 text-xs text-violet-200/80 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                Campañas
              </Link>
              <Link
                href="/empresa/landing"
                className="px-3 py-1 text-xs text-violet-200/80 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                Landing
              </Link>
              <Link
                href="/empresa/commissions"
                className="px-3 py-1 text-xs text-violet-200/80 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                Comisiones
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-xs text-violet-200/70">
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
