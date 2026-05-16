import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
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
  const session = await getSession();
  if (!session) redirect("/login");
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

  // firm_admin solo puede ver instancias de su firma; operator ve cualquiera.
  if (
    session.user.role === "FIRM_ADMIN" &&
    instance.firmId !== session.user.firmId
  ) {
    notFound();
  }

  async function unpairInstanceAction() {
    "use server";
    await db.instance.delete({ where: { id } });
    revalidatePath("/firm");
    revalidatePath(`/operator/firms/${instance!.firmId}`);
    redirect("/firm");
  }

  const isOnline =
    instance.lastHeartbeatAt &&
    Date.now() - instance.lastHeartbeatAt.getTime() < 3 * 60 * 1000;

  const lastBeat = instance.heartbeats[0] ?? null;
  const totalBeats = await db.heartbeat.count({
    where: { instanceId: instance.id },
  });

  return (
    <main className="container-page min-h-screen py-8 sm:py-12 space-y-8">
      <AutoRefresh intervalMs={5_000} />

      <div className="text-sm">
        <Link
          href="/firm"
          className="text-muted-foreground hover:text-foreground"
        >
          ← {instance.firm.name}
        </Link>
      </div>

      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="eyebrow-chip flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: isOnline ? "var(--brand)" : "#bbb" }}
            />
            instancia
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            {instance.workerLabel}
          </h1>
          <p className="text-xs text-muted-foreground">
            <code>{instance.id}</code>
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge
            variant={isOnline ? "default" : "secondary"}
            className="text-sm px-3 py-1"
          >
            {isOnline ? "online" : "offline"}
          </Badge>
          <form action={unpairInstanceAction}>
            <Button type="submit" variant="destructive" size="sm">
              Despareja
            </Button>
          </form>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card-paper p-4 space-y-1">
          <div className="eyebrow text-[10px]">Versión</div>
          <div className="text-lg font-medium tabular-nums">
            {instance.version}
          </div>
        </div>
        <div className="card-paper p-4 space-y-1">
          <div className="eyebrow text-[10px]">OS</div>
          <div className="text-lg font-medium">{instance.os ?? "—"}</div>
        </div>
        <div className="card-paper p-4 space-y-1">
          <div className="eyebrow text-[10px]">Heartbeats totales</div>
          <div className="text-lg font-medium tabular-nums">{totalBeats}</div>
        </div>
        <div className="card-paper p-4 space-y-1">
          <div className="eyebrow text-[10px]">Uptime actual</div>
          <div className="text-lg font-medium tabular-nums">
            {formatUptime(lastBeat?.uptimeS)}
          </div>
        </div>
      </div>

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">
            Heartbeats recientes
          </CardTitle>
          <CardDescription>
            Últimos {instance.heartbeats.length} pings recibidos.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-4 pb-4">
          {instance.heartbeats.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-8 text-center">
              No hay heartbeats. ¿La instancia ha enviado alguno?
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="eyebrow text-[10px]">
                      Recibido
                    </TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      CPU %
                    </TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      RAM MB
                    </TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      Tokens 24h
                    </TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      Uptime
                    </TableHead>
                    <TableHead className="eyebrow text-[10px]">Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instance.heartbeats.map((h) => (
                    <TableRow key={h.id} className="hover:bg-paper-2/60">
                      <TableCell className="text-muted-foreground text-sm">
                        {h.receivedAt.toLocaleString("es-ES")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {h.cpuPct?.toFixed(1) ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {h.ramMb ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatTokens(h.tokensConsumed24h)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatUptime(h.uptimeS)}
                      </TableCell>
                      <TableCell className="text-destructive text-xs">
                        {h.lastError ?? ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
