import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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

export const dynamic = "force-dynamic";

export default async function EditFirmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOperator();
  const { id } = await params;
  const firm = await db.firm.findUnique({ where: { id } });
  if (!firm) notFound();

  async function updateFirmAction(formData: FormData) {
    "use server";
    const name = ((formData.get("name") as string) ?? "").trim();
    const plan = (formData.get("plan") as string) ?? "STARTER";
    const seats = Number(formData.get("seats") ?? 5);

    if (!name) return;
    if (!["STARTER", "PRO", "BUSINESS", "ENTERPRISE"].includes(plan)) return;
    if (!Number.isFinite(seats) || seats < 1) return;

    await db.firm.update({
      where: { id },
      data: {
        name,
        plan: plan as "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE",
        seatsPurchased: seats,
      },
    });

    revalidatePath("/operator");
    revalidatePath(`/operator/firms/${id}`);
    redirect(`/operator/firms/${id}`);
  }

  async function deleteFirmAction(formData: FormData) {
    "use server";
    const confirmName = ((formData.get("confirm_name") as string) ?? "").trim();
    if (confirmName !== firm!.name) return;

    await db.firm.delete({ where: { id } });
    revalidatePath("/operator");
    redirect("/operator");
  }

  return (
    <main className="container-page min-h-screen py-8 sm:py-12 max-w-2xl space-y-8">
      <div className="text-sm">
        <Link
          href={`/operator/firms/${id}`}
          className="text-muted-foreground hover:text-foreground"
        >
          ← {firm.name}
        </Link>
      </div>

      <header className="space-y-2">
        <div className="eyebrow-chip">editar tenant</div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
          Editar firma
        </h1>
      </header>

      <Card className="card-paper border-0 shadow-none">
        <CardHeader>
          <CardTitle className="font-display text-xl">Datos</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateFirmAction} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="eyebrow text-[10px]">
                Nombre comercial
              </Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={120}
                defaultValue={firm.name}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan" className="eyebrow text-[10px]">
                Plan
              </Label>
              <select
                id="plan"
                name="plan"
                defaultValue={firm.plan}
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
                defaultValue={firm.seatsPurchased}
                required
              />
            </div>

            <div className="pt-3">
              <Button
                type="submit"
                style={{
                  backgroundColor: "var(--brand)",
                  color: "var(--brand-foreground)",
                }}
              >
                Guardar cambios
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="card-paper border-0 shadow-none border-destructive/30">
        <CardHeader>
          <div className="eyebrow text-[10px] text-destructive">
            Zona peligrosa
          </div>
          <CardTitle className="font-display text-xl text-destructive">
            Borrar firma
          </CardTitle>
          <CardDescription>
            Elimina instancias, heartbeats, pairing tokens y usuarios
            firm_admin asociados (cascada). Operación irreversible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteFirmAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirm_name" className="eyebrow text-[10px]">
                Escribe el nombre para confirmar
              </Label>
              <Input
                id="confirm_name"
                name="confirm_name"
                placeholder={firm.name}
                required
              />
              <p className="text-xs text-muted-foreground">
                Debe coincidir exactamente: <code>{firm.name}</code>
              </p>
            </div>
            <Button type="submit" variant="destructive">
              Borrar firma permanentemente
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
