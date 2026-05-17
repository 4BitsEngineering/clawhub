/**
 * /firm/users — firm_admin gestiona usuarios y pending invites de su firma.
 *
 * Permite invitar nuevos firm_admins (otros socios/empleados con acceso a
 * clawhub). Las invitaciones generan un link compartible — el firm_admin lo
 * envía por su canal (WhatsApp, Slack, email).
 *
 * Cuando el destinatario abre el link en /invite/[token]:
 *   - Si DEV_AUTH_ENABLED: auto-login y queda dentro.
 *   - En prod (futuro Resend): magic link al email.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { requireFirmAdmin } from "@/lib/session";
import { recordActivity } from "@/lib/activity";
import { AutoRefresh } from "@/components/auto-refresh";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const TOKEN_BYTES = 24;
const EXPIRES_DAYS = 7;

async function detectBaseUrl(): Promise<string> {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

export default async function FirmUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ inviteUrl?: string; copied?: string }>;
}) {
  const session = await requireFirmAdmin();
  const sp = await searchParams;
  const firmId = session.user.firmId;
  const baseUrl = await detectBaseUrl();

  const [firm, users, invitations] = await Promise.all([
    db.firm.findUnique({
      where: { id: firmId },
      select: { id: true, name: true },
    }),
    db.user.findMany({
      where: { firmId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    }),
    db.invitation.findMany({
      where: { firmId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  if (!firm) redirect("/login");

  async function createInviteAction(formData: FormData) {
    "use server";
    const sess = await requireFirmAdmin();
    const email = String(formData.get("email") ?? "").toLowerCase().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("email_invalid");
    }
    const token = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
    const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    const inv = await db.invitation.create({
      data: {
        email,
        firmId: sess.user.firmId,
        role: "FIRM_ADMIN",
        token,
        expiresAt,
        createdById: sess.user.id,
      },
    });

    await recordActivity({
      kind: "user.invite",
      summary: `Invitó a ${email} como FIRM_ADMIN`,
      firmId: sess.user.firmId,
      actor: sess,
      metadata: { invitation_id: inv.id, email },
    });

    const base = await detectBaseUrl();
    const inviteUrl = `${base}/invite/${token}`;
    revalidatePath("/firm/users");
    redirect(`/firm/users?inviteUrl=${encodeURIComponent(inviteUrl)}`);
  }

  async function revokeInviteAction(formData: FormData) {
    "use server";
    const sess = await requireFirmAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("id_required");
    // Solo revocar invites de SU firma — defensa en profundidad.
    const inv = await db.invitation.findUnique({ where: { id } });
    if (!inv || inv.firmId !== sess.user.firmId) {
      throw new Error("forbidden");
    }
    await db.invitation.delete({ where: { id } });
    await recordActivity({
      kind: "user.invite_revoked",
      summary: `Revocó invitación a ${inv.email}`,
      firmId: sess.user.firmId,
      actor: sess,
      metadata: { email: inv.email },
    });
    revalidatePath("/firm/users");
  }

  return (
    <main className="container-page min-h-screen py-8 sm:py-12 space-y-8">
      <AutoRefresh intervalMs={10_000} />

      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="eyebrow-chip">firm admin · {firm.name}</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            Usuarios
          </h1>
          <p className="text-sm text-muted-foreground">
            Invita a otros socios o administrativos. Pueden gestionar PCs y
            ver actividad igual que tú.
          </p>
        </div>
        <Link
          href="/firm"
          className="text-sm underline text-muted-foreground"
        >
          ← Volver a {firm.name}
        </Link>
      </header>

      {sp.inviteUrl && (
        <Card className="card-paper border-0 shadow-none p-0 border-l-4 border-l-green-500">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="font-display text-xl">
              Invitación creada
            </CardTitle>
            <CardDescription>
              Copia este enlace y pásalo al destinatario por tu canal habitual
              (Slack, WhatsApp, email). Caduca en 7 días.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="card-quiet p-3 font-mono text-xs break-all bg-paper-2/50">
              {sp.inviteUrl}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Cuando el destinatario abra el enlace verá los datos de la
              invitación y podrá aceptarla.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">Invitar nuevo</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form
            action={createInviteAction}
            className="flex flex-col sm:flex-row gap-2 sm:items-end"
          >
            <div className="space-y-1 flex-1 max-w-md">
              <label htmlFor="email" className="eyebrow text-[10px] block">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="socio@empresa.com"
                className="card-quiet w-full px-3 h-10 text-sm bg-transparent border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button
              type="submit"
              className="h-10 px-4"
              style={{
                backgroundColor: "var(--brand)",
                color: "var(--brand-foreground)",
              }}
            >
              Generar invitación
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">
            Usuarios actuales ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-4 pb-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="eyebrow text-[10px]">Email</TableHead>
                  <TableHead className="eyebrow text-[10px]">Rol</TableHead>
                  <TableHead className="eyebrow text-[10px]">Alta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className="hover:bg-paper-2/60">
                    <TableCell className="font-medium">
                      {u.email}
                      {u.id === session.user.id && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (tú)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{u.role}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.createdAt.toLocaleDateString("es-ES")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card className="card-paper border-0 shadow-none p-0">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="font-display text-xl">
              Invitaciones recientes
            </CardTitle>
            <CardDescription>
              Pendientes y usadas en los últimos meses.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-4 pb-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="eyebrow text-[10px]">Email</TableHead>
                    <TableHead className="eyebrow text-[10px]">Estado</TableHead>
                    <TableHead className="eyebrow text-[10px]">Caduca</TableHead>
                    <TableHead className="eyebrow text-[10px]">Link</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv) => {
                    const used = inv.usedAt != null;
                    const expired = !used && inv.expiresAt < new Date();
                    const status = used ? "aceptada" : expired ? "caducada" : "pendiente";
                    const variant: "default" | "secondary" | "destructive" =
                      used ? "secondary" : expired ? "destructive" : "default";
                    const url = `${baseUrl}/invite/${inv.token}`;
                    return (
                      <TableRow key={inv.id} className="hover:bg-paper-2/60">
                        <TableCell className="font-medium">{inv.email}</TableCell>
                        <TableCell>
                          <Badge variant={variant}>{status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {inv.expiresAt.toLocaleDateString("es-ES")}
                        </TableCell>
                        <TableCell>
                          {!used && !expired ? (
                            <code className="text-xs font-mono">
                              .../invite/{inv.token.slice(0, 8)}…
                            </code>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {!used && !expired && (
                            <form action={revokeInviteAction}>
                              <input type="hidden" name="id" value={inv.id} />
                              <button
                                type="submit"
                                className="text-xs underline text-muted-foreground hover:text-destructive"
                              >
                                revocar
                              </button>
                            </form>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
