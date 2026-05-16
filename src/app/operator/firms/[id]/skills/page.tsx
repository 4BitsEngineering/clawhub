import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AutoRefresh } from "@/components/auto-refresh";
import { buttonVariants } from "@/components/ui/button";
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

export const dynamic = "force-dynamic";

export default async function FirmSkillsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const firm = await db.firm.findUnique({
    where: { id },
    include: {
      skills: { orderBy: [{ active: "desc" }, { updatedAt: "desc" }] },
    },
  });
  if (!firm) notFound();

  const activeCount = firm.skills.filter((s) => s.active).length;

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto space-y-6">
      <AutoRefresh intervalMs={15_000} />

      <div className="text-sm">
        <Link
          href={`/operator/firms/${firm.id}`}
          className="text-muted-foreground hover:text-foreground"
        >
          ← {firm.name}
        </Link>
      </div>

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Skills · {firm.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            SOPs, plantillas y procedimientos firma-wide. Las instancias los
            descargan automáticamente.
          </p>
        </div>
        <Link
          href={`/operator/firms/${firm.id}/skills/new`}
          className={buttonVariants()}
        >
          + Nuevo skill
        </Link>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Skills publicados</CardTitle>
          <CardDescription>
            {firm.skills.length} total · {activeCount} activos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {firm.skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin skills todavía. Pulsa <strong>"+ Nuevo skill"</strong> para
              crear el primer SOP o plantilla.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Versión</TableHead>
                  <TableHead>Publicado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {firm.skills.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/operator/firms/${firm.id}/skills/${s.id}/edit`}
                        className="hover:underline"
                      >
                        {s.title}
                      </Link>
                      {s.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {s.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {s.slug}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.active ? "default" : "secondary"}>
                        {s.active ? "activo" : "inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      v{s.version}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {s.publishedAt
                        ? s.publishedAt.toLocaleString("es-ES")
                        : "nunca"}
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
