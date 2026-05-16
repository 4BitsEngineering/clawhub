import Link from "next/link";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";
import { AutoRefresh } from "@/components/auto-refresh";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function OperatorPage() {
  const session = await requireOperator();
  const firms = await db.firm.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { instances: true, users: true } },
    },
  });

  const totalInstances = firms.reduce((sum, f) => sum + f._count.instances, 0);
  const totalSeats = firms.reduce((sum, f) => sum + f.seatsPurchased, 0);

  return (
    <main className="container-page min-h-screen py-8 sm:py-12 space-y-8">
      <AutoRefresh intervalMs={10_000} />

      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-2">
        <div className="space-y-2">
          <div className="eyebrow-chip">operator</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            clawhub
          </h1>
          <p className="text-sm text-muted-foreground">
            {session.user.email}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/operator/firms/new"
            className={buttonVariants() + " h-10 px-4"}
            style={{
              backgroundColor: "var(--brand)",
              color: "var(--brand-foreground)",
            }}
          >
            + Nueva firma
          </Link>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      {/* Stats agregadas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card-paper p-4 space-y-1">
          <div className="eyebrow text-[10px]">Firmas</div>
          <div className="text-2xl font-semibold tabular-nums">
            {firms.length}
          </div>
        </div>
        <div className="card-paper p-4 space-y-1">
          <div className="eyebrow text-[10px]">Instancias</div>
          <div className="text-2xl font-semibold tabular-nums">
            {totalInstances}
          </div>
        </div>
        <div className="card-paper p-4 space-y-1">
          <div className="eyebrow text-[10px]">Seats compradas</div>
          <div className="text-2xl font-semibold tabular-nums">
            {totalSeats}
          </div>
        </div>
        <div className="card-paper p-4 space-y-1">
          <div className="eyebrow text-[10px]">Ocupación</div>
          <div className="text-2xl font-semibold tabular-nums">
            {totalSeats > 0
              ? Math.round((totalInstances / totalSeats) * 100)
              : 0}
            <span className="text-base text-muted-foreground">%</span>
          </div>
        </div>
      </div>

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">Firmas</CardTitle>
          <CardDescription>
            {firms.length} {firms.length === 1 ? "tenant" : "tenants"} en
            clawhub.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-4 pb-4">
          {firms.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-8 text-center">
              No hay firmas todavía. Pulsa{" "}
              <strong>+ Nueva firma</strong> arriba para crear la primera.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="eyebrow text-[10px]">Firma</TableHead>
                    <TableHead className="eyebrow text-[10px]">Plan</TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      Seats
                    </TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      Instancias
                    </TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      Usuarios
                    </TableHead>
                    <TableHead className="eyebrow text-[10px]">
                      Creada
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {firms.map((f) => (
                    <TableRow key={f.id} className="hover:bg-paper-2/60">
                      <TableCell className="font-medium">
                        <Link
                          href={`/operator/firms/${f.id}`}
                          className="hover:text-brand transition-colors"
                        >
                          {f.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{f.plan}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f.seatsPurchased}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f._count.instances}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f._count.users}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {f.createdAt.toLocaleDateString("es-ES")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
