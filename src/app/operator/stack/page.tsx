import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";
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

export default async function OperatorStackPage() {
  await requireOperator();

  const [bundles, firms] = await Promise.all([
    db.stackBundle.findMany({
      where: { deprecatedAt: null },
      orderBy: [{ kind: "asc" }, { overlayId: "asc" }, { releasedAt: "desc" }],
      take: 200,
    }),
    db.firm.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        plan: true,
        stackChannel: true,
        stackAutoUpdate: true,
        openclawVersion: true,
        bridgeVersion: true,
        overlayId: true,
        overlayVersion: true,
        _count: { select: { instances: true } },
      },
    }),
  ]);

  // Group bundles by (kind, overlayId)
  type BundleGroup = { kind: string; overlayId: string | null; rows: typeof bundles };
  const groups: BundleGroup[] = [];
  for (const b of bundles) {
    const last = groups[groups.length - 1];
    if (last && last.kind === b.kind && last.overlayId === b.overlayId) {
      last.rows.push(b);
    } else {
      groups.push({ kind: b.kind, overlayId: b.overlayId, rows: [b] });
    }
  }

  async function updateFirmStackAction(formData: FormData) {
    "use server";
    const sess = await requireOperator();
    const firmId = String(formData.get("firmId") ?? "");
    if (!firmId) throw new Error("firmId_required");
    const data: Record<string, unknown> = {};
    const fields = [
      "openclawVersion",
      "bridgeVersion",
      "overlayId",
      "overlayVersion",
      "stackChannel",
    ];
    for (const f of fields) {
      const raw = formData.get(f);
      if (raw == null) continue;
      const v = String(raw).trim();
      data[f] = v === "" ? null : v;
    }
    if (formData.has("stackAutoUpdate")) {
      data.stackAutoUpdate = formData.get("stackAutoUpdate") === "on";
    } else {
      data.stackAutoUpdate = false;
    }
    const updated = await db.firm.update({
      where: { id: firmId },
      data,
      select: { name: true },
    });
    await recordActivity({
      kind: "stack.pin",
      summary: `Pineó manifest de "${updated.name}"`,
      firmId,
      actor: sess,
      metadata: data as Record<string, unknown>,
    });
    revalidatePath("/operator/stack");
  }

  return (
    <main className="container-page min-h-screen py-8 sm:py-12 space-y-8">
      <AutoRefresh intervalMs={10_000} />

      <header className="space-y-2">
        <div className="text-sm">
          <Link href="/operator" className="text-muted-foreground hover:text-foreground">
            ← clawhub
          </Link>
        </div>
        <div className="eyebrow-chip">stack management</div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
          Versiones del stack
        </h1>
        <p className="text-sm text-muted-foreground">
          Bundles disponibles + versiones canónicas pineadas por firma. Los
          clientes desktop comparan su stack local con este manifest en cada
          heartbeat y aplican updates según política (auto/manual).
        </p>
      </header>

      {/* Bundles disponibles */}
      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">Bundles publicados</CardTitle>
          <CardDescription>
            Cada release de openclaw / bridge / overlay registrado en clawhub.
            Sube nuevos con <code>scripts/release-bundle.ts</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-4 pb-4 space-y-6">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-8 text-center">
              No hay bundles publicados todavía. Empieza con uno de openclaw o
              de un overlay desde la CLI.
            </p>
          ) : (
            groups.map((g) => (
              <div key={`${g.kind}-${g.overlayId ?? ""}`} className="space-y-2">
                <div className="px-4 flex items-center gap-2">
                  <Badge>{g.kind}</Badge>
                  {g.overlayId && (
                    <span className="text-sm text-muted-foreground">
                      overlay: <code>{g.overlayId}</code>
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {g.rows.length} releases
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="eyebrow text-[10px]">Versión</TableHead>
                        <TableHead className="eyebrow text-[10px]">Canal</TableHead>
                        <TableHead className="eyebrow text-[10px] text-right">Tamaño</TableHead>
                        <TableHead className="eyebrow text-[10px]">SHA256</TableHead>
                        <TableHead className="eyebrow text-[10px]">Publicado</TableHead>
                        <TableHead className="eyebrow text-[10px]">Notas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.rows.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium tabular-nums text-sm">
                            {b.version}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              {b.channel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {(b.sizeBytes / 1024 / 1024).toFixed(2)} MB
                          </TableCell>
                          <TableCell>
                            <code className="text-[10px]">{b.sha256.slice(0, 12)}…</code>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {b.releasedAt.toLocaleString("es-ES")}
                          </TableCell>
                          <TableCell className="text-xs max-w-[24rem] truncate">
                            {b.releaseNotes ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Manifest por firma */}
      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">Manifest por firma</CardTitle>
          <CardDescription>
            Versiones canónicas pinneadas. Vacío = "última stable del canal".
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 space-y-6">
          {firms.map((f) => (
            <form
              key={f.id}
              action={updateFirmStackAction}
              className="card-quiet p-4 space-y-3"
            >
              <input type="hidden" name="firmId" value={f.id} />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="space-y-0.5">
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {f._count.instances} instancias · plan {f.plan}
                  </div>
                </div>
                <Badge variant="secondary">{f.stackChannel}</Badge>
              </div>

              <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    OpenClaw version
                  </label>
                  <input
                    name="openclawVersion"
                    type="text"
                    defaultValue={f.openclawVersion ?? ""}
                    placeholder="latest"
                    className="card-paper w-full px-2 py-1.5 text-sm bg-transparent border rounded-md font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Bridge version
                  </label>
                  <input
                    name="bridgeVersion"
                    type="text"
                    defaultValue={f.bridgeVersion ?? ""}
                    placeholder="latest"
                    className="card-paper w-full px-2 py-1.5 text-sm bg-transparent border rounded-md font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Overlay id
                  </label>
                  <input
                    name="overlayId"
                    type="text"
                    defaultValue={f.overlayId ?? ""}
                    placeholder="asesoria"
                    className="card-paper w-full px-2 py-1.5 text-sm bg-transparent border rounded-md font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Overlay version
                  </label>
                  <input
                    name="overlayVersion"
                    type="text"
                    defaultValue={f.overlayVersion ?? ""}
                    placeholder="latest"
                    className="card-paper w-full px-2 py-1.5 text-sm bg-transparent border rounded-md font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Canal</label>
                  <select
                    name="stackChannel"
                    defaultValue={f.stackChannel}
                    className="card-paper w-full px-2 py-1.5 text-sm bg-transparent border rounded-md"
                  >
                    <option value="stable">stable</option>
                    <option value="beta">beta</option>
                    <option value="dev">dev</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 justify-between flex-wrap">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    name="stackAutoUpdate"
                    defaultChecked={f.stackAutoUpdate}
                  />
                  Auto-actualizar al detectar diff
                </label>
                <Button type="submit" size="sm">
                  Guardar
                </Button>
              </div>
            </form>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
