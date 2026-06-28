import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { OperatorNav } from "@/components/operator-nav";

export function OperatorShell({
  email,
  children,
  flush,
}: {
  email: string;
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Topbar ── */}
      <header
        className="sticky top-0 z-30 border-b border-blue-700/30"
        style={{ backgroundColor: "#1e3a5f" }}
      >
        <div className="container-page flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <Link href="/operator" className="text-sm font-semibold tracking-tight text-white hover:text-blue-100 transition-colors">
              AI-Office Center
            </Link>
            <span className="hidden sm:inline text-xs text-blue-200/70">
              Panel de operador
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-xs text-blue-200/70">
              {email}
            </span>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* ── Nav secundaria (client component) ── */}
      <OperatorNav />

      {/* ── Zona de trabajo ── */}
      <div className="flex-1 bg-background">
        {flush ? (
          children
        ) : (
          <div className="container-page py-8 sm:py-10">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
