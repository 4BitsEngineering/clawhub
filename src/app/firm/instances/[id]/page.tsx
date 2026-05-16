import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AutoRefresh } from "@/components/auto-refresh";
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

function formatUptime(s: number | null | undefined): string {
  if (s == null) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function formatTokens(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "k";
  return (n / 1_000_000).toFixed(2) + "M";
}

export default async function InstanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const instance = await db.instance.findUnique({
    where: { id },
    include: {
      firm: true,
      heartbeats: {
        orderBy: { receivedAt: "desc" },
        take: 50,
      },
    },
  });

  if (!instance) notFound();

  const isOnline =
    instance.lastHeartbeatAt &&
    Date.now() - instance.lastHeartbeatAt.getTime() < 3 * 60 * 1000;

  const lastBeat = instance.heartbeats[0] ?? null;
  const totalBeats = await db.heartbeat.count({
    where: { instanceId: instance.id },
  });

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto space-y-6">
      <AutoRefresh intervalMs={5_000} />

      <div className="text-sm">
        <Link
          href="/firm"
          className="text-muted-foreground hover:text-foreground"
        >
          ← {instance.firm.name}
        </Link>
      </div>

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {instance.workerLabel}
          </h1>
          <p className="text-sm text-muted-foreground">
            instance_id <code className="text-xs">{instance.id}</code>
          </p>
        </div>
        <Badge variant={isOnline ? "default" : "secondary"} className="text-base px-3 py-1">
          {isOnline ? "online" : "offline"}
        </Badge>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Versión</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium tabular-nums">
              {instance.version}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>OS</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">{instance.os ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Heartbeats totales</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium tabular-nums">{totalBeats}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Uptime actual</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium tabular-nums">
              {formatUptime(lastBeat?.uptimeS)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Heartbeats recientes</CardTitle>
          <CardDescription>
            Últimos {instance.heartbeats.length} pings recibidos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {instance.heartbeats.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay heartbeats. ¿La instancia ha enviado alguno?
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recibido</TableHead>
                  <TableHead className="text-right">CPU %</TableHead>
                  <TableHead className="text-right">RAM MB</TableHead>
                  <TableHead className="text-right">Tokens 24h</TableHead>
                  <TableHead className="text-right">Uptime</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instance.heartbeats.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-muted-foreground">
                      {h.receivedAt.toLocaleString("es-ES")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {h.cpuPct?.toFixed(1) ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {h.ramMb ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTokens(h.tokensConsumed24h)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUptime(h.uptimeS)}
                    </TableCell>
                    <TableCell className="text-destructive text-xs">
                      {h.lastError ?? ""}
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
