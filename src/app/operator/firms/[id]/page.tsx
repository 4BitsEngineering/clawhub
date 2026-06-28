import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { generatePairingCode } from "@/lib/tokens";
import { requireOperator } from "@/lib/session";
import { recordActivity } from "@/lib/activity";
import { AutoRefresh } from "@/components/auto-refresh";
import { OperatorShell } from "@/components/operator-shell";
import { FirmSubnav } from "@/components/firm-subnav";
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

export default async function OperatorFirmDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireOperator();
  const { id } = await params;

  const firm = await db.firm.findUnique({
    where: { id },
    include: {
      instances: { orderBy: { createdAt: "desc" } },
      users: { orderBy: { createdAt: "asc" } },
      pairingTokens: {
        where: { usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!firm) notFound();

  async function generatePairingTokenAction() {
    "use server";
    await requireOperator(); // server action ≠ render: reautenticar aquí
    await db.pairingToken.create({
      data: {
        firmId: id,
        code: generatePairingCode(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    revalidatePath(`/operator/firms/${id}`);
  }

  async function addFirmAdminAction(formData: FormData) {
    "use server";
    await requireOperator(); // server action ≠ render: reautenticar aquí
    const email = ((formData.get("email") as string) ?? "").trim().toLowerCase();
    const name = ((formData.get("name") as string) ?? "").trim() || null;

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;

    await db.user.upsert({
      where: { email },
      update: { role: "FIRM_ADMIN", firmId: id, name },
      create: { email, name, role: "FIRM_ADMIN", firmId: id },
    });

    revalidatePath(`/operator/firms/${id}`);
  }

  // Kill-switch por instancia: por defecto las instancias funcionan; solo se
  // bloquean con esta orden explícita. Pone/limpia disabledAt → el heartbeat
  // responde instance_status y el bridge del cliente bloquea/desbloquea.
  async function setInstanceDisabledAction(formData: FormData) {
    "use server";
    // Las server actions son endpoints POST independientes: NO heredan el
    // requireOperator() del render. Reautenticamos aquí (redirige si no es
    // OPERATOR) y validamos que la instancia pertenece a ESTA firma (evita IDOR
    // por instanceId arbitrario).
    await requireOperator();
    const instanceId = ((formData.get("instanceId") as string) ?? "").trim();
    if (!instanceId) return;
    const inst = await db.instance.findUnique({
      where: { id: instanceId },
      select: { firmId: true },
    });
    if (!inst || inst.firmId !== id) return;
    const disable = formData.get("disable") === "1";
    await db.instance.update({
      where: { id: instanceId },
      data: disable
        ? { disabledAt: new Date(), disabledReason: "Desactivada por el proveedor" }
        : { disabledAt: null, disabledReason: null },
    });
    revalidatePath(`/operator/firms/${id}`);
  }

  // Kill-switch POR FIRMA (impago/baja). Distinto del kill por instancia:
  // suspende la firma ENTERA → el heartbeat cascadea instance_status:"disabled"
  // a TODAS sus instancias y el bridge corta el acceso (403). Replica la lógica
  // de POST /api/operator/firms/[id]/{suspend,resume} para tener botón en la UI
  // (antes solo era accionable por curl → kill-switch inusable en la práctica).
  async function setFirmSuspendedAction(formData: FormData) {
    "use server";
    const session = await requireOperator(); // server action: reautenticar
    const suspend = formData.get("suspend") === "1";
    const target = await db.firm.findUnique({ where: { id }, select: { name: true } });
    if (!target) return;
    await db.firm.update({
      where: { id },
      data: suspend
        ? { status: "suspended", suspendedAt: new Date(), suspendedReason: "manual" }
        : { status: "active", suspendedAt: null, suspendedReason: null },
    });
    await recordActivity({
      kind: suspend ? "firm.suspended" : "firm.resumed",
      summary: `${suspend ? "Suspendió" : "Reactivó"} la firma ${target.name}${suspend ? " (manual)" : ""}`,
      firmId: id,
      actor: session,
      metadata: suspend ? { reason: "manual" } : {},
    });
    revalidatePath(`/operator/firms/${id}`);
  }

  const firmSuspended = firm.status !== "active";

  const onlineCount = firm.instances.filter(
    (i) =>
      i.lastHeartbeatAt &&
      Date.now() - i.lastHeartbeatAt.getTime() < 3 * 60 * 1000,
  ).length;

  return (
    <OperatorShell email={session.user.email} flush>
      <AutoRefresh intervalMs={10_000} />

      <FirmSubnav firmId={firm.id} firmName={firm.name} />

      <div className="container-page py-8 space-y-8">
        {/* Kill-switch POR FIRMA (impago/baja): suspende la firma entera → el
            heartbeat cascadea instance_status:"disabled" a sus instancias y el
            bridge corta el acceso (403). Reactivar lo revierte. */}
        <div className="flex items-center justify-end gap-2 flex-wrap">
          {firmSuspended && (
            <Badge variant="destructive" className="text-sm">
              suspendida
            </Badge>
          )}
          <form action={setFirmSuspendedAction}>
            <input type="hidden" name="suspend" value={firmSuspended ? "0" : "1"} />
            <Button
              type="submit"
              variant={firmSuspended ? "outline" : "destructive"}
              size="sm"
            >
              {firmSuspended ? "Reactivar firma" : "Suspender firma"}
            </Button>
          </form>
        </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Seats</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium tabular-nums">
              {firm.instances.length} / {firm.seatsPurchased}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Online</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium tabular-nums">
              {onlineCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Admins</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium tabular-nums">
              {firm.users.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pairings activos</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium tabular-nums">
              {firm.pairingTokens.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Instancias</CardTitle>
            <CardDescription>
              Equipos de la firma con OpenClaw Copilot instalado.
            </CardDescription>
          </div>
          <form action={generatePairingTokenAction}>
            <Button type="submit">+ Generar pairing code</Button>
          </form>
        </CardHeader>
        <CardContent>
          {firm.pairingTokens.length > 0 && (
            <div className="mb-4 p-3 rounded-md border bg-muted/30 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Códigos vigentes (pásalos al trabajador):
              </p>
              <div className="flex flex-wrap gap-2">
                {firm.pairingTokens.map((t) => {
                  const minsLeft = Math.max(
                    0,
                    Math.round((t.expiresAt.getTime() - Date.now()) / 60000),
                  );
                  return (
                    <div
                      key={t.id}
                      className="px-3 py-1.5 rounded bg-background border font-mono text-sm"
                    >
                      <span className="font-medium">{t.code}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({minsLeft} min)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {firm.instances.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin instancias todavía. Genera un pairing code arriba y pásaselo
              al trabajador para que su clawgents-desktop se conecte.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trabajador</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Versión</TableHead>
                  <TableHead>OS</TableHead>
                  <TableHead>Último heartbeat</TableHead>
                  <TableHead>Acceso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {firm.instances.map((i) => {
                  const isOnline =
                    i.lastHeartbeatAt &&
                    Date.now() - i.lastHeartbeatAt.getTime() < 3 * 60 * 1000;
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/firm/instances/${i.id}`}
                          className="hover:underline"
                        >
                          {i.workerLabel}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isOnline ? "default" : "secondary"}>
                          {isOnline ? "online" : "offline"}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {i.version}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {i.os ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {i.lastHeartbeatAt
                          ? i.lastHeartbeatAt.toLocaleString("es-ES")
                          : "nunca"}
                      </TableCell>
                      <TableCell>
                        <form action={setInstanceDisabledAction}>
                          <input type="hidden" name="instanceId" value={i.id} />
                          <input
                            type="hidden"
                            name="disable"
                            value={i.disabledAt ? "0" : "1"}
                          />
                          <div className="flex items-center gap-2">
                            {i.disabledAt && (
                              <Badge variant="destructive">bloqueada</Badge>
                            )}
                            <Button type="submit" variant="outline" size="sm">
                              {i.disabledAt ? "Reactivar" : "Bloquear acceso"}
                            </Button>
                          </div>
                        </form>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Firm admins</CardTitle>
          <CardDescription>
            Usuarios con permiso de admin de esta firma. Pueden entrar en
            /firm cuando reactivemos el login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            action={addFirmAdminAction}
            className="flex flex-col sm:flex-row gap-3 sm:items-end"
          >
            <div className="space-y-2 flex-1">
              <Label htmlFor="admin-email" className="text-xs">Email</Label>
              <Input
                id="admin-email"
                name="email"
                type="email"
                required
                placeholder="admin@firma.com"
              />
            </div>
            <div className="space-y-2 flex-1">
              <Label htmlFor="admin-name" className="text-xs">Nombre (opcional)</Label>
              <Input
                id="admin-name"
                name="name"
                maxLength={120}
                placeholder="Nombre del admin"
              />
            </div>
            <Button type="submit">+ Añadir admin</Button>
          </form>

          {firm.users.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin admins todavía. Añade uno arriba.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Creado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {firm.users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{u.role}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.createdAt.toLocaleDateString("es-ES")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>
    </OperatorShell>
  );
}
