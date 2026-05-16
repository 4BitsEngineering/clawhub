import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireFirmAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

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
import { Button } from "@/components/ui/button";
import { AutoRefresh } from "@/components/auto-refresh";
import { SignOutButton } from "@/components/sign-out-button";

// Genera un pairing code humano-friendly (8 chars, sin caracteres confusos).
function generatePairingCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I/L
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (i === 3) code += "-";
  }
  return code;
}

export default async function FirmPage() {
  const session = await requireFirmAdmin();
  const firmId = session.user.firmId;

  async function generatePairingTokenAction() {
    "use server";
    const code = generatePairingCode();
    await db.pairingToken.create({
      data: {
        firmId,
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    revalidatePath("/firm");
  }

  const firm = await db.firm.findUnique({
    where: { id: firmId },
    include: {
      instances: {
        orderBy: { createdAt: "desc" },
      },
      pairingTokens: {
        where: {
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!firm) {
    return (
      <main className="min-h-screen p-8 max-w-3xl mx-auto">
        <p>Firma demo no encontrada. ¿Has corrido el seed?</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto space-y-6">
      <AutoRefresh intervalMs={5_000} />
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {firm.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {session.user.email} · Plan {firm.plan} ·{" "}
            {firm.instances.length}/{firm.seatsPurchased} instancias
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action={generatePairingTokenAction}>
            <Button type="submit">+ Añadir trabajador</Button>
          </form>
          <SignOutButton />
        </div>
      </header>

      {firm.pairingTokens.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pairing codes activos</CardTitle>
            <CardDescription>
              Pasa el código al trabajador. Caduca 10 min después de generarse.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Caduca</TableHead>
                  <TableHead>Creado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {firm.pairingTokens.map((t) => {
                  const minsLeft = Math.max(
                    0,
                    Math.round(
                      (t.expiresAt.getTime() - Date.now()) / 60000,
                    ),
                  );
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-base font-medium tracking-wider">
                        {t.code}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        en {minsLeft} min
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.createdAt.toLocaleTimeString("es-ES")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Trabajadores</CardTitle>
          <CardDescription>
            Instancias de OpenClaw Copilot registradas para tu equipo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {firm.instances.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay instancias. Pulsa{" "}
              <strong>"Añadir trabajador"</strong> (TODO) para generar un
              pairing code y registrar el primer PC.
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
    </main>
  );
}
