// Activación de cuenta del comprador (change buyer-account-activation).
// El email de licencia trae /activar?token=<plain>; aquí el cliente crea su
// contraseña (scrypt) y el token queda usado. Si el enlace caducó, puede pedir
// un reenvío (respuesta neutra: no revelamos si la cuenta existe).
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken, generateInstanceToken } from "@/lib/tokens";
import { hashPassword } from "@/lib/password";
import { sendEmail } from "@/lib/mailer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const MIN_PASSWORD = 8;
// Máximo de reenvíos por usuario y hora (anti mail-bombing).
const RESEND_CAP_PER_HOUR = 3;

// Token válido = existe, sin usar, sin caducar y su usuario sigue sin contraseña.
async function findValidToken(plain: string) {
  if (!plain) return null;
  const t = await db.accountSetupToken.findUnique({
    where: { tokenHash: hashToken(plain) },
    include: { user: { select: { id: true, email: true, passwordHash: true } } },
  });
  if (!t || t.usedAt || t.expiresAt < new Date() || t.user.passwordHash) {
    return null;
  }
  return t;
}

async function setPasswordAction(formData: FormData) {
  "use server";
  const token = ((formData.get("token") as string) ?? "").trim();
  const pwd = (formData.get("password") as string) ?? "";
  const pwd2 = (formData.get("password2") as string) ?? "";

  const t = await findValidToken(token);
  if (!t) redirect("/activar?error=invalid");
  if (pwd.length < MIN_PASSWORD || pwd !== pwd2) {
    redirect(`/activar?token=${encodeURIComponent(token)}&error=pwd`);
  }

  await db.$transaction([
    db.user.update({
      where: { id: t.userId },
      data: { passwordHash: hashPassword(pwd) },
    }),
    db.accountSetupToken.update({
      where: { id: t.id },
      data: { usedAt: new Date() },
    }),
  ]);

  redirect("/login?activated=1");
}

async function resendAction(formData: FormData) {
  "use server";
  const email = ((formData.get("email") as string) ?? "").trim().toLowerCase();
  if (email) {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, role: true, passwordHash: true },
    });
    if (user && user.role === "FIRM_ADMIN" && !user.passwordHash) {
      const recent = await db.accountSetupToken.count({
        where: {
          userId: user.id,
          createdAt: { gte: new Date(Date.now() - 3600_000) },
        },
      });
      if (recent < RESEND_CAP_PER_HOUR) {
        // Un solo token vivo por usuario: invalidar los anteriores.
        await db.accountSetupToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        const { plain, hash } = generateInstanceToken();
        await db.accountSetupToken.create({
          data: {
            userId: user.id,
            tokenHash: hash,
            expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
          },
        });
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        await sendEmail({
          to: email,
          subject: "Activa tu cuenta de AI-Office",
          html: `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
  <h1 style="font-size:20px;margin:0 0 8px">Activa tu cuenta de AI-Office</h1>
  <p style="color:#555;line-height:1.6">
    Crea tu contraseña para acceder a tu portal de cliente: código de
    activación, consumo y facturación.
  </p>
  <div style="text-align:center;margin:24px 0">
    <a href="${appUrl}/activar?token=${plain}"
       style="display:inline-block;background:#0c2b3d;color:#f5efe4;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:600">
      Activa tu cuenta
    </a>
  </div>
  <p style="color:#888;font-size:12px">
    El enlace caduca en 7 días y es de un solo uso. Nunca te pediremos tu
    contraseña por email. Si no has solicitado esto, ignora este mensaje.
  </p>
  <p style="color:#aaa;font-size:12px;margin-top:24px">AI-Office · 4bits Engineering</p>
</div>`,
        });
      }
    }
  }
  // Respuesta neutra siempre — no revela si la cuenta existe.
  redirect("/activar?resent=1");
}

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; resent?: string }>;
}) {
  const params = await searchParams;
  const token = (params?.token ?? "").trim();
  const pwdError = params?.error === "pwd";
  const invalidError = params?.error === "invalid";
  const resent = params?.resent === "1";

  const valid = token && !invalidError ? await findValidToken(token) : null;

  return (
    <main className="aio-canvas relative min-h-screen flex items-center justify-center p-6">
      <div className="absolute top-6 left-6 flex items-center gap-3">
        <span className="text-lg font-bold tracking-tight" style={{ color: "#f5efe4" }}>
          AI&nbsp;Office
        </span>
        <span
          className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold"
          style={{ backgroundColor: "#f2c94c", color: "#082130" }}
        >
          activación
        </span>
      </div>

      <div className="w-full max-w-md relative space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-bold leading-tight" style={{ color: "#f5efe4" }}>
            Activa tu cuenta
          </h1>
          <p className="text-base" style={{ color: "rgba(245,239,228,0.75)" }}>
            Tu portal de cliente: código de activación, consumo y facturación.
          </p>
        </div>

        {resent && (
          <div
            className="rounded-xl px-5 py-4 text-sm text-center"
            style={{
              backgroundColor: "rgba(242,201,76,0.15)",
              color: "#f5efe4",
              border: "1px solid rgba(242,201,76,0.4)",
            }}
          >
            ✉ Si existe una cuenta pendiente de activar con ese email,
            recibirás un enlace nuevo en unos minutos.
          </div>
        )}

        <Card className="card-paper border-0 rounded-2xl">
          <CardContent className="p-8 space-y-5">
            {valid ? (
              <form action={setPasswordAction} className="space-y-4">
                <input type="hidden" name="token" value={token} />
                <p className="text-sm" style={{ color: "#4a4a42" }}>
                  Cuenta: <strong>{valid.user.email}</strong>
                </p>
                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-[11px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: "#8a8574" }}
                  >
                    Contraseña (mín. {MIN_PASSWORD} caracteres)
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={MIN_PASSWORD}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="h-12 rounded-xl text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="password2"
                    className="text-[11px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: "#8a8574" }}
                  >
                    Repite la contraseña
                  </Label>
                  <Input
                    id="password2"
                    name="password2"
                    type="password"
                    required
                    minLength={MIN_PASSWORD}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="h-12 rounded-xl text-base"
                  />
                </div>
                {pwdError && (
                  <p className="text-sm font-semibold" style={{ color: "#b3261e" }}>
                    Las contraseñas no coinciden o son demasiado cortas.
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
                  Crear contraseña y activar →
                </Button>
              </form>
            ) : (
              <div className="space-y-5">
                {(token || invalidError) && (
                  <p className="text-sm font-semibold" style={{ color: "#b3261e" }}>
                    Este enlace de activación no es válido: puede haber caducado,
                    haberse usado ya, o la cuenta ya está activa.
                  </p>
                )}
                <p className="text-sm" style={{ color: "#4a4a42" }}>
                  Escribe el email con el que compraste y te enviamos un enlace
                  nuevo. Si tu cuenta ya está activa, entra directamente desde{" "}
                  <a href="/login" className="underline font-semibold">
                    la página de acceso
                  </a>
                  .
                </p>
                <form action={resendAction} className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="text-[11px] font-bold uppercase tracking-[0.14em]"
                      style={{ color: "#8a8574" }}
                    >
                      Email de compra
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="tu@email.com"
                      className="h-12 rounded-xl text-base"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl text-base font-semibold"
                    style={{
                      backgroundColor: "var(--brand)",
                      color: "var(--brand-foreground)",
                    }}
                  >
                    Enviarme el enlace →
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
