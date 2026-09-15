// Perfil de la Suite (change suites-and-zones) — self-service del usuario de
// Suite. Teléfono OBLIGATORIO al guardar + datos de facturación + IBAN/titular.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuiteUser } from "@/lib/session";
import { SalesShell } from "@/components/sales-shell";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

function normalizeIban(raw: string): string | null {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (iban === "") return null;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return null;
  return iban;
}

export default async function SuiteProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await requireSuiteUser();
  const params = await searchParams;
  const suiteId = session.user.suiteId;

  async function saveAction(formData: FormData) {
    "use server";
    const s = await requireSuiteUser();
    const phone = ((formData.get("phone") as string) ?? "").trim();
    if (!phone) redirect("/sales/suite?error=phone");

    const ibanRaw = ((formData.get("iban") as string) ?? "").trim();
    const iban = ibanRaw === "" ? null : normalizeIban(ibanRaw);
    if (ibanRaw !== "" && iban === null) redirect("/sales/suite?error=iban");

    await db.suite.update({
      where: { id: s.user.suiteId },
      data: {
        phone,
        iban,
        ibanHolder: ((formData.get("ibanHolder") as string) ?? "").trim() || null,
        billingTaxId: ((formData.get("billingTaxId") as string) ?? "").trim() || null,
        billingAddress: ((formData.get("billingAddress") as string) ?? "").trim() || null,
        billingPostalCode: ((formData.get("billingPostalCode") as string) ?? "").trim() || null,
        billingCity: ((formData.get("billingCity") as string) ?? "").trim() || null,
      },
    });
    revalidatePath("/sales/suite");
    redirect("/sales/suite?saved=1");
  }

  const suite = await db.suite.findUnique({
    where: { id: suiteId },
    include: { zone: { select: { name: true } } },
  });
  if (!suite) redirect("/sales");

  return (
    <SalesShell email={session.user.email}>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {suite.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Datos de tu oficina. El teléfono es obligatorio; los datos de
            facturación y el IBAN se usan para tus comisiones.
            {suite.zone?.name ? ` · Zona: ${suite.zone.name}` : ""}
          </p>
        </div>

        {params?.saved && (
          <div className="rounded-xl px-4 py-3 text-sm bg-emerald-50 text-emerald-800 border border-emerald-200">
            ✓ Datos guardados.
          </div>
        )}
        {params?.error === "phone" && (
          <div className="rounded-xl px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">
            El teléfono es obligatorio.
          </div>
        )}
        {params?.error === "iban" && (
          <div className="rounded-xl px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">
            El IBAN no tiene un formato válido.
          </div>
        )}

        <Card className="card-paper">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Perfil de la Suite</CardTitle>
            <CardDescription>Comisión vigente: {Math.round(suite.commissionRate * 100)}%</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveAction} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-xs">Teléfono *</Label>
                  <Input id="phone" name="phone" required defaultValue={suite.phone ?? ""} placeholder="+34 …" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="billingTaxId" className="text-xs">CIF / NIF</Label>
                  <Input id="billingTaxId" name="billingTaxId" defaultValue={suite.billingTaxId ?? ""} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="billingAddress" className="text-xs">Dirección</Label>
                  <Input id="billingAddress" name="billingAddress" defaultValue={suite.billingAddress ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="billingPostalCode" className="text-xs">Código postal</Label>
                  <Input id="billingPostalCode" name="billingPostalCode" defaultValue={suite.billingPostalCode ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="billingCity" className="text-xs">Ciudad</Label>
                  <Input id="billingCity" name="billingCity" defaultValue={suite.billingCity ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="iban" className="text-xs">IBAN (cobro de comisiones)</Label>
                  <Input id="iban" name="iban" defaultValue={suite.iban ?? ""} placeholder="ES…" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ibanHolder" className="text-xs">Titular de la cuenta</Label>
                  <Input id="ibanHolder" name="ibanHolder" defaultValue={suite.ibanHolder ?? ""} />
                </div>
              </div>
              <Button type="submit">Guardar</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </SalesShell>
  );
}
