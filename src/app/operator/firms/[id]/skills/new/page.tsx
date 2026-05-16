import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slugify";
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

export default async function NewSkillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const firm = await db.firm.findUnique({ where: { id } });
  if (!firm) notFound();

  async function createSkillAction(formData: FormData) {
    "use server";
    const title = ((formData.get("title") as string) ?? "").trim();
    const slugInput = ((formData.get("slug") as string) ?? "").trim();
    const description =
      ((formData.get("description") as string) ?? "").trim() || null;
    const content = ((formData.get("content") as string) ?? "").trim();
    const active = formData.get("active") === "on";

    if (!title || !content) return;

    const slug = slugify(slugInput || title);
    if (!slug) return;

    const skill = await db.skill.create({
      data: {
        firmId: id,
        title,
        slug,
        description,
        content,
        active,
        version: 1,
        publishedAt: active ? new Date() : null,
      },
    });

    revalidatePath(`/operator/firms/${id}/skills`);
    redirect(`/operator/firms/${id}/skills/${skill.id}/edit`);
  }

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto space-y-6">
      <div className="text-sm">
        <Link
          href={`/operator/firms/${firm.id}/skills`}
          className="text-muted-foreground hover:text-foreground"
        >
          ← Skills · {firm.name}
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo skill</h1>
        <p className="text-sm text-muted-foreground">
          SOP, plantilla o procedimiento que se distribuirá a todas las
          instancias de {firm.name}.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Contenido</CardTitle>
          <CardDescription>
            Las instancias detectarán el nuevo skill en el próximo heartbeat
            y lo descargarán automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createSkillAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                name="title"
                required
                maxLength={200}
                placeholder='ej. "Tono de comunicación con clientes"'
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">
                Slug{" "}
                <span className="text-xs text-muted-foreground">
                  (opcional, se genera del título si lo dejas vacío)
                </span>
              </Label>
              <Input
                id="slug"
                name="slug"
                maxLength={80}
                placeholder="tono-comunicacion"
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Descripción{" "}
                <span className="text-xs text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="description"
                name="description"
                maxLength={300}
                placeholder="Resumen de 1-2 líneas"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Contenido (markdown)</Label>
              <textarea
                id="content"
                name="content"
                required
                rows={14}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                placeholder={"# Tono de comunicación\n\nCuando escribes al cliente:\n- Tutea siempre…"}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                name="active"
                defaultChecked
                className="h-4 w-4"
              />
              <Label htmlFor="active" className="cursor-pointer">
                Publicar activo
              </Label>
              <span className="text-xs text-muted-foreground ml-2">
                (las instancias lo descargarán)
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit">Crear skill</Button>
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
    </main>
  );
}
