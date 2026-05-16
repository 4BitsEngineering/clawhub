import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { AutoRefresh } from "@/components/auto-refresh";
import { Button, buttonVariants } from "@/components/ui/button";
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

function generatePairingCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (i === 3) code += "-";
  }
  return code;
}

export default async function OperatorFirmDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const onlineCount = firm.instances.filter(
    (i) =>
      i.lastHeartbeatAt &&
      Date.now() - i.lastHeartbeatAt.getTime() < 3 * 60 * 1000,
  ).length;

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto space-y-6">
      <AutoRefresh intervalMs={10_000} />

      <div className="text-sm">
        <Link
          href="/operator"
          className="text-muted-foreground hover:text-foreground"
        >
          ← operator
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{firm.name}</h1>
          <p className="text-sm text-muted-foreground">
            Creada {firm.createdAt.toLocaleDateString("es-ES")} · firm_id{" "}
            <code className="text-xs">{firm.id}</code>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm">
            {firm.plan}
          </Badge>
          <Link
            href={`/operator/firms/${firm.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Editar
          </Link>
        </div>
      </header>

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
    </main>
  );
}
