// Importación de clientes desde Excel/CSV (change clientes-crm).
// Single-phase con confirmación: subes el archivo + marcas "crear", el servidor
// parsea, deduplica por (suiteId, email) y crea los válidos; se muestra el
// resultado (creados / duplicados / con error y por qué).
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSalesRep } from "@/lib/session";
import { SalesShell } from "@/components/sales-shell";
import { db } from "@/lib/db";
import { parseImportFile, MAX_IMPORT_ROWS } from "@/lib/client-import";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type ImportResult = {
  created: number;
  duplicates: number;
  invalid: { row: number; reason: string }[];
  total: number;
};

// Guardamos el último resultado por usuario en memoria del proceso (efímero;
// suficiente para mostrarlo tras el redirect sin persistir nada).
const lastResult = new Map<string, ImportResult>();

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const session = await requireSalesRep();
  const params = await searchParams;

  async function importAction(formData: FormData) {
    "use server";
    const s = await requireSalesRep();
    const rep = await db.salesRep.findUnique({ where: { userId: s.user.id } });
    if (!rep) redirect("/sales/import?error=nosuite");
    const confirm = formData.get("confirm") === "1";
    const file = formData.get("file");
    if (!confirm || !(file instanceof File) || file.size === 0) {
      redirect("/sales/import?error=nofile");
    }
    const f = file as File;
    if (f.size > 5 * 1024 * 1024) redirect("/sales/import?error=toobig");

    let parsed;
    try {
      parsed = await parseImportFile(f);
    } catch {
      redirect("/sales/import?error=parse");
    }

    const suiteId = s.user.suiteId ?? null;
    // Dedupe por email dentro de la Suite (o del comercial si aún sin suite).
    const emails = parsed.valid.map((r) => r.email);
    const existing = await db.prospect.findMany({
      where: {
        email: { in: emails },
        ...(suiteId ? { suiteId } : { salesRepId: rep!.id }),
      },
      select: { email: true },
    });
    const seen = new Set(existing.map((e) => e.email.toLowerCase()));
    let duplicates = 0;
    const toCreate = parsed.valid.filter((r) => {
      if (seen.has(r.email)) { duplicates++; return false; }
      seen.add(r.email); // dedupe también dentro del propio archivo
      return true;
    });

    if (toCreate.length > 0) {
      await db.prospect.createMany({
        data: toCreate.map((r) => ({
          name: r.name,
          email: r.email,
          phone: r.phone,
          cif: r.cif,
          contactName: r.contactName,
          notes: r.notes,
          status: "NEW" as const,
          salesRepId: rep!.id,
          suiteId,
          createdById: s.user.id,
        })),
      });
    }

    lastResult.set(s.user.id, {
      created: toCreate.length,
      duplicates,
      invalid: parsed.invalid.map((i) => ({ row: i.row, reason: i.reason })),
      total: parsed.totalRows,
    });
    redirect("/sales/import?done=1");
  }

  const result = params?.done ? lastResult.get(session.user.id) : null;

  return (
    <SalesShell email={session.user.email}>
      <div className="max-w-2xl space-y-6">
        <div>
          <Link href="/sales" className="text-xs text-muted-foreground hover:text-foreground">
            ← Volver a clientes
          </Link>
          <h1 className="font-display text-2xl font-semibold tracking-tight mt-1">
            Importar clientes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sube un Excel (.xlsx) o CSV. Cada fila es un cliente; deben llevar al
            menos <strong>nombre, email y teléfono</strong>. Los emails ya
            existentes en tu cartera se omiten.
          </p>
        </div>

        {params?.error && (
          <div className="rounded-xl px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">
            {params.error === "nofile" && "Selecciona un archivo y marca la casilla de confirmación."}
            {params.error === "toobig" && "El archivo es demasiado grande (máx. 5 MB)."}
            {params.error === "parse" && "No hemos podido leer el archivo. ¿Es un .xlsx o .csv válido?"}
            {params.error === "nosuite" && "Tu cuenta aún no está configurada."}
          </div>
        )}

        {result ? (
          <Card className="card-paper">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Importación completada</CardTitle>
              <CardDescription>{result.total} filas procesadas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800">
                  ✓ {result.created} creados
                </span>
                <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700">
                  {result.duplicates} duplicados omitidos
                </span>
                <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-800">
                  {result.invalid.length} con error
                </span>
              </div>
              {result.invalid.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-1 max-h-48 overflow-y-auto">
                  {result.invalid.slice(0, 50).map((i) => (
                    <div key={i.row}>Fila {i.row}: {i.reason}</div>
                  ))}
                  {result.invalid.length > 50 && <div>… y {result.invalid.length - 50} más</div>}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Link href="/sales">
                  <Button>Ver mis clientes →</Button>
                </Link>
                <Link href="/sales/import">
                  <Button variant="outline">Importar otro archivo</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="card-paper">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Subir archivo</CardTitle>
              <CardDescription>
                Cabeceras flexibles: valen "Empresa/Razón social", "Correo",
                "Móvil"… Máx. {MAX_IMPORT_ROWS} filas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={importAction} className="space-y-4">
                <input
                  type="file"
                  name="file"
                  accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  required
                  className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:text-white file:px-4 file:py-2 file:text-sm file:font-semibold file:cursor-pointer"
                />
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" name="confirm" value="1" required className="h-4 w-4 accent-emerald-600" />
                  He revisado el archivo; crear los clientes.
                </label>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Importar
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </SalesShell>
  );
}
