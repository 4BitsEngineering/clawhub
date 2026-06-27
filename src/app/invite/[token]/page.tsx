/**
 * /invite/[token] — el destinatario abre este link para aceptar la invitación.
 *
 * Flujo:
 *   1. GET muestra resumen: "Te han invitado a Asesoría XYZ como firm_admin".
 *   2. POST (form action) crea/asocia el User y le mete una cookie de sesión
 *      dev (DEV_AUTH_ENABLED) o redirige a magic-link cuando Resend esté.
 *
 * Si la invitación ha caducado / ya se usó → mensaje claro.
 *
 * Idempotente: si el mismo email ya tiene User, lo actualiza con el nuevo
 * firmId/role siempre y cuando no sea un downgrade peligroso (un OPERATOR
 * que recibe invite FIRM_ADMIN no se degrada).
 */
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { recordActivity, systemActor } from "@/lib/activity";
import { DEV_COOKIE } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitation = await db.invitation.findUnique({
    where: { token },
    include: {
      firm: { select: { id: true, name: true } },
    },
  });

  if (!invitation) notFound();

  const expired = invitation.expiresAt < new Date();
  const used = invitation.usedAt != null;

  async function acceptInvitation() {
    "use server";
    const fresh = await db.invitation.findUnique({
      where: { token },
      include: { firm: { select: { id: true, name: true } } },
    });
    if (!fresh) throw new Error("invitation_not_found");
    if (fresh.usedAt) throw new Error("already_used");
    if (fresh.expiresAt < new Date()) throw new Error("expired");

    // 1. Buscar User por email. Si existe → update (sin degradar OPERATOR a
    //    FIRM_ADMIN). Si no existe → create.
    let user = await db.user.findUnique({
      where: { email: fresh.email },
    });

    if (user) {
      const isDowngrade =
        user.role === "OPERATOR" && fresh.role === "FIRM_ADMIN";
      if (!isDowngrade) {
        user = await db.user.update({
          where: { id: user.id },
          data: {
            role: fresh.role,
            firmId: fresh.firmId,
          },
        });
      }
      // si es downgrade, dejamos al user como está (OPERATOR sigue siendo
      // OPERATOR, pero ahora con firmId si lo necesita)
    } else {
      user = await db.user.create({
        data: {
          email: fresh.email,
          role: fresh.role,
          firmId: fresh.firmId,
          emailVerified: new Date(), // ya está verificado por el flujo de invite
        },
      });
    }

    await db.invitation.update({
      where: { id: fresh.id },
      data: {
        usedAt: new Date(),
        usedByUserId: user.id,
      },
    });

    await recordActivity({
      kind: "user.invite_accepted",
      summary: `${fresh.email} aceptó invitación a ${fresh.firm?.name ?? "operator"} como ${fresh.role}`,
      firmId: fresh.firmId,
      actor: systemActor("invite-accept"),
      metadata: {
        invitation_id: fresh.id,
        user_id: user.id,
        role: fresh.role,
      },
    });

    // Auto-login mientras Resend no está. Setea la cookie dev y redirige.
    // En prod (sin DEV_AUTH_ENABLED) este path no auto-loguea — el user
    // tendrá que ir a /login y usar magic link (cuando llegue).
    if (process.env.DEV_AUTH_ENABLED === "true") {
      const c = await cookies();
      c.set(DEV_COOKIE, user.id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 días
      });
    }

    redirect(user.role === "OPERATOR" ? "/operator" : "/firm");
  }

  return (
    <main className="container-page min-h-screen py-16 flex items-start justify-center">
      <Card className="card-paper border-0 shadow-none p-0 max-w-md w-full">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-2xl">
            Invitación a AI-Office Center
          </CardTitle>
          <CardDescription>
            {invitation.firm?.name
              ? `Te han invitado a unirte a ${invitation.firm.name}`
              : "Te han invitado como operator de AI-Office Center"}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 space-y-4">
          <div className="card-quiet p-4 space-y-1 text-sm">
            <div>
              <span className="text-muted-foreground">Email:</span>{" "}
              <strong>{invitation.email}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Rol:</span>{" "}
              <strong>
                {invitation.role === "OPERATOR" ? "Operator" : "Admin de firma"}
              </strong>
            </div>
            {invitation.firm && (
              <div>
                <span className="text-muted-foreground">Firma:</span>{" "}
                <strong>{invitation.firm.name}</strong>
              </div>
            )}
          </div>

          {used ? (
            <div className="card-quiet p-4 border-l-4 border-amber-500">
              <p className="text-sm">
                Esta invitación ya fue aceptada el{" "}
                {invitation.usedAt!.toLocaleString("es-ES")}. Si crees que es
                un error, pide una nueva al administrador.
              </p>
            </div>
          ) : expired ? (
            <div className="card-quiet p-4 border-l-4 border-red-500">
              <p className="text-sm">
                Esta invitación caducó el{" "}
                {invitation.expiresAt.toLocaleString("es-ES")}. Pide una nueva
                al administrador.
              </p>
            </div>
          ) : (
            <form action={acceptInvitation}>
              <Button
                type="submit"
                className="w-full h-11"
                style={{
                  backgroundColor: "var(--brand)",
                  color: "var(--brand-foreground)",
                }}
              >
                Aceptar invitación
              </Button>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Caduca el {invitation.expiresAt.toLocaleString("es-ES")}
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
