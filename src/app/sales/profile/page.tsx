import { revalidatePath } from "next/cache";
import { requireSalesRep } from "@/lib/session";
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

// Validación básica de IBAN: 2 letras de país + 2 dígitos de control + 10-30
// alfanuméricos. Sin verificación bancaria (solo formato).
function normalizeIban(raw: string): string | null {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (iban === "") return null;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return null;
  return iban;
}

export default async function SalesProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await requireSalesRep();
  const params = await searchParams;

  async function saveIbanAction(formData: FormData) {
    "use server";
    const s = await requireSalesRep();
    const raw = ((formData.get("iban") as string) ?? "").trim();
    const holder = ((formData.get("ibanHolder") as string) ?? "").trim() || null;

    // Vacío = borrar el IBAN (permitido); inválido = error.
    const iban = raw === "" ? null : normalizeIban(raw);
    if (raw !== "" && iban === null) {
      const { redirect } = await import("next/navigation");
      redirect("/sales/profile?error=1");
    }

    // Solo el propio comercial edita su cuenta de cobro.
    await db.salesRep.update({
      where: { userId: s.user.id },
      data: { iban, ibanHolder: holder },
    });
    revalidatePath("/sales/profile");
    const { redirect } = await import("next/navigation");
    redirect("/sales/profile?saved=1");
  }

  const salesRep = await db.salesRep.findUnique({
    where: { userId: session.user.id },
    select: {
      iban: true,
      ibanHolder: true,
      territory: true,
      commissionRate: true,
      user: { select: { name: true, email: true } },
    },
  });

  if (!salesRep) {
    return (
      <SalesShell email={session.user.email}>
        <p className="text-sm text-muted-foreground">
          Tu cuenta de comercial está siendo configurada.
        </p>
      </SalesShell>
    );
  }

  return (
    <SalesShell email={session.user.email}>
      <div className="space-y-8 max-w-2xl">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Mi perfil
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tus datos como comercial y tu cuenta de cobro.
          </p>
        </div>

        {/* Datos (solo lectura) */}
        <Card className="card-paper">
          <CardHeader>
            <CardTitle className="text-base">Datos</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Nombre
                </dt>
                <dd className="mt-0.5 font-medium">
                  {salesRep.user.name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Email
                </dt>
                <dd className="mt-0.5 font-medium">{salesRep.user.email}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Territorio
                </dt>
                <dd className="mt-0.5 font-medium">
                  {salesRep.territory ?? "Sin asignar"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Comisión
                </dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {Math.round(salesRep.commissionRate * 100)}% por venta
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground mt-4">
              Estos datos los gestiona la empresa. Si algo no es correcto,
              contacta con tu responsable.
            </p>
          </CardContent>
        </Card>

        {/* IBAN */}
        <Card className="card-paper">
          <CardHeader>
            <CardTitle className="text-base">Cuenta de cobro</CardTitle>
            <CardDescription>
              El IBAN donde recibirás tus comisiones por transferencia
              bancaria.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveIbanAction} className="space-y-3 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="iban" className="text-xs">
                  IBAN
                </Label>
                <Input
                  id="iban"
                  name="iban"
                  defaultValue={salesRep.iban ?? ""}
                  placeholder="ES00 0000 0000 0000 0000 0000"
                  className="font-mono"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ibanHolder" className="text-xs">
                  Titular de la cuenta
                </Label>
                <Input
                  id="ibanHolder"
                  name="ibanHolder"
                  defaultValue={salesRep.ibanHolder ?? ""}
                  placeholder={salesRep.user.name ?? "Nombre del titular o empresa"}
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground">
                  Persona o empresa titular del IBAN — puede no ser tu nombre
                  (p. ej. tu sociedad).
                </p>
              </div>

              {params?.error === "1" && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  El IBAN no tiene un formato válido. Revisa que empiece por el
                  código de país (p. ej. ES) seguido de los dígitos.
                </p>
              )}
              {params?.saved === "1" && (
                <p className="text-sm text-green-600 dark:text-green-400">
                  ✔ Cuenta de cobro guardada.
                </p>
              )}

              <Button
                type="submit"
                style={{
                  backgroundColor: "var(--brand)",
                  color: "var(--brand-foreground)",
                }}
              >
                Guardar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </SalesShell>
  );
}
