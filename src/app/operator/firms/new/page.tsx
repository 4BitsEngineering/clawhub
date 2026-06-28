import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";
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

async function createFirmAction(formData: FormData) {
  "use server";
  const name = ((formData.get("name") as string) ?? "").trim();
  const plan = (formData.get("plan") as string) ?? "STARTER";
  const seats = Number(formData.get("seats") ?? 5);

  if (!name) return;
  if (!["STARTER", "PRO", "BUSINESS", "ENTERPRISE"].includes(plan)) return;
  if (!Number.isFinite(seats) || seats < 1) return;

  const firm = await db.firm.create({
    data: {
      name,
      plan: plan as "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE",
      seatsPurchased: seats,
    },
  });

  revalidatePath("/operator");
  redirect(`/operator/firms/${firm.id}`);
}

export default async function NewFirmPage() {
  await requireOperator();
  return (
    <main className="container-page min-h-screen py-8 sm:py-12 max-w-2xl space-y-8">
      <div className="text-sm">
        <Link
          href="/operator"
          className="text-muted-foreground hover:text-foreground"
        >
          ← Panel de operador
        </Link>
      </div>

      <header className="space-y-2">
        <div className="eyebrow-chip">nueva empresa</div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
          Nueva empresa
        </h1>
        <p className="text-sm text-muted-foreground">
          Crea un tenant con plan y nº de seats inicial. Después puedes editar
          plan/seats y añadir firm_admin users.
        </p>
      </header>

      <Card className="card-paper border-0 shadow-none">
        <CardHeader>
          <CardTitle className="font-display text-xl">Datos</CardTitle>
          <CardDescription>
            El slug y firm_id se generan automáticamente al crear.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createFirmAction} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="eyebrow text-[10px]">
                Nombre comercial
              </Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={120}
                placeholder="Asesoría García, S.L."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan" className="eyebrow text-[10px]">
                Plan
              </Label>
              <select
                id="plan"
                name="plan"
                defaultValue="STARTER"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="STARTER">Starter</option>
                <option value="PRO">Pro</option>
                <option value="BUSINESS">Business</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="seats" className="eyebrow text-[10px]">
                Seats incluidos
              </Label>
              <Input
                id="seats"
                name="seats"
                type="number"
                min={1}
                max={500}
                defaultValue={5}
                required
              />
              <p className="text-xs text-muted-foreground">
                Nº de instancias permitidas. Editable después.
              </p>
            </div>

            <div className="flex gap-2 pt-3">
              <Button
                type="submit"
                style={{
                  backgroundColor: "var(--brand)",
                  color: "var(--brand-foreground)",
                }}
              >
                Crear firma
              </Button>
              <Link
                href="/operator"
                className="inline-flex items-center px-3 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
