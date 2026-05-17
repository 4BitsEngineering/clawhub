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
import { ThemeToggle } from "@/components/theme-toggle";
import { ActivityTimeline } from "@/components/activity-timeline";
import { recordActivity } from "@/lib/activity";

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
    // Validar quota antes de generar pairing — evita repartir códigos que el
    // /api/v0/pair va a rechazar con 403. La validación final sigue estando
    // en pair/route.ts (defensa en profundidad).
    const [seatsUsed, fresh] = await Promise.all([
      db.instance.count({ where: { firmId } }),
      db.firm.findUnique({ where: { id: firmId }, select: { seatsPurchased: true } }),
    ]);
    if (!fresh) throw new Error("firm_not_found");
    if (seatsUsed >= fresh.seatsPurchased) {
      throw new Error(
        `quota_full: ${seatsUsed}/${fresh.seatsPurchased} PCs. Contacta con soporte para ampliar tu plan.`,
      );
    }
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

  // Acceso rápido al re-pair desde la tabla de instancias. Antes solo estaba
  // en /firm/instances/[id] (card "Re-emparejar este PC"), pero cuando un PC
  // está offline y hay que pasar el código por teléfono, entrar al detalle
  // es un click extra que sobra. Misma lógica que el action del detail:
  // cancela tokens vivos para esa instancia y genera uno nuevo de 10 min.
  async function quickRepairTokenAction(formData: FormData) {
    "use server";
    const sess = await requireFirmAdmin();
    const instanceId = String(formData.get("instance_id") ?? "");
    if (!instanceId) throw new Error("instance_id_required");
    const inst = await db.instance.findUnique({
      where: { id: instanceId },
      select: { id: true, firmId: true, workerLabel: true },
    });
    if (!inst || inst.firmId !== sess.user.firmId) {
      throw new Error("forbidden");
    }
    await db.pairingToken.deleteMany({
      where: {
        firmId: inst.firmId,
        existingInstanceId: inst.id,
        usedAt: null,
      },
    });
    const code = generatePairingCode();
    await db.pairingToken.create({
      data: {
        firmId: inst.firmId,
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        existingInstanceId: inst.id,
      },
    });
    await recordActivity({
      kind: "instance.re_pair_initiated",
      summary: `Generó código re-pair para "${inst.workerLabel}" (acceso rápido)`,
      firmId: inst.firmId,
      instanceId: inst.id,
      actor: sess,
      metadata: { code, source: "firm_dashboard" },
    });
    revalidatePath("/firm");
  }

  const [firm, latestInstaller, recentActivity] = await Promise.all([
    db.firm.findUnique({
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
    }),
    db.stackBundle.findFirst({
      where: {
        kind: "INSTALLER",
        channel: "stable",
        deprecatedAt: null,
      },
      orderBy: { releasedAt: "desc" },
      select: { version: true, sizeBytes: true },
    }),
    db.activity.findMany({
      where: { firmId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  if (!firm) {
    return (
      <main className="min-h-screen p-8 max-w-3xl mx-auto">
        <p>Firma demo no encontrada. ¿Has corrido el seed?</p>
      </main>
    );
  }

  // Single snapshot of "now" for the render. Server Components run once per
  // request so the impurity is deterministic for this render. The
  // react-hooks/purity rule flags any Date.now() — disabling here once
  // is cleaner than peppering disables next to every relative-time math.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  const onlineCount = firm.instances.filter(
    (i) =>
      i.lastHeartbeatAt &&
      nowMs - i.lastHeartbeatAt.getTime() < 3 * 60 * 1000,
  ).length;

  const quotaFull = firm.instances.length >= firm.seatsPurchased;

  return (
    <main className="container-page min-h-screen py-8 sm:py-12 space-y-8">
      <AutoRefresh intervalMs={5_000} />

      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="eyebrow-chip">firm admin</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            {firm.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {session.user.email} · Plan {firm.plan} ·{" "}
            <span
              className={
                quotaFull ? "tabular-nums text-red-600 font-semibold" : "tabular-nums"
              }
            >
              {firm.instances.length}
            </span>
            /<span className="tabular-nums">{firm.seatsPurchased}</span>{" "}
            instancias{quotaFull ? " (cupo lleno)" : ""} ·{" "}
            <span className="tabular-nums">{onlineCount}</span> online
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/firm/usage"
            className="h-10 px-3 inline-flex items-center text-sm rounded border bg-background hover:bg-paper-2"
          >
            Consumo
          </Link>
          <Link
            href="/firm/users"
            className="h-10 px-3 inline-flex items-center text-sm rounded border bg-background hover:bg-paper-2"
          >
            Usuarios
          </Link>
          <Link
            href="/firm/mcp"
            className="h-10 px-3 inline-flex items-center text-sm rounded border bg-background hover:bg-paper-2"
          >
            MCP
          </Link>
          <Link
            href="/firm/baselines"
            className="h-10 px-3 inline-flex items-center text-sm rounded border bg-background hover:bg-paper-2"
          >
            Baselines
          </Link>
          <Link
            href="/firm/settings"
            className="h-10 px-3 inline-flex items-center text-sm rounded border bg-background hover:bg-paper-2"
          >
            Ajustes
          </Link>
          <form action={generatePairingTokenAction}>
            <Button
              type="submit"
              className="h-10 px-4"
              disabled={quotaFull}
              title={
                quotaFull
                  ? "Cupo lleno: amplía el plan o desempareja un PC en desuso primero"
                  : undefined
              }
              style={
                quotaFull
                  ? undefined
                  : {
                      backgroundColor: "var(--brand)",
                      color: "var(--brand-foreground)",
                    }
              }
            >
              + Añadir trabajador
            </Button>
          </form>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      {firm.pairingTokens.length > 0 && (
        <Card className="card-paper border-0 shadow-none p-0">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="font-display text-xl">
              Alta de trabajador
            </CardTitle>
            <CardDescription>
              Pasa al trabajador el enlace de descarga + su código. El
              installer le pide el código en el wizard.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6 space-y-4">
            {latestInstaller ? (
              <div className="card-quiet p-4 space-y-2">
                <div className="eyebrow text-[10px]">1. Descarga el installer</div>
                <div className="text-sm">
                  <a
                    href="/api/v0/installer?channel=stable"
                    className="font-mono text-sm underline"
                  >
                    /api/v0/installer?channel=stable
                  </a>
                </div>
                <p className="text-xs text-muted-foreground">
                  v{latestInstaller.version} ·{" "}
                  {(latestInstaller.sizeBytes / 1024 / 1024).toFixed(1)} MB ·
                  Windows · sin firma (verá un aviso de SmartScreen la primera
                  vez)
                </p>
              </div>
            ) : (
              <div className="card-quiet p-4">
                <p className="text-xs text-muted-foreground">
                  Aún no hay installer publicado. Pide al operator que suba un
                  release (ver <code>scripts/release-installer.ts</code>).
                </p>
              </div>
            )}
            <div className="space-y-2">
              <div className="eyebrow text-[10px]">2. Códigos activos</div>
              <div className="flex flex-wrap gap-2">
                {firm.pairingTokens.map((t) => {
                  const minsLeft = Math.max(
                    0,
                    Math.round((t.expiresAt.getTime() - nowMs) / 60000),
                  );
                  return (
                    <div
                      key={t.id}
                      className="card-quiet px-4 py-3 flex items-center gap-3"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--brand-soft) 0%, transparent 100%)",
                      }}
                    >
                      <span className="font-mono text-lg font-semibold tracking-[0.15em]">
                        {t.code}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        caduca en {minsLeft} min
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">Trabajadores</CardTitle>
          <CardDescription>
            Instancias de OpenClaw Copilot registradas para tu equipo.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-4 pb-4">
          {firm.instances.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-8 text-center">
              Aún no hay instancias. Pulsa{" "}
              <strong>"+ Añadir trabajador"</strong> arriba para generar un
              pairing code y registrar el primer PC.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="eyebrow text-[10px]">
                      Trabajador
                    </TableHead>
                    <TableHead className="eyebrow text-[10px]">
                      Estado
                    </TableHead>
                    <TableHead className="eyebrow text-[10px]">
                      Versión
                    </TableHead>
                    <TableHead className="eyebrow text-[10px]">OS</TableHead>
                    <TableHead className="eyebrow text-[10px]">
                      Último heartbeat
                    </TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {firm.instances.map((i) => {
                    const isOnline =
                      i.lastHeartbeatAt &&
                      nowMs - i.lastHeartbeatAt.getTime() < 3 * 60 * 1000;
                    // Re-pair token activo (no usado, no caducado) para esta
                    // instancia. La query de arriba ya trae todos los tokens
                    // vivos de la firma; aquí filtramos por existingInstanceId.
                    const activeRepair = firm.pairingTokens.find(
                      (t) => t.existingInstanceId === i.id,
                    );
                    const repairMinsLeft = activeRepair
                      ? Math.max(
                          0,
                          Math.round(
                            (activeRepair.expiresAt.getTime() - nowMs) /
                              60000,
                          ),
                        )
                      : null;
                    return (
                      <TableRow key={i.id} className="hover:bg-paper-2/60">
                        <TableCell className="font-medium">
                          <Link
                            href={`/firm/instances/${i.id}`}
                            className="hover:text-brand transition-colors flex items-center gap-2"
                          >
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{
                                backgroundColor: isOnline
                                  ? "var(--brand)"
                                  : "#bbb",
                              }}
                            />
                            {i.workerLabel}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isOnline ? "default" : "secondary"}>
                            {isOnline ? "online" : "offline"}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {i.version}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {i.os ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {i.lastHeartbeatAt
                            ? i.lastHeartbeatAt.toLocaleString("es-ES")
                            : "nunca"}
                        </TableCell>
                        <TableCell className="text-right">
                          {activeRepair ? (
                            <div
                              className="inline-flex items-center gap-2 px-2 py-0.5 rounded text-xs"
                              style={{
                                background:
                                  "linear-gradient(135deg, var(--brand-soft) 0%, transparent 100%)",
                              }}
                              title={`Pásale este código al trabajador. Caduca en ${repairMinsLeft} min.`}
                            >
                              <span className="font-mono font-semibold tracking-[0.1em]">
                                {activeRepair.code}
                              </span>
                              <span className="text-muted-foreground">
                                {repairMinsLeft}m
                              </span>
                            </div>
                          ) : (
                            <form action={quickRepairTokenAction}>
                              <input
                                type="hidden"
                                name="instance_id"
                                value={i.id}
                              />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                title="Generar código re-pair (si el trabajador reinstaló el PC)"
                              >
                                re-pair
                              </Button>
                            </form>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">Actividad reciente</CardTitle>
          <CardDescription>
            Últimos eventos en tu equipo: altas, comandos remotos, baselines,
            cambios de configuración.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <ActivityTimeline
            activities={recentActivity}
            emptyMessage="Aún no hay actividad registrada en tu firma."
          />
        </CardContent>
      </Card>
    </main>
  );
}
