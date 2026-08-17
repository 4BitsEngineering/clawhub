import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireOperator } from "@/lib/session";
import { EmpresaShell } from "@/components/empresa-shell";
import { db } from "@/lib/db";
import { toEmbedUrl } from "@/lib/video-embed";
import {
  TOKEN_PERIODS_ORDER,
  TOKEN_PERIOD_LABEL,
  TOKEN_PERIOD_MONTHS,
} from "@/lib/pricing";
import type { TokenBillingPeriod } from "@/generated/prisma/client";
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
  const session = await requireOperator();

  async function saveLandingAction(formData: FormData) {
    "use server";
    await requireOperator();

    const headline = ((formData.get("headline") as string) ?? "").trim();
    const videoRaw = ((formData.get("videoUrl") as string) ?? "").trim();
    const bodyHtml = ((formData.get("bodyHtml") as string) ?? "").trim();

    // Fee de renovación (precio de lista, lo que se cobra cada renovación anual)
    const renewalCentsRaw = Math.round(
      parseFloat((formData.get("renewalPrice") as string) ?? "200") * 100,
    );
    const renewalCents = isNaN(renewalCentsRaw) ? 20000 : renewalCentsRaw;

    // Descuento del primer año: importe absoluto (precio directo) o porcentaje.
    const feeDiscountType =
      formData.get("feeDiscountType") === "PERCENT" ? "PERCENT" : "ABSOLUTE";
    let discountCents: number;
    let feeDiscountPercent: number | null = null;
    if (feeDiscountType === "PERCENT") {
      const pct = Math.min(
        100,
        Math.max(0, Math.round(parseFloat((formData.get("discountPercent") as string) ?? "0"))),
      );
      feeDiscountPercent = isNaN(pct) ? 0 : pct;
      discountCents = Math.round((renewalCents * (100 - feeDiscountPercent)) / 100);
    } else {
      const absRaw = Math.round(
        parseFloat((formData.get("firstYearPrice") as string) ?? "149") * 100,
      );
      discountCents = isNaN(absRaw) ? 14900 : Math.min(absRaw, renewalCents);
    }

    // Tokens: precio mensual base + periodos ofrecidos (al menos uno).
    const tokenMonthlyRaw = Math.round(
      parseFloat((formData.get("tokenMonthlyPrice") as string) ?? "20") * 100,
    );
    const tokenMonthlyPriceCents = isNaN(tokenMonthlyRaw) ? 2000 : tokenMonthlyRaw;
    // Pronto pago anual: debe ser ≤ precio estándar (se recorta si no).
    const tokenAnnualRaw = Math.round(
      parseFloat((formData.get("tokenMonthlyPriceAnnual") as string) ?? "15") * 100,
    );
    const tokenMonthlyPriceAnnualCents = Math.min(
      isNaN(tokenAnnualRaw) ? 1500 : tokenAnnualRaw,
      tokenMonthlyPriceCents,
    );
    const tokenPeriods = TOKEN_PERIODS_ORDER.filter(
      (p) => formData.get(`period_${p}`) === "1",
    );
    const finalPeriods: TokenBillingPeriod[] =
      tokenPeriods.length > 0 ? tokenPeriods : TOKEN_PERIODS_ORDER;

    const discountEndsRaw = (
      (formData.get("discountEndsAt") as string) ?? ""
    ).trim();
    const isActive = formData.get("isActive") === "1";

    const discountEndsAt = discountEndsRaw ? new Date(discountEndsRaw) : null;
    const videoUrl = toEmbedUrl(videoRaw);

    const data = {
      headline,
      videoUrl,
      bodyHtml,
      originalPriceCents: renewalCents,
      discountPriceCents: discountCents,
      feeDiscountType,
      feeDiscountPercent,
      tokenMonthlyPriceCents,
      tokenMonthlyPriceAnnualCents,
      tokenPeriods: finalPeriods,
      discountEndsAt,
      isActive,
    } as const;

    await db.landingPage.upsert({
      where: { slug: SLUG },
      update: data,
      create: { slug: SLUG, ...data },
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
  const renewalEuros = (landing.originalPriceCents / 100).toFixed(2);
  const firstYearEuros = (landing.discountPriceCents / 100).toFixed(2);
  const tokenMonthlyEuros = (landing.tokenMonthlyPriceCents / 100).toFixed(2);
  const tokenAnnualEuros = (landing.tokenMonthlyPriceAnnualCents / 100).toFixed(2);
  const isPercent = landing.feeDiscountType === "PERCENT";
  const percentValue = landing.feeDiscountPercent ?? 0;
  const offeredPeriods = new Set(landing.tokenPeriods);

  // Format datetime-local value (requires "YYYY-MM-DDTHH:mm")
  function toDatetimeLocal(d: Date | null): string {
    if (!d) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  return (
    <EmpresaShell email={session.user.email} isOperator>
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

              {/* ── Fee de licencia (suscripción anual) ── */}
              <div className="rounded-lg border border-border p-4 space-y-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Fee de licencia · suscripción anual
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="renewalPrice" className="text-xs">
                      Precio de renovación anual (€)
                    </Label>
                    <Input
                      id="renewalPrice"
                      name="renewalPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={renewalEuros}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Lo que se cobra cada año a partir del segundo.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Descuento del primer año</Label>
                    <div className="flex gap-2">
                      <select
                        name="feeDiscountType"
                        defaultValue={isPercent ? "PERCENT" : "ABSOLUTE"}
                        className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                      >
                        <option value="ABSOLUTE">Precio (€)</option>
                        <option value="PERCENT">Porcentaje (%)</option>
                      </select>
                      <Input
                        name="firstYearPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={firstYearEuros}
                        placeholder="149.00"
                        className="flex-1"
                      />
                      <Input
                        name="discountPercent"
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        defaultValue={percentValue}
                        placeholder="%"
                        className="w-20"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Según el tipo, se usa el precio directo o el %. El primer
                      año es la base de la comisión del comercial.
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Tokens (suscripción de consumo) ── */}
              <div className="rounded-lg border border-border p-4 space-y-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tokens · suscripción de consumo
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tokenMonthlyPrice" className="text-xs">
                      Precio de tokens (€ / mes)
                    </Label>
                    <Input
                      id="tokenMonthlyPrice"
                      name="tokenMonthlyPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={tokenMonthlyEuros}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tokenMonthlyPriceAnnual" className="text-xs">
                      Con pago anual (€ / mes)
                    </Label>
                    <Input
                      id="tokenMonthlyPriceAnnual"
                      name="tokenMonthlyPriceAnnual"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={tokenAnnualEuros}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Pronto pago: si el cliente paga el año entero. Debe ser
                      ≤ que el precio estándar.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Periodos ofrecidos al cliente</Label>
                  <div className="flex flex-wrap gap-4">
                    {TOKEN_PERIODS_ORDER.map((p) => (
                      <label
                        key={p}
                        className="flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          name={`period_${p}`}
                          value="1"
                          defaultChecked={offeredPeriods.has(p)}
                          className="accent-violet-600 h-4 w-4"
                        />
                        <span>
                          {TOKEN_PERIOD_LABEL[p]}{" "}
                          <span className="text-muted-foreground">
                            (×{TOKEN_PERIOD_MONTHS[p]})
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Precio de cada periodo = precio mensual × meses. Debe haber
                    al menos uno.
                  </p>
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
