import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEV_COOKIE } from "@/lib/session";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function loginAction(formData: FormData) {
  "use server";
  const email = (formData.get("email") as string | null)?.trim();
  if (!email) return;
  await signIn("nodemailer", { email, redirectTo: "/" });
}

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
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const sent = params?.sent === "1";
  const credError = params?.error === "cred";
  const devEnabled = process.env.DEV_AUTH_ENABLED === "true";

  return (
    <main className="aio-canvas relative min-h-screen flex items-center justify-center p-6">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
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
      <Card className="card-paper border-0 w-full max-w-md relative">
        <CardHeader className="space-y-3">
          <CardTitle
            className="text-3xl"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Entrar al panel<span style={{ color: "#f2c94c" }}>.</span>
          </CardTitle>
          <CardDescription>
            {devEnabled
              ? "Fase de validación: entra directo con un rol o usa tu email."
              : "Entra con tu contraseña o pide un enlace de acceso por email."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {devEnabled ? (
            <div className="space-y-3">
              <form action={devLoginAction}>
                <input type="hidden" name="role" value="OPERATOR" />
                <Button
                  type="submit"
                  className="w-full"
                  style={{ backgroundColor: "var(--brand)", color: "var(--brand-foreground)" }}
                >
                  Entrar como Operator (Admin) →
                </Button>
              </form>
              <form action={devLoginAction}>
                <input type="hidden" name="role" value="EMPRESA" />
                <Button type="submit" variant="secondary" className="w-full">
                  Entrar como Empresa →
                </Button>
              </form>
              <form action={devLoginAction}>
                <input type="hidden" name="role" value="COMERCIAL" />
                <Button type="submit" variant="outline" className="w-full">
                  Entrar como Comercial →
                </Button>
              </form>
              <form action={devLoginAction}>
                <input type="hidden" name="role" value="FIRM_ADMIN" />
                <Button type="submit" variant="ghost" className="w-full">
                  Entrar como Firm Admin →
                </Button>
              </form>
              <p className="text-xs text-muted-foreground">
                Acceso directo de validación sin verificación
                (<code>DEV_AUTH_ENABLED</code>). Desactívalo o añade login real
                antes de abrir la URL al público.
              </p>
            </div>
          ) : null}

          {/* Login con contraseña (solo usuarios con contraseña asignada) */}
          <form action={passwordLoginAction} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="cred-email">Email</Label>
              <Input
                id="cred-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="tu@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cred-password">Contraseña</Label>
              <Input
                id="cred-password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>
            {credError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                Email o contraseña incorrectos.
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              style={{
                backgroundColor: "var(--brand)",
                color: "var(--brand-foreground)",
              }}
            >
              Entrar →
            </Button>
          </form>

          <details className="border-t pt-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Login por email (magic link)
            </summary>
            {sent ? (
              <p className="pt-3 text-sm text-muted-foreground">
                ✔ Enlace de acceso enviado. Revisa tu email — si no llega en
                unos minutos, mira en spam.
              </p>
            ) : (
              <form action={loginAction} className="space-y-3 pt-3">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="tu@email.com"
                  />
                </div>
                <Button type="submit" variant="outline" size="sm" className="w-full">
                  Enviar magic link
                </Button>
              </form>
            )}
          </details>
        </CardContent>
      </Card>
    </main>
  );
}
