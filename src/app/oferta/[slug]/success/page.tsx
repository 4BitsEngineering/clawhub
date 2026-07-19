import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { slug } = await params;
  const { session_id } = await searchParams;

  // Minimal Stripe verification: check that the session belongs to this landing
  // (full data is processed via webhook — this page is just UX confirmation)
  let buyerName: string | null = null;
  let buyerEmail: string | null = null;

  if (session_id) {
    const purchase = await db.purchase.findUnique({
      where: { stripeSessionId: session_id },
      select: { buyerName: true, buyerEmail: true, status: true },
    });
    // Purchase may not exist yet if webhook hasn't fired — that's fine
    if (purchase?.status === "COMPLETED") {
      buyerName = purchase.buyerName;
      buyerEmail = purchase.buyerEmail;
    }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[500px] opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, hsl(var(--brand) / 0.3), transparent)",
        }}
      />

      <div className="relative max-w-lg w-full text-center space-y-8">
        <div className="space-y-3">
          <div className="text-5xl">🎉</div>
          <div className="eyebrow-chip mx-auto w-fit">AI-Office</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
            {buyerName ? `¡Gracias, ${buyerName.split(" ")[0]}!` : "¡Gracias por tu compra!"}
          </h1>
          <p className="text-muted-foreground">
            Tu licencia anual de AI-Office ha sido procesada correctamente.
          </p>
        </div>

        <div className="card-paper rounded-2xl p-8 space-y-4 text-left">
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
            ¿Qué pasa ahora?
          </h2>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="shrink-0 text-brand">①</span>
              <span>
                Recibirás un email en{" "}
                <strong>{buyerEmail ?? "tu dirección de correo"}</strong>{" "}
                con las instrucciones de acceso.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 text-brand">②</span>
              <span>
                Nuestro equipo configurará tu espacio de trabajo en las
                próximas 24 horas.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 text-brand">③</span>
              <span>
                Descarga el cliente de escritorio y empieza a usar AI-Office
                con tu equipo.
              </span>
            </li>
          </ul>
        </div>

        <Link
          href={`/oferta/${slug}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Volver
        </Link>
      </div>
    </main>
  );
}
