import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";
import { AutoRefresh } from "@/components/auto-refresh";
import { OperatorShell } from "@/components/operator-shell";
import { FirmSubnav } from "@/components/firm-subnav";
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
  const session = await requireOperator();
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
    <OperatorShell email={session.user.email} flush>
      <AutoRefresh intervalMs={15_000} />
      <FirmSubnav firmId={firm.id} firmName={firm.name} />
      <div className="container-page py-8 space-y-8">

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">
            Skills publicados
          </CardTitle>
          <CardDescription>
            <span className="tabular-nums">{firm.skills.length}</span> total ·{" "}
            <span className="tabular-nums">{activeCount}</span> activos
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-4 pb-4">
          {firm.skills.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-8 text-center">
              Sin skills todavía. Pulsa <strong>+ Nuevo skill</strong> para
              crear el primer SOP o plantilla.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="eyebrow text-[10px]">
                      Título
                    </TableHead>
                    <TableHead className="eyebrow text-[10px]">Slug</TableHead>
                    <TableHead className="eyebrow text-[10px]">
                      Estado
                    </TableHead>
                    <TableHead className="eyebrow text-[10px] text-right">
                      Versión
                    </TableHead>
                    <TableHead className="eyebrow text-[10px]">
                      Publicado
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {firm.skills.map((s) => (
                    <TableRow key={s.id} className="hover:bg-paper-2/60">
                      <TableCell className="font-medium">
                        <Link
                          href={`/operator/firms/${firm.id}/skills/${s.id}/edit`}
                          className="hover:text-brand transition-colors"
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
                      <TableCell className="text-right tabular-nums text-sm">
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
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </OperatorShell>
  );
}
