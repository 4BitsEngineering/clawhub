import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireEmpresa } from "@/lib/session";
import { EmpresaShell } from "@/components/empresa-shell";
import { db } from "@/lib/db";
import { toEmbedUrl } from "@/lib/video-embed";
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

const SLUG = "ai-office";

export default async function EmpresaLandingPage() {
  const session = await requireEmpresa();

  async function saveLandingAction(formData: FormData) {
    "use server";
    await requireEmpresa();

    const headline = ((formData.get("headline") as string) ?? "").trim();
    const videoRaw = ((formData.get("videoUrl") as string) ?? "").trim();
    const bodyHtml = ((formData.get("bodyHtml") as string) ?? "").trim();
    const originalCents = Math.round(
      parseFloat((formData.get("originalPrice") as string) ?? "200") * 100,
    );
    const discountCents = Math.round(
      parseFloat((formData.get("discountPrice") as string) ?? "149") * 100,
    );
    const discountEndsRaw = (
      (formData.get("discountEndsAt") as string) ?? ""
    ).trim();
    const isActive = formData.get("isActive") === "1";

    const discountEndsAt = discountEndsRaw ? new Date(discountEndsRaw) : null;
    const videoUrl = toEmbedUrl(videoRaw);

    await db.landingPage.upsert({
      where: { slug: SLUG },
      update: {
        headline,
        videoUrl,
        bodyHtml,
        originalPriceCents: isNaN(originalCents) ? 20000 : originalCents,
        discountPriceCents: isNaN(discountCents) ? 14900 : discountCents,
        discountEndsAt,
        isActive,
      },
      create: {
        slug: SLUG,
        headline,
        videoUrl,
        bodyHtml,
        originalPriceCents: isNaN(originalCents) ? 20000 : originalCents,
        discountPriceCents: isNaN(discountCents) ? 14900 : discountCents,
        discountEndsAt,
        isActive,
      },
    });

    revalidatePath("/empresa/landing");
    revalidatePath(`/oferta/${SLUG}`);
  }

  const landing = await db.landingPage.upsert({
    where: { slug: SLUG },
    update: {},
    create: {
      slug: SLUG,
      headline: "Transforma tu empresa con AI-Office",
      originalPriceCents: 20000,
      discountPriceCents: 14900,
      isActive: true,
    },
  });

  // Convert cents to euros for the form
  const originalEuros = landing
    ? (landing.originalPriceCents / 100).toFixed(2)
    : "200.00";
  const discountEuros = landing
    ? (landing.discountPriceCents / 100).toFixed(2)
    : "149.00";

  // Format datetime-local value (requires "YYYY-MM-DDTHH:mm")
  function toDatetimeLocal(d: Date | null): string {
    if (!d) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  return (
    <EmpresaShell email={session.user.email}>
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Landing de venta
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configura la página que ven los prospects al hacer clic en la
              campaña.
            </p>
          </div>
          <Link
            href={`/oferta/${SLUG}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              Ver landing →
            </Button>
          </Link>
        </div>

        <Card className="card-paper">
          <CardHeader>
            <CardTitle>Contenido</CardTitle>
            <CardDescription>
              Pega cualquier URL de YouTube o Vimeo — se convierte a embed
              automáticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveLandingAction} className="space-y-5">
              {/* Headline */}
              <div className="space-y-2">
                <Label htmlFor="headline" className="text-xs">
                  Título principal
                </Label>
                <Input
                  id="headline"
                  name="headline"
                  required
                  defaultValue={
                    landing?.headline ??
                    "Transforma tu empresa con AI-Office"
                  }
                  placeholder="Tu titular de venta"
                />
              </div>

              {/* Vídeo */}
              <div className="space-y-2">
                <Label htmlFor="videoUrl" className="text-xs">
                  URL del vídeo{" "}
                  <span className="text-muted-foreground">
                    (YouTube / Vimeo)
                  </span>
                </Label>
                <Input
                  id="videoUrl"
                  name="videoUrl"
                  type="url"
                  defaultValue={landing?.videoUrl ?? ""}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>

              {/* Cuerpo */}
              <div className="space-y-2">
                <Label htmlFor="bodyHtml" className="text-xs">
                  Cuerpo HTML{" "}
                  <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <textarea
                  id="bodyHtml"
                  name="bodyHtml"
                  rows={8}
                  defaultValue={landing?.bodyHtml ?? ""}
                  placeholder="<p>Texto de venta, características, testimonios…</p>"
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm font-mono transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 resize-y"
                />
              </div>

              {/* Precios */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="originalPrice" className="text-xs">
                    Precio original (€)
                  </Label>
                  <Input
                    id="originalPrice"
                    name="originalPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={originalEuros}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discountPrice" className="text-xs">
                    Precio con descuento (€)
                  </Label>
                  <Input
                    id="discountPrice"
                    name="discountPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={discountEuros}
                  />
                </div>
              </div>

              {/* Fin del descuento */}
              <div className="space-y-2">
                <Label htmlFor="discountEndsAt" className="text-xs">
                  Descuento activo hasta{" "}
                  <span className="text-muted-foreground">
                    (vacío = sin límite)
                  </span>
                </Label>
                <Input
                  id="discountEndsAt"
                  name="discountEndsAt"
                  type="datetime-local"
                  defaultValue={toDatetimeLocal(landing?.discountEndsAt ?? null)}
                />
              </div>

              {/* Activa */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="isActive"
                  value="1"
                  defaultChecked={landing?.isActive ?? true}
                  className="accent-violet-600 h-4 w-4"
                />
                <span className="text-sm">Landing activa (visible al público)</span>
              </label>

              <Button
                type="submit"
                style={{
                  backgroundColor: "var(--brand)",
                  color: "var(--brand-foreground)",
                }}
              >
                Guardar cambios
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </EmpresaShell>
  );
}
