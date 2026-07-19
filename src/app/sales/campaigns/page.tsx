import Link from "next/link";
import { requireSalesRep } from "@/lib/session";
import { SalesShell } from "@/components/sales-shell";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SalesCampaignsPage() {
  const session = await requireSalesRep();

  const salesRep = await db.salesRep.findUnique({
    where: { userId: session.user.id },
    select: { id: true, _count: { select: { prospects: true } } },
  });

  const campaigns = await db.campaign.findMany({
    include: {
      sends: {
        where: salesRep ? { prospect: { salesRepId: salesRep.id } } : undefined,
        select: { id: true, status: true },
      },
      _count: { select: { sends: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <SalesShell email={session.user.email}>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Campañas disponibles
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecciona una campaña y envíala a tus prospects.
          </p>
        </div>

        {!salesRep || salesRep._count.prospects === 0 ? (
          <div className="card-paper p-6 text-sm text-muted-foreground">
            No tienes prospects todavía.{" "}
            <Link href="/sales" className="text-brand hover:underline">
              Añade el primero aquí.
            </Link>
          </div>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            El equipo no ha creado ninguna campaña todavía.
          </p>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => {
              const myMySentCount = c.sends.filter(
                (s) => s.status === "SENT",
              ).length;
              return (
                <Card
                  key={c.id}
                  className="card-paper hover:bg-muted/10 transition-colors"
                >
                  <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.subject}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {myMySentCount > 0 && (
                        <Badge variant="secondary" className="text-[11px]">
                          {myMySentCount} enviados a mis prospects
                        </Badge>
                      )}
                      <Link href={`/sales/campaigns/${c.id}`}>
                        <Button
                          style={{
                            backgroundColor: "var(--brand)",
                            color: "var(--brand-foreground)",
                          }}
                          size="sm"
                        >
                          Enviar →
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </SalesShell>
  );
}
