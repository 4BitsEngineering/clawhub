import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { OperatorNav } from "@/components/operator-nav";

// Paleta AI-Office (ver .aio-canvas en globals.css)
const NAVY = "#0c2b3d";
const NAVY_DEEP = "#082130";
const CREAM = "#f5efe4";
const YELLOW = "#f2c94c";

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
        className="sticky top-0 z-30 border-b"
        style={{
          backgroundColor: NAVY,
          borderColor: "rgba(245,239,228,0.12)",
        }}
      >
        <div className="container-page flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link
              href="/operator"
              className="text-sm font-bold tracking-tight transition-opacity hover:opacity-80"
              style={{ color: CREAM }}
            >
              AI&nbsp;Office
            </Link>
            <span
              className="hidden sm:inline-block text-[11px] px-2.5 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: YELLOW, color: NAVY_DEEP }}
            >
              Operaciones
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="hidden md:inline text-xs"
              style={{ color: "rgba(245,239,228,0.7)" }}
            >
              {email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* ── Nav secundaria (client component) ── */}
      <OperatorNav />

      {/* ── Zona de trabajo (tema AI-Office) ── */}
      <div className="flex-1 aio-canvas">
        {flush ? (
          children
        ) : (
          <div className="container-page py-8 sm:py-10">{children}</div>
        )}
      </div>
    </div>
  );
}
