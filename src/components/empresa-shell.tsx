import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { EmpresaNav } from "@/components/empresa-nav";

// Paleta AI-Office (ver .aio-canvas en globals.css)
const NAVY = "#0c2b3d";
const NAVY_DEEP = "#082130";
const CREAM = "#f5efe4";
const YELLOW = "#f2c94c";

export function EmpresaShell({
  email,
  isOperator = false,
  children,
}: {
  email: string;
  // Campañas y Landing solo las edita el administrador (OPERATOR)
  isOperator?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          backgroundColor: NAVY,
          borderColor: "rgba(245,239,228,0.12)",
        }}
      >
        <div className="container-page flex items-center justify-between h-14">
          <div className="flex items-center">
            <Link
              href="/empresa"
              className="text-sm font-bold tracking-tight transition-opacity hover:opacity-80"
              style={{ color: CREAM }}
            >
              AI&nbsp;Office
            </Link>
            <span
              className="hidden sm:inline-block ml-3 text-[11px] px-2.5 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: YELLOW, color: NAVY_DEEP }}
            >
              Empresa
            </span>
            {/* Separador entre logo y navegación */}
            <span
              aria-hidden
              className="hidden sm:block mx-6 h-5 w-px"
              style={{ backgroundColor: "rgba(245,239,228,0.15)" }}
            />
            <EmpresaNav isOperator={isOperator} />
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
      <div className="flex-1 aio-canvas">
        <div className="container-page py-8 sm:py-10">{children}</div>
      </div>
    </div>
  );
}
