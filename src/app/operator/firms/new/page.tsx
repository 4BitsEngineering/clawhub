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
    <main className="min-h-screen p-8 max-w-2xl mx-auto space-y-6">
      <div className="text-sm">
        <Link
          href="/operator"
          className="text-muted-foreground hover:text-foreground"
        >
          ← operator
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva firma</h1>
        <p className="text-sm text-muted-foreground">
          Crea una firma (tenant) con plan y nº de seats inicial.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
          <CardDescription>
            Después podrás editar plan/seats y añadir firm_admin users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createFirmAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre comercial</Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={120}
                placeholder="Asesoría García, S.L."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
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
              <Label htmlFor="seats">Seats incluidos</Label>
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
                Número de instancias permitidas. Editable después.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit">Crear firma</Button>
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
