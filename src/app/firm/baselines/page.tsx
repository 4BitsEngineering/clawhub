/**
 * /firm/baselines — listado de todos los baselines de la firma.
 *
 * Antes esto solo se podía consumir indirectamente desde:
 *   - el dropdown "Restaurar" en /firm/instances/[id]
 *   - el link directo a /firm/baselines/[id]
 *
 * Pero un firm_admin con varios baselines necesita ver el catálogo de
 * snapshots para hacer housekeeping (qué hay, qué es canónico, comparar dos
 * antes de un reset crítico, navegar al diff sin pasar por una instancia).
 *
 * Permisos: firm_admin ve solo su firma. Operator puede pasar ?firmId=<id>
 * para ver el catálogo de cualquier firma.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { recordActivity } from "@/lib/activity";
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
import { ConfirmForm } from "@/components/confirm-form";
import { OperatorShell } from "@/components/operator-shell";
import { FirmSubnav } from "@/components/firm-subnav";

export const dynamic = "force-dynamic";

export default async function FirmBaselinesPage({
  searchParams,
}: {
  searchParams: Promise<{ firmId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { firmId: queryFirmId } = await searchParams;

  // Resolver firmId efectivo: firm_admin → su firma; operator → ?firmId o nada.
  let firmId: string;
  if (session.user.role === "FIRM_ADMIN") {
    if (!session.user.firmId) notFound();
    firmId = session.user.firmId;
  } else if (queryFirmId) {
    firmId = queryFirmId;
  } else {
    // Operator sin ?firmId — sin info de qué firma listar. Redirigir al
    // dashboard de operador (donde ya hay listado de firmas).
    redirect("/operator");
  }

  const firm = await db.firm.findUnique({
    where: { id: firmId },
    select: { id: true, name: true },
  });
  if (!firm) notFound();

  const baselines = await db.firmBaseline.findMany({
    where: { firmId },
    orderBy: [{ isPromoted: "desc" }, { version: "desc" }],
    select: {
      id: true,
      version: true,
      label: true,
      description: true,
      fileCount: true,
      totalBytes: true,
      createdAt: true,
      isPromoted: true,
      sourceInstanceId: true,
    },
  });

  // Resolver workerLabel de los sourceInstance para no exhibir UUIDs sueltos.
  const instanceIds = baselines
    .map((b) => b.sourceInstanceId)
    .filter((x): x is string => !!x);
  const instances = instanceIds.length
    ? await db.instance.findMany({
        where: { id: { in: instanceIds } },
        select: { id: true, workerLabel: true },
      })
    : [];
  const instanceLabel = new Map(instances.map((i) => [i.id, i.workerLabel]));

  async function deleteBaselineAction(formData: FormData) {
    "use server";
    const sess = await getSession();
    if (!sess) redirect("/login");
    const baselineId = String(formData.get("baseline_id") ?? "");
    if (!baselineId) throw new Error("baseline_id_required");
    const b = await db.firmBaseline.findUnique({
      where: { id: baselineId },
      select: { firmId: true, version: true, label: true, isPromoted: true },
    });
    if (!b) throw new Error("not_found");
    if (sess.user.role === "FIRM_ADMIN" && b.firmId !== sess.user.firmId) {
      throw new Error("forbidden");
    }
    if (b.isPromoted) {
      throw new Error(
        "no_se_puede_borrar_canonico: quita el canónico antes (en el detalle del baseline) y reintenta",
      );
    }
    await db.firmBaseline.delete({ where: { id: baselineId } });
    await recordActivity({
      kind: "baseline.delete",
      summary: `Borró baseline v${b.version} "${b.label}"`,
      firmId: b.firmId,
      actor: sess,
      metadata: {
        baseline_id: baselineId,
        version: b.version,
        label: b.label,
      },
    });
    revalidatePath("/firm/baselines");
    revalidatePath("/firm");
  }

  const totalBytes = baselines.reduce((s, b) => s + b.totalBytes, 0);
  const promoted = baselines.find((b) => b.isPromoted);

  const isOperator = session.user.role === "OPERATOR";

  const subheader = isOperator
    ? <FirmSubnav firmId={firmId} firmName={firm.name} />
    : (
      <div className="border-b border-border bg-muted/40">
        <div className="container-page py-5 space-y-1">
          <p className="text-xs text-muted-foreground">
            <Link href="/firm" className="hover:text-foreground">
              {firm.name}
            </Link>{" "}/ Baselines
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
            Catálogo de baselines
          </h1>
        </div>
      </div>
    );

  const content = (
    <div className="container-page py-8 space-y-8">

      {baselines.length === 0 ? (
        <Card className="card-paper border-0 shadow-none p-0">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="font-display text-xl">
              Aún no hay baselines
            </CardTitle>
            <CardDescription>
              Para crear el primero, entra al detalle de una instancia y pulsa
              <strong> Crear snapshot</strong> en la card de Baselines.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card className="card-paper border-0 shadow-none p-0">
          <CardContent className="px-2 sm:px-4 pb-4 pt-2">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="eyebrow text-[10px]">v</TableHead>
                    <TableHead className="eyebrow text-[10px]">
                      Nombre
                    </TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      Archivos
                    </TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      Tamaño
                    </TableHead>
                    <TableHead className="eyebrow text-[10px]">
                      Origen
                    </TableHead>
                    <TableHead className="eyebrow text-[10px]">
                      Creado
                    </TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {baselines.map((b, idx) => {
                    const previous = baselines[idx + 1];
                    return (
                      <TableRow key={b.id} className="hover:bg-paper-2/60">
                        <TableCell className="tabular-nums text-sm">
                          v{b.version}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/firm/baselines/${b.id}`}
                                className="text-sm font-medium hover:text-brand transition-colors"
                              >
                                {b.label}
                              </Link>
                              {b.isPromoted && (
                                <Badge variant="default" className="text-[10px]">
                                  ⭐ canónico
                                </Badge>
                              )}
                            </div>
                            {b.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {b.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums text-right text-sm">
                          {b.fileCount}
                        </TableCell>
                        <TableCell className="tabular-nums text-right text-sm">
                          {(b.totalBytes / 1024).toFixed(1)} KB
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {b.sourceInstanceId
                            ? instanceLabel.get(b.sourceInstanceId) ?? (
                                <code className="text-[10px]">
                                  {b.sourceInstanceId.slice(0, 8)}
                                </code>
                              )
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {b.createdAt.toLocaleString("es-ES")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/firm/baselines/${b.id}`}
                              className="text-xs underline text-muted-foreground hover:text-foreground"
                            >
                              ver
                            </Link>
                            {previous && (
                              <Link
                                href={`/firm/baselines/${b.id}?compareTo=${previous.id}`}
                                className="text-xs underline text-muted-foreground hover:text-foreground"
                                title={`Diff vs v${previous.version}`}
                              >
                                diff
                              </Link>
                            )}
                            {!b.isPromoted && (
                              <ConfirmForm
                                action={deleteBaselineAction}
                                message={`¿Borrar baseline v${b.version} "${b.label}"?\n\nEsto no afecta a instancias en marcha — solo se quita del catálogo.`}
                              >
                                <input
                                  type="hidden"
                                  name="baseline_id"
                                  value={b.id}
                                />
                                <Button
                                  type="submit"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                >
                                  borrar
                                </Button>
                              </ConfirmForm>
                            )}
                          </div>
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

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">Cómo se usan</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Crear:</strong> entra a una instancia y pulsa{" "}
            <em>Crear snapshot</em>. Captura <code>openclaw.json</code> +
            skills + workspaces + enterprise (sin secretos).
          </p>
          <p>
            <strong>Promover canónico:</strong> en el detalle del baseline,
            botón <em>Marcar como canónico</em>. Es el default del{" "}
            <em>Reset</em> cuando alguien rompe su config.
          </p>
          <p>
            <strong>Comparar:</strong> link <em>diff</em> en la tabla muestra
            qué cambia entre dos baselines antes de un reset crítico.
          </p>
          <p>
            <strong>Borrar:</strong> no afecta a instancias en marcha, solo
            limpia el catálogo. No se puede borrar el canónico — quítale la
            marca primero.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  if (isOperator) {
    return (
      <OperatorShell email={session.user.email} flush>
        {subheader}
        {content}
      </OperatorShell>
    );
  }

  return (
    <main className="min-h-screen">
      {subheader}
      {content}
    </main>
  );
}
