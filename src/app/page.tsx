import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function HomePage() {
  const session = await getSession();
  if (session?.user) {
    if (session.user.role === "OPERATOR") redirect("/operator");
    if (session.user.role === "FIRM_ADMIN") redirect("/firm");
  }

  return (
    <div className="relative">
      <div
        aria-hidden
        className="spotlight pointer-events-none absolute inset-x-0 top-0 h-[700px]"
      />

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="container-page relative space-y-24 py-16 sm:py-20 lg:py-28">
        {/* Hero */}
        <section className="grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16">
          <div className="animate-fade-in-slow space-y-7">
            <div className="eyebrow-chip">clawhub · control plane</div>

            <h1 className="font-display text-[3.25rem] font-semibold leading-[0.98] tracking-[-0.04em] text-balance sm:text-6xl lg:text-7xl">
              Gestiona tu equipo de{" "}
              <br className="hidden sm:block" />
              <span className="brand-underline">
                <span>copilotos IA</span>
                <span aria-hidden />
              </span>{" "}
              desde un único panel.
            </h1>

            <p className="max-w-xl text-lg sm:text-xl text-muted-foreground text-pretty leading-relaxed">
              Cada trabajador instala su instancia local. Tú publicas SOPs y
              plantillas desde aquí —{" "}
              <span className="text-foreground/90">
                todas las instancias las descargan
              </span>{" "}
              al cabo de un heartbeat. Datos sensibles en su PC, gobernanza
              centralizada.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/login"
                className={buttonVariants({ size: "lg" }) + " h-12 px-6 text-base"}
                style={{
                  backgroundColor: "var(--brand)",
                  color: "var(--brand-foreground)",
                }}
              >
                Iniciar sesión →
              </Link>
              <Link
                href="#valor"
                className={
                  buttonVariants({ variant: "outline", size: "lg" }) +
                  " h-12 px-6 text-base"
                }
              >
                Cómo funciona
              </Link>
            </div>
          </div>

          {/* Mock visual a la derecha — diagrama simple inline */}
          <div className="animate-fade-in-slow [animation-delay:200ms]">
            <div className="card-paper p-6 sm:p-8 space-y-5">
              <div className="eyebrow">Fleet vivo</div>
              <div className="space-y-2">
                {[
                  { label: "María García", state: "online", v: "0.1.0" },
                  { label: "Carlos Ruiz", state: "online", v: "0.1.0" },
                  { label: "PC-Recepción", state: "offline", v: "0.1.0" },
                  { label: "Ana López", state: "online", v: "0.0.9" },
                ].map((w) => (
                  <div
                    key={w.label}
                    className="flex items-center justify-between rounded-md border border-border bg-paper-2/40 px-3 py-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            w.state === "online" ? "var(--brand)" : "#aaa",
                        }}
                      />
                      <span className="text-sm font-medium">{w.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      v{w.v}
                    </span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground border-t border-border pt-3">
                Heartbeat cada 60s · auto-refresh
              </div>
            </div>
          </div>
        </section>

        {/* Valor — 3 columnas */}
        <section id="valor" className="space-y-10">
          <div className="max-w-3xl space-y-3">
            <div className="eyebrow-chip">Qué resuelve</div>
            <h2 className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Una instancia por trabajador.{" "}
              <span className="text-muted-foreground">
                Coordinadas desde clawhub.
              </span>
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Visibilidad real",
                body:
                  "Online/offline de cada PC, versión, último heartbeat. Sin SSH ni VPN, solo phone-home outbound.",
              },
              {
                title: "SOPs firma-wide",
                body:
                  "Publicas un procedimiento, en menos de un minuto está en disco en todas las instancias en formato OpenClaw skill.",
              },
              {
                title: "Sin datos en cloud",
                body:
                  "Correo, ficheros y teachings personales nunca salen del PC del trabajador. Solo telemetría agregada.",
              },
            ].map((feat) => (
              <div key={feat.title} className="card-paper p-6 space-y-3">
                <div className="h-1.5 w-10 rounded-full bg-brand" />
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  {feat.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feat.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section
          className="overflow-hidden rounded-3xl border p-10 sm:p-16"
          style={{
            background:
              "linear-gradient(135deg, var(--brand-soft) 0%, var(--card) 50%, var(--paper-2) 100%)",
          }}
        >
          <div className="mx-auto max-w-2xl space-y-6 text-center">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
              Tu fleet de copilotos te está esperando.
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground text-pretty">
              Login dev disponible para probar — sin tarjeta, sin emails de
              verificación. Entra y mira.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link
                href="/login"
                className={buttonVariants({ size: "lg" }) + " h-12 px-6 text-base"}
                style={{
                  backgroundColor: "var(--brand)",
                  color: "var(--brand-foreground)",
                }}
              >
                Iniciar sesión →
              </Link>
            </div>
            <div className="flex items-center justify-center gap-3 pt-3 text-xs text-muted-foreground">
              <span>v0 · control plane</span>
              <span>·</span>
              <span>Phone-home + skills push</span>
              <span>·</span>
              <span>En español</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
