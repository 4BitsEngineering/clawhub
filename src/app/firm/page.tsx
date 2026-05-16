import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SignOutButton } from "@/components/sign-out-button";
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

export default async function FirmPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "FIRM_ADMIN") redirect("/operator");
  if (!session.user.firmId) {
    return (
      <main className="min-h-screen p-8 max-w-3xl mx-auto">
        <p>Tu usuario no está asociado a ninguna firma. Contacta con soporte.</p>
      </main>
    );
  }

  const firm = await db.firm.findUnique({
    where: { id: session.user.firmId },
    include: {
      instances: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!firm) redirect("/login");

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {firm.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Plan {firm.plan} · {firm.instances.length}/{firm.seatsPurchased}{" "}
            instancias
          </p>
        </div>
        <SignOutButton />
      </header>

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
                        {i.workerLabel}
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
