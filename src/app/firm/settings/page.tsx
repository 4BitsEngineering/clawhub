/**
 * /firm/settings — firm admin gestiona ajustes básicos de su firma.
 *
 * Editable:
 *   - Nombre comercial de la firma
 *
 * Solo lectura (operator gestiona):
 *   - Plan, seats contratadas, canal de stack, versiones pineadas
 *
 * Link "ampliar plan" → mailto a soporte para contratar más seats / upgrade.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireFirmAdmin } from "@/lib/session";
import { recordActivity } from "@/lib/activity";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "soporte@clawhub.es";

export default async function FirmSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await requireFirmAdmin();
  const sp = await searchParams;
  const firmId = session.user.firmId;

  const firm = await db.firm.findUnique({
    where: { id: firmId },
    include: {
      _count: { select: { instances: true, users: true } },
    },
  });
  if (!firm) redirect("/login");

  async function updateNameAction(formData: FormData) {
    "use server";
    const sess = await requireFirmAdmin();
    const name = String(formData.get("name") ?? "").trim();
    if (!name || name.length > 120) throw new Error("name_invalid");
    await db.firm.update({
      where: { id: sess.user.firmId },
      data: { name },
    });
    await recordActivity({
      kind: "firm.update_name",
      summary: `Cambió el nombre de la firma a "${name}"`,
      firmId: sess.user.firmId,
      actor: sess,
      metadata: { new_name: name },
    });
    revalidatePath("/firm/settings");
    revalidatePath("/firm");
    redirect("/firm/settings?saved=name");
  }

  const requestUpgradeUrl = (() => {
    const subject = `[clawhub] Solicitud ampliar plan — ${firm.name}`;
    const body = [
      `Hola,`,
      ``,
      `Soy ${session.user.email}, admin de "${firm.name}".`,
      `Plan actual: ${firm.plan} con ${firm.seatsPurchased} seats (uso actual: ${firm._count.instances}/${firm.seatsPurchased}).`,
      ``,
      `Me gustaría:`,
      `  [ ] Ampliar a más seats`,
      `  [ ] Cambiar de plan (a STARTER / PRO / BUSINESS / ENTERPRISE)`,
      `  [ ] Otra cosa: __________`,
      ``,
      `Gracias.`,
    ].join("\n");
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  })();

  return (
    <main className="container-page min-h-screen py-8 sm:py-12 space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="eyebrow-chip">firm admin · {firm.name}</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            Ajustes
          </h1>
        </div>
        <Link
          href="/firm"
          className="text-sm underline text-muted-foreground"
        >
          ← Volver
        </Link>
      </header>

      {sp.saved && (
        <div className="card-quiet p-3 border-l-4 border-green-500 text-sm">
          ✅ Cambios guardados.
        </div>
      )}

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">
            Nombre de la firma
          </CardTitle>
          <CardDescription>
            Cómo aparece tu firma en clawhub y en los wizards de pairing.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form
            action={updateNameAction}
            className="flex flex-col sm:flex-row gap-2 sm:items-end"
          >
            <div className="space-y-1 flex-1 max-w-md">
              <label htmlFor="name" className="eyebrow text-[10px] block">
                Nombre
              </label>
              <input
                id="name"
                name="name"
                required
                defaultValue={firm.name}
                maxLength={120}
                className="card-quiet w-full px-3 h-10 text-sm bg-transparent border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button type="submit" className="h-10 px-4">
              Guardar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">Plan y cupo</CardTitle>
          <CardDescription>
            Para cambiar plan o ampliar cupo contacta con soporte.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="card-quiet p-3 space-y-1">
              <div className="eyebrow text-[10px]">Plan</div>
              <div className="text-lg font-semibold">{firm.plan}</div>
            </div>
            <div className="card-quiet p-3 space-y-1">
              <div className="eyebrow text-[10px]">Seats contratadas</div>
              <div className="text-lg font-semibold tabular-nums">
                {firm.seatsPurchased}
              </div>
            </div>
            <div className="card-quiet p-3 space-y-1">
              <div className="eyebrow text-[10px]">PCs registrados</div>
              <div className="text-lg font-semibold tabular-nums">
                {firm._count.instances} / {firm.seatsPurchased}
              </div>
            </div>
            <div className="card-quiet p-3 space-y-1">
              <div className="eyebrow text-[10px]">Usuarios</div>
              <div className="text-lg font-semibold tabular-nums">
                {firm._count.users}
              </div>
            </div>
          </div>
          <a
            href={requestUpgradeUrl}
            className="inline-flex items-center h-10 px-4 text-sm rounded border bg-background hover:bg-paper-2"
          >
            ✉ Pedir ampliación a soporte
          </a>
        </CardContent>
      </Card>

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">Stack</CardTitle>
          <CardDescription>
            Versiones pineadas por operator. Los cambios aquí solo los puede
            hacer el operator de clawhub.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Canal</dt>
            <dd className="font-medium">{firm.stackChannel}</dd>
            <dt className="text-muted-foreground">Auto-update</dt>
            <dd className="font-medium">
              {firm.stackAutoUpdate ? "Sí" : "No"}
            </dd>
            <dt className="text-muted-foreground">OpenClaw runtime</dt>
            <dd className="font-mono text-xs">
              {firm.openclawVersion ?? "latest"}
            </dd>
            <dt className="text-muted-foreground">Bridge</dt>
            <dd className="font-mono text-xs">
              {firm.bridgeVersion ?? "latest"}
            </dd>
            <dt className="text-muted-foreground">Overlay</dt>
            <dd className="font-mono text-xs">
              {firm.overlayId ? `${firm.overlayId}@${firm.overlayVersion ?? "latest"}` : "—"}
            </dd>
          </dl>
        </CardContent>
      </Card>
    </main>
  );
}
