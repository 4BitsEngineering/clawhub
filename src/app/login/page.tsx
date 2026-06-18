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

async function devLoginAction(formData: FormData) {
  "use server";
  if (process.env.DEV_AUTH_ENABLED !== "true") return;
  const role = formData.get("role") as string;
  const targetRole = role === "OPERATOR" ? "OPERATOR" : "FIRM_ADMIN";
  let user = await db.user.findFirst({
    where: { role: targetRole },
    orderBy: { createdAt: "asc" },
  });
  // Fase de validación: si no hay ningún usuario de ese rol, auto-provisiona uno
  // DEV con email SINTÉTICO (no una identidad real). Solo con DEV_AUTH_ENABLED.
  // Cuando montemos login real, esto se quita y se crean usuarios de verdad.
  if (!user && targetRole === "OPERATOR") {
    user = await db.user.create({
      data: {
        email: "dev-operator@clawhub.local",
        name: "Dev Operator",
        role: "OPERATOR",
        emailVerified: new Date(),
      },
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
  searchParams: Promise<{ sent?: string }>;
}) {
  const params = await searchParams;
  const sent = params?.sent === "1";
  const devEnabled = process.env.DEV_AUTH_ENABLED === "true";

  return (
    <main className="relative min-h-screen flex items-center justify-center p-6">
      <div
        aria-hidden
        className="spotlight pointer-events-none absolute inset-x-0 top-0 h-[500px]"
      />
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <Card className="card-paper border-0 shadow-none w-full max-w-md relative">
        <CardHeader className="space-y-3">
          <div className="eyebrow-chip self-start">clawhub · acceso</div>
          <CardTitle className="font-display text-2xl">
            Entrar al panel
          </CardTitle>
          <CardDescription>
            Fase de validación: entra directo como <strong>Operator (Admin)</strong>.
            El login por email llegará después.
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
                  style={{
                    backgroundColor: "var(--brand)",
                    color: "var(--brand-foreground)",
                  }}
                >
                  Entrar como Operator (Admin) →
                </Button>
              </form>
              <form action={devLoginAction}>
                <input type="hidden" name="role" value="FIRM_ADMIN" />
                <Button type="submit" variant="outline" size="sm" className="w-full">
                  Entrar como Firm Admin
                </Button>
              </form>
              <p className="text-xs text-muted-foreground">
                Acceso directo sin verificación (<code>DEV_AUTH_ENABLED</code>).
                Desactívalo o añade login real antes de abrir la URL al público.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              El acceso de validación está desactivado. Configura el login real.
            </p>
          )}

          <details className="border-t pt-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Login por email (magic link · próximamente)
            </summary>
            {sent ? (
              <p className="pt-3 text-sm text-muted-foreground">
                ✔ Magic link generado. Revisa la consola del server.
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
