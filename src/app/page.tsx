import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { buttonVariants } from "@/components/ui/button";

export default async function HomePage() {
  const session = await getSession();

  if (session?.user) {
    if (session.user.role === "OPERATOR") redirect("/operator");
    if (session.user.role === "FIRM_ADMIN") redirect("/firm");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">clawhub</h1>
        <p className="text-sm text-muted-foreground">
          Control plane multi-tenant para instancias de OpenClaw Copilot.
        </p>
        <Link href="/login" className={buttonVariants({ size: "lg" })}>
          Iniciar sesión
        </Link>
        <p className="text-xs text-muted-foreground pt-8">
          v0 en construcción · <code>SPEC.md</code>
        </p>
      </div>
    </main>
  );
}
