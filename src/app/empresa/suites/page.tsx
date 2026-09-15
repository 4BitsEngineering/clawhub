// Gestión de Zonas y Suites (change suites-and-zones) — OPERATOR/EMPRESA.
// CRUD básico: crear/editar Zonas, crear/editar Suites (zona, tipo, teléfono,
// comisión, IBAN). El perfil self-service de la Suite lo edita su propio
// usuario en /sales/suite.
import { revalidatePath } from "next/cache";
import { requireEmpresa } from "@/lib/session";
import { EmpresaShell } from "@/components/empresa-shell";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

export const dynamic = "force-dynamic";

const SUITE_TYPES = ["ASESORIA", "ASOCIACION", "EMPRESA", "OTRO"] as const;
const TYPE_LABEL: Record<string, string> = {
  ASESORIA: "Asesoría",
  ASOCIACION: "Asociación",
  EMPRESA: "Empresa",
  OTRO: "Otro",
};

function rateToPct(r: number) {
  return `${Math.round(r * 100)}%`;
}

export default async function SuitesPage() {
  const session = await requireEmpresa();

  async function createZoneAction(formData: FormData) {
    "use server";
    await requireEmpresa();
    const name = ((formData.get("name") as string) ?? "").trim();
    if (!name) return;
    await db.zone.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    revalidatePath("/empresa/suites");
  }

  async function createSuiteAction(formData: FormData) {
    "use server";
    await requireEmpresa();
    const name = ((formData.get("name") as string) ?? "").trim();
    if (!name) return;
    const typeRaw = (formData.get("type") as string) ?? "EMPRESA";
    const type = (SUITE_TYPES as readonly string[]).includes(typeRaw)
      ? (typeRaw as (typeof SUITE_TYPES)[number])
      : "EMPRESA";
    const zoneId = ((formData.get("zoneId") as string) ?? "").trim() || null;
    const phone = ((formData.get("phone") as string) ?? "").trim() || null;
    const rateRaw = parseFloat((formData.get("commissionRate") as string) ?? "35");
    const commissionRate = isNaN(rateRaw)
      ? 0.35
      : Math.max(0, Math.min(1, rateRaw / 100));
    const iban =
      ((formData.get("iban") as string) ?? "").toUpperCase().replace(/\s/g, "") ||
      null;
    await db.suite.create({
      data: { name, type, zoneId, phone, commissionRate, iban },
    });
    revalidatePath("/empresa/suites");
  }

  async function updateSuiteAction(formData: FormData) {
    "use server";
    await requireEmpresa();
    const id = (formData.get("suiteId") as string) ?? "";
    if (!id) return;
    const zoneId = ((formData.get("zoneId") as string) ?? "").trim() || null;
    const phone = ((formData.get("phone") as string) ?? "").trim() || null;
    const rateRaw = parseFloat((formData.get("commissionRate") as string) ?? "35");
    const commissionRate = isNaN(rateRaw)
      ? 0.35
      : Math.max(0, Math.min(1, rateRaw / 100));
    await db.suite.update({
      where: { id },
      data: { zoneId, phone, commissionRate },
    });
    revalidatePath("/empresa/suites");
  }

  const [zones, suites] = await Promise.all([
    db.zone.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { suites: true } } } }),
    db.suite.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        zone: { select: { name: true } },
        _count: { select: { users: true, prospects: true } },
      },
    }),
  ]);

  const inputCls = "h-9 rounded-md border border-border bg-background px-2 text-sm";

  return (
    <EmpresaShell email={session.user.email} isOperator>
      <div className="space-y-8 max-w-5xl">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Zonas y Suites
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Las Suites son oficinas (asesorías, asociaciones, empresas…) que
            gestionan su cartera de clientes y campañas bajo su marca. Las Zonas
            las agrupan.
          </p>
        </div>

        {/* ── Zonas ── */}
        <Card className="card-paper">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Zonas ({zones.length})</CardTitle>
            <CardDescription>Agrupación geográfica u organizativa de Suites.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {zones.map((z) => (
                <Badge key={z.id} variant="secondary" className="text-sm">
                  {z.name} · {z._count.suites}
                </Badge>
              ))}
              {zones.length === 0 && (
                <span className="text-sm text-muted-foreground">Aún no hay zonas.</span>
              )}
            </div>
            <form action={createZoneAction} className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="zone-name" className="text-xs">Nueva zona</Label>
                <Input id="zone-name" name="name" placeholder="Valencia" className="h-9" />
              </div>
              <Button type="submit" size="sm">Añadir zona</Button>
            </form>
          </CardContent>
        </Card>

        {/* ── Crear Suite ── */}
        <Card className="card-paper">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Nueva Suite</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createSuiteAction} className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="s-name" className="text-xs">Nombre (marca)</Label>
                <Input id="s-name" name="name" required placeholder="Asesoría X" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="s-type" className="text-xs">Tipo</Label>
                <select id="s-type" name="type" defaultValue="EMPRESA" className={`${inputCls} w-full`}>
                  {SUITE_TYPES.map((t) => (
                    <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="s-zone" className="text-xs">Zona</Label>
                <select id="s-zone" name="zoneId" defaultValue="" className={`${inputCls} w-full`}>
                  <option value="">— sin zona —</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="s-phone" className="text-xs">Teléfono</Label>
                <Input id="s-phone" name="phone" placeholder="+34 …" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="s-rate" className="text-xs">Comisión (%)</Label>
                <Input id="s-rate" name="commissionRate" type="number" min="0" max="100" step="1" defaultValue="35" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="s-iban" className="text-xs">IBAN (cobro comisiones)</Label>
                <Input id="s-iban" name="iban" placeholder="ES…" className="h-9" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Crear Suite</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── Listado de Suites ── */}
        <Card className="card-paper">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Suites ({suites.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {["Suite", "Tipo", "Zona", "Teléfono", "Comisión", "Usuarios / Clientes", ""].map((h) => (
                      <TableHead key={h} className="text-[11px] uppercase tracking-wider whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suites.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{TYPE_LABEL[s.type]}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.zone?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.phone ?? (
                          <span className="text-[11px] text-amber-600">sin teléfono</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">{rateToPct(s.commissionRate)}</TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {s._count.users} / {s._count.prospects}
                      </TableCell>
                      <TableCell>
                        <form action={updateSuiteAction} className="flex items-center gap-1.5">
                          <input type="hidden" name="suiteId" value={s.id} />
                          <select name="zoneId" defaultValue={s.zoneId ?? ""} className={inputCls} title="Zona">
                            <option value="">— zona —</option>
                            {zones.map((z) => (
                              <option key={z.id} value={z.id}>{z.name}</option>
                            ))}
                          </select>
                          <input name="phone" defaultValue={s.phone ?? ""} placeholder="teléfono" className={`${inputCls} w-28`} />
                          <input name="commissionRate" type="number" min="0" max="100" defaultValue={Math.round(s.commissionRate * 100)} className={`${inputCls} w-16`} title="Comisión %" />
                          <Button type="submit" variant="ghost" size="sm" className="h-8 text-xs">Guardar</Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                  {suites.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                        Aún no hay Suites. Crea la primera arriba.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </EmpresaShell>
  );
}
