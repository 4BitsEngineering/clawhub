import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEV_COOKIE } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function passwordLoginAction(formData: FormData) {
  "use server";
  const email = (formData.get("email") as string | null)?.trim();
  const password = (formData.get("password") as string | null) ?? "";
  if (!email || !password) redirect("/login?error=cred");
  try {
    await signIn("credentials", { email, password, redirectTo: "/" });
  } catch (err) {
    // signIn lanza NEXT_REDIRECT en éxito — re-lanzar; el resto es credencial
    // inválida → error genérico (no revelar si el email existe).
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    redirect("/login?error=cred");
  }
}

async function devLoginAction(formData: FormData) {
  "use server";
  if (process.env.DEV_AUTH_ENABLED !== "true") return;
  const raw = (formData.get("role") as string | null) ?? "";
  const targetRole =
    raw === "FIRM_ADMIN" ? ("FIRM_ADMIN" as const) :
    raw === "EMPRESA"    ? ("EMPRESA" as const) :
    raw === "COMERCIAL"  ? ("COMERCIAL" as const) :
                           ("OPERATOR" as const);

  let user = await db.user.findFirst({
    where: { role: targetRole },
    orderBy: { createdAt: "asc" },
  });

  if (!user) {
    if (targetRole === "OPERATOR") {
      user = await db.user.create({
        data: {
          email: "dev-operator@clawhub.local",
          name: "Dev Operator",
          role: "OPERATOR",
          emailVerified: new Date(),
        },
      });
    } else if (targetRole === "EMPRESA") {
      user = await db.user.create({
        data: {
          email: "dev-empresa@clawhub.local",
          name: "Dev Empresa",
          role: "EMPRESA",
          emailVerified: new Date(),
        },
      });
    } else if (targetRole === "COMERCIAL") {
      user = await db.user.create({
        data: {
          email: "dev-comercial@clawhub.local",
          name: "Dev Comercial",
          role: "COMERCIAL",
          emailVerified: new Date(),
          salesRep: { create: {} },
        },
      });
    }
  }

  if (user && targetRole === "COMERCIAL") {
    await db.salesRep.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
  }

  if (!user) return;
  const c = await cookies();
  c.set(DEV_COOKIE, user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; activated?: string }>;
}) {
  const params = await searchParams;
  const sent = params?.sent === "1";
  const activated = params?.activated === "1";
  const credError = params?.error === "cred";
  const devEnabled = process.env.DEV_AUTH_ENABLED === "true";

  return (
    <main className="aio-canvas relative min-h-screen flex items-center justify-center p-6">
      {/* Wordmark */}
      <div className="absolute top-6 left-6 flex items-center gap-3">
        <span className="text-lg font-bold tracking-tight" style={{ color: "#f5efe4" }}>
          AI&nbsp;Office
        </span>
        <span
          className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold"
          style={{ backgroundColor: "#f2c94c", color: "#082130" }}
        >
          acceso
        </span>
      </div>
      <div className="w-full max-w-md relative space-y-8">
        {/* Hero sobre el lienzo */}
        <div className="text-center space-y-3">
          <h1
            className="text-5xl font-bold leading-tight"
            style={{ color: "#f5efe4" }}
          >
            Tu oficina, con IA
          </h1>
          <p className="text-base" style={{ color: "rgba(245,239,228,0.75)" }}>
            Accede a tu panel de AI&nbsp;Office.
          </p>
        </div>

        {/* Cuenta recién activada (/activar) */}
        {activated && (
          <div
            className="rounded-xl px-5 py-4 text-sm text-center"
            style={{
              backgroundColor: "rgba(242,201,76,0.15)",
              color: "#f5efe4",
              border: "1px solid rgba(242,201,76,0.4)",
            }}
          >
            ✓ Cuenta activada. Entra con tu email y tu nueva contraseña.
          </div>
        )}

        {/* Aviso de magic link enviado (flujo de invitaciones) */}
        {sent && (
          <div
            className="rounded-xl px-5 py-4 text-sm text-center"
            style={{
              backgroundColor: "rgba(242,201,76,0.15)",
              color: "#f5efe4",
              border: "1px solid rgba(242,201,76,0.4)",
            }}
          >
            ✉ Te hemos enviado un enlace de acceso. Revisa tu email (y la
            carpeta de spam).
          </div>
        )}

        {/* Tarjeta de acceso */}
        <Card className="card-paper border-0 rounded-2xl">
          <CardContent className="p-8 space-y-5">
            <form action={passwordLoginAction} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="cred-email"
                  className="text-[11px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "#8a8574" }}
                >
                  Email
                </Label>
                <Input
                  id="cred-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="tu@email.com"
                  className="h-12 rounded-xl text-base"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="cred-password"
                  className="text-[11px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "#8a8574" }}
                >
                  Contraseña
                </Label>
                <Input
                  id="cred-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-12 rounded-xl text-base"
                />
              </div>
              {credError && (
                <p className="text-sm font-semibold" style={{ color: "#b3261e" }}>
                  Email o contraseña incorrectos.
                </p>
              )}
              <Button
                type="submit"
                className="w-full h-12 rounded-xl text-base font-semibold"
                style={{
                  backgroundColor: "var(--brand)",
                  color: "var(--brand-foreground)",
                }}
              >
                Entrar →
              </Button>
            </form>
            <p className="text-xs text-center" style={{ color: "#8a8574" }}>
              ¿Primera vez?{" "}
              <a href="/activar" className="underline font-semibold">
                Activa tu cuenta
              </a>{" "}
              · ¿Has olvidado tu contraseña? Escríbenos a{" "}
              <a href="mailto:info@iaofi.com" className="underline font-semibold">
                info@iaofi.com
              </a>
            </p>
          </CardContent>
        </Card>

        {/* Acceso de validación (solo desarrollo) */}
        {devEnabled && (
          <div className="space-y-2 text-center">
            <p
              className="text-[11px] uppercase tracking-[0.14em] font-bold"
              style={{ color: "rgba(245,239,228,0.5)" }}
            >
              Acceso de validación · solo desarrollo
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                ["OPERATOR", "Operador"],
                ["EMPRESA", "Empresa"],
                ["COMERCIAL", "Comercial"],
                ["FIRM_ADMIN", "Cliente"],
              ].map(([role, label]) => (
                <form key={role} action={devLoginAction}>
                  <input type="hidden" name="role" value={role} />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors hover:bg-white/10"
                    style={{
                      color: "rgba(245,239,228,0.8)",
                      border: "1px solid rgba(245,239,228,0.25)",
                    }}
                  >
                    {label} →
                  </button>
                </form>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
