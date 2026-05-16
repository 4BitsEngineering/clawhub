import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function EditSkillPage({
  params,
}: {
  params: Promise<{ id: string; skillId: string }>;
}) {
  await requireOperator();
  const { id, skillId } = await params;

  const firm = await db.firm.findUnique({ where: { id } });
  if (!firm) notFound();

  const skill = await db.skill.findUnique({ where: { id: skillId } });
  if (!skill || skill.firmId !== id) notFound();

  async function updateSkillAction(formData: FormData) {
    "use server";
    const title = ((formData.get("title") as string) ?? "").trim();
    const description =
      ((formData.get("description") as string) ?? "").trim() || null;
    const content = ((formData.get("content") as string) ?? "").trim();
    const active = formData.get("active") === "on";

    if (!title || !content) return;

    await db.skill.update({
      where: { id: skillId },
      data: {
        title,
        description,
        content,
        active,
        version: { increment: 1 },
        publishedAt: active ? new Date() : null,
      },
    });

    revalidatePath(`/operator/firms/${id}/skills`);
    redirect(`/operator/firms/${id}/skills`);
  }

  async function deleteSkillAction() {
    "use server";
    await db.skill.delete({ where: { id: skillId } });
    revalidatePath(`/operator/firms/${id}/skills`);
    redirect(`/operator/firms/${id}/skills`);
  }

  return (
    <main className="container-page min-h-screen py-8 sm:py-12 max-w-3xl space-y-8">
      <div className="text-sm">
        <Link
          href={`/operator/firms/${firm.id}/skills`}
          className="text-muted-foreground hover:text-foreground"
        >
          ← Skills · {firm.name}
        </Link>
      </div>

      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="eyebrow-chip">editar skill</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            {skill.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            slug <code className="font-mono">{skill.slug}</code> · creado{" "}
            {skill.createdAt.toLocaleDateString("es-ES")}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge variant="secondary">v{skill.version}</Badge>
          <Badge variant={skill.active ? "default" : "secondary"}>
            {skill.active ? "activo" : "inactivo"}
          </Badge>
        </div>
      </header>

      <Card className="card-paper border-0 shadow-none">
        <CardHeader>
          <CardTitle className="font-display text-xl">Contenido</CardTitle>
          <CardDescription>
            Guardar incrementa la versión a v{skill.version + 1} y notifica a
            las instancias en el próximo heartbeat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateSkillAction} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title" className="eyebrow text-[10px]">
                Título
              </Label>
              <Input
                id="title"
                name="title"
                required
                maxLength={200}
                defaultValue={skill.title}
              />
            </div>

            <div className="space-y-2">
              <Label className="eyebrow text-[10px]">
                Slug{" "}
                <span className="normal-case text-[11px] text-muted-foreground tracking-normal">
                  (inmutable)
                </span>
              </Label>
              <Input
                value={skill.slug}
                disabled
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="eyebrow text-[10px]">
                Descripción{" "}
                <span className="normal-case text-[11px] text-muted-foreground tracking-normal">
                  (opcional)
                </span>
              </Label>
              <Input
                id="description"
                name="description"
                maxLength={300}
                defaultValue={skill.description ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content" className="eyebrow text-[10px]">
                Contenido (markdown)
              </Label>
              <textarea
                id="content"
                name="content"
                required
                rows={16}
                defaultValue={skill.content}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                name="active"
                defaultChecked={skill.active}
                className="h-4 w-4"
              />
              <Label htmlFor="active" className="cursor-pointer">
                Publicado activo
              </Label>
            </div>

            <div className="flex gap-2 pt-3">
              <Button
                type="submit"
                style={{
                  backgroundColor: "var(--brand)",
                  color: "var(--brand-foreground)",
                }}
              >
                Guardar (v{skill.version + 1})
              </Button>
              <Link
                href={`/operator/firms/${firm.id}/skills`}
                className="inline-flex items-center px-3 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="card-paper border-0 shadow-none border-destructive/30">
        <CardHeader>
          <div className="eyebrow text-[10px] text-destructive">
            Zona peligrosa
          </div>
          <CardTitle className="font-display text-xl text-destructive">
            Eliminar skill
          </CardTitle>
          <CardDescription>
            Borrar el skill lo retira de todas las instancias en el próximo
            sync. Operación irreversible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteSkillAction}>
            <Button type="submit" variant="destructive" size="sm">
              Borrar permanentemente
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
