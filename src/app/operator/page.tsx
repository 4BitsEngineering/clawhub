// TODO: re-añadir imports de auth (redirect, auth, SignOutButton) cuando reactivemos login.
import Link from "next/link";
import { db } from "@/lib/db";
import { AutoRefresh } from "@/components/auto-refresh";
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
  // TODO: re-enable auth check cuando podamos probar login.
  const firms = await db.firm.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { instances: true, users: true } },
    },
  });

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto space-y-6">
      <AutoRefresh intervalMs={10_000} />

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            clawhub · operator
          </h1>
          <p className="text-sm text-muted-foreground">
            Vista dev sin login · TODO restaurar auth check
          </p>
        </div>
        <Link href="/operator/firms/new" className={buttonVariants()}>
          + Nueva firma
        </Link>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Firmas</CardTitle>
          <CardDescription>
            {firms.length} {firms.length === 1 ? "firma" : "firmas"}{" "}
            registradas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {firms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay firmas todavía. Pulsa{" "}
              <strong>"+ Nueva firma"</strong> arriba para crear la primera.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firma</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Seats</TableHead>
                  <TableHead className="text-right">Instancias</TableHead>
                  <TableHead className="text-right">Usuarios</TableHead>
                  <TableHead>Creada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {firms.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/operator/firms/${f.id}`}
                        className="hover:underline"
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
                    <TableCell className="text-muted-foreground">
                      {f.createdAt.toLocaleDateString("es-ES")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
