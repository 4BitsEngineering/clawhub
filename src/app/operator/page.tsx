// TODO: re-añadir imports de auth (redirect, auth, SignOutButton) cuando reactivemos login.
import { db } from "@/lib/db";
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

export default async function OperatorPage() {
  // TODO: re-enable auth check cuando podamos probar login.
  // const session = await auth();
  // if (!session?.user) redirect("/login");
  // if (session.user.role !== "OPERATOR") redirect("/firm");

  const firms = await db.firm.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { instances: true, users: true },
      },
    },
  });

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            clawhub · operator
          </h1>
          <p className="text-sm text-muted-foreground">
            Vista dev sin login · TODO restaurar auth check
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Firmas</CardTitle>
          <CardDescription>
            {firms.length} {firms.length === 1 ? "firma" : "firmas"} registradas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {firms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay firmas todavía. Crea una con el botón "Crear firma" (TODO).
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
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{f.plan}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
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
