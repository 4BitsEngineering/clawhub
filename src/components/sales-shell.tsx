import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SalesNav } from "@/components/sales-nav";

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
        className="sticky top-0 z-30 border-b border-emerald-900/40"
        style={{
          background: "linear-gradient(135deg, #064e3b 0%, #065f46 100%)",
        }}
      >
        <div className="container-page flex items-center justify-between h-14">
          <div className="flex items-center gap-5">
            <Link
              href="/sales"
              className="text-sm font-bold tracking-tight text-white hover:text-emerald-100 transition-colors"
            >
              AI-Office
              <span className="ml-1.5 text-emerald-300/70 font-normal">
                Comercial
              </span>
            </Link>
            <SalesNav />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-xs text-emerald-200/60 font-mono">
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
