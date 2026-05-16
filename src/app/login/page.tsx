import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEV_COOKIE } from "@/lib/session";
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
  const user = await db.user.findFirst({
    where: { role: targetRole },
    orderBy: { createdAt: "asc" },
  });
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
      <Card className="card-paper border-0 shadow-none w-full max-w-md relative">
        <CardHeader className="space-y-3">
          <div className="eyebrow-chip self-start">clawhub · acceso</div>
          <CardTitle className="font-display text-2xl">
            Entrar al panel
          </CardTitle>
          <CardDescription>
            Introduce tu email — te enviaremos un magic link. En dev se
            imprime al stdout del server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {sent ? (
            <div className="text-sm text-muted-foreground space-y-2">
              <p>✔ Magic link generado.</p>
              <p>
                Mira la consola del server donde corre <code>npm run dev</code>.
                Verás un bloque con la URL — cópiala al navegador.
              </p>
            </div>
          ) : (
            <form action={loginAction} className="space-y-4">
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
              <Button
                type="submit"
                className="w-full"
                style={{
                  backgroundColor: "var(--brand)",
                  color: "var(--brand-foreground)",
                }}
              >
                Enviar magic link
              </Button>
            </form>
          )}

          {devEnabled && (
            <div className="pt-4 border-t space-y-3">
              <p className="text-xs text-muted-foreground">
                <strong>Modo dev:</strong> login directo sin verificación.
                Quitar <code>DEV_AUTH_ENABLED</code> en producción.
              </p>
              <form action={devLoginAction}>
                <input type="hidden" name="role" value="OPERATOR" />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Entrar como Operator
                </Button>
              </form>
              <form action={devLoginAction}>
                <input type="hidden" name="role" value="FIRM_ADMIN" />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Entrar como Firm Admin (Asesoría Demo)
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
