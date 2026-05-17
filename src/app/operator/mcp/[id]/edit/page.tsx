/**
 * /operator/mcp/[id]/edit — editar una entry existente del catálogo.
 *
 * El slug es immutable (rompería las instalaciones que ya apuntan a él).
 * Todo lo demás es editable.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";
import { recordActivity } from "@/lib/activity";
import { Prisma } from "@/generated/prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const CATEGORIES = ["fs", "vcs", "messaging", "db", "search", "browser", "ai", "other"];
const TRANSPORTS = ["stdio", "http", "sse", "streamable-http"];

export default async function EditCatalogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOperator();
  const { id } = await params;
  const entry = await db.mcpServerCatalog.findUnique({ where: { id } });
  if (!entry) notFound();

  const launchArgs = Array.isArray(entry.launchArgs)
    ? (entry.launchArgs as string[]).join(", ")
    : "";
  const requiredEnvVars = Array.isArray(entry.requiredEnvVars)
    ? (entry.requiredEnvVars as string[]).join(", ")
    : "";
  const configurableArgs = entry.configurableArgs
    ? JSON.stringify(entry.configurableArgs, null, 2)
    : "";

  async function updateEntryAction(formData: FormData) {
    "use server";
    const sess = await requireOperator();
    const displayName = String(formData.get("displayName") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const category = String(formData.get("category") ?? "other");
    const transport = String(formData.get("transport") ?? "stdio");
    const launchCommand = String(formData.get("launchCommand") ?? "").trim() || null;
    const launchArgsRaw = String(formData.get("launchArgs") ?? "").trim();
    const npmPackage = String(formData.get("npmPackage") ?? "").trim() || null;
    const requiredEnvVarsRaw = String(formData.get("requiredEnvVars") ?? "").trim();
    const configurableArgsRaw = String(formData.get("configurableArgs") ?? "").trim();
    const docsUrl = String(formData.get("docsUrl") ?? "").trim() || null;
    const iconEmoji = String(formData.get("iconEmoji") ?? "").trim() || null;
    const isOfficial = formData.get("isOfficial") === "on";

    if (!displayName) throw new Error("displayName_required");
    if (!description) throw new Error("description_required");
    if (!CATEGORIES.includes(category)) throw new Error("category_invalid");
    if (!TRANSPORTS.includes(transport)) throw new Error("transport_invalid");

    let parsedLaunchArgs: string[] | null = null;
    if (launchArgsRaw) {
      try {
        const parsed = launchArgsRaw.startsWith("[")
          ? JSON.parse(launchArgsRaw)
          : launchArgsRaw.split(",").map((s) => s.trim()).filter(Boolean);
        if (Array.isArray(parsed)) parsedLaunchArgs = parsed.map(String);
      } catch {
        throw new Error("launchArgs_invalid_json");
      }
    }
    let parsedEnvVars: string[] | null = null;
    if (requiredEnvVarsRaw) {
      parsedEnvVars = requiredEnvVarsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    }
    let parsedConfigArgs: unknown = null;
    if (configurableArgsRaw) {
      try {
        parsedConfigArgs = JSON.parse(configurableArgsRaw);
        if (!Array.isArray(parsedConfigArgs)) {
          throw new Error("configurableArgs_must_be_array");
        }
      } catch (err) {
        throw new Error(`configurableArgs_invalid_json: ${(err as Error).message}`);
      }
    }

    await db.mcpServerCatalog.update({
      where: { id },
      data: {
        displayName,
        description,
        category,
        transport,
        launchCommand,
        launchArgs: parsedLaunchArgs
          ? (parsedLaunchArgs as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        npmPackage,
        requiredEnvVars: parsedEnvVars
          ? (parsedEnvVars as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        configurableArgs: parsedConfigArgs
          ? (parsedConfigArgs as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        docsUrl,
        iconEmoji,
        isOfficial,
      },
    });

    await recordActivity({
      kind: "mcp.catalog_update",
      summary: `Editó entry MCP "${displayName}" (${entry!.slug})`,
      actor: sess,
      metadata: { slug: entry!.slug, displayName },
    });

    revalidatePath("/operator/mcp");
    redirect(`/operator/mcp?updated=${entry!.slug}`);
  }

  return (
    <main className="container-page min-h-screen py-8 sm:py-12 space-y-8">
      <header className="space-y-2">
        <Link href="/operator/mcp" className="text-sm underline text-muted-foreground">
          ← Catálogo MCP
        </Link>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight flex items-center gap-2">
          <span className="text-3xl">{entry.iconEmoji ?? "🔌"}</span>
          {entry.displayName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Slug: <code>{entry.slug}</code> (immutable) ·{" "}
          {entry.deprecatedAt ? "deprecado" : "activo"}
        </p>
      </header>

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">Editar</CardTitle>
          <CardDescription>
            Los cambios se reflejarán inmediatamente en el catálogo público
            de las firmas. Las instalaciones existentes mantienen los
            valores que ya tenían — solo se ven afectadas en la próxima
            sincronización push_mcp_config.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form action={updateEntryAction} className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="eyebrow text-[10px] block">Nombre visible</label>
              <input
                name="displayName"
                required
                defaultValue={entry.displayName}
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="eyebrow text-[10px] block">iconEmoji</label>
              <input
                name="iconEmoji"
                defaultValue={entry.iconEmoji ?? ""}
                maxLength={4}
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="eyebrow text-[10px] block">Descripción</label>
              <input
                name="description"
                required
                defaultValue={entry.description}
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="eyebrow text-[10px] block">Categoría</label>
              <select
                name="category"
                defaultValue={entry.category}
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="eyebrow text-[10px] block">Transport</label>
              <select
                name="transport"
                defaultValue={entry.transport}
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded"
              >
                {TRANSPORTS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="eyebrow text-[10px] block">launchCommand</label>
              <input
                name="launchCommand"
                defaultValue={entry.launchCommand ?? ""}
                placeholder="npx | uvx | https://..."
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="eyebrow text-[10px] block">launchArgs</label>
              <input
                name="launchArgs"
                defaultValue={launchArgs}
                placeholder="-y, @org/package"
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="eyebrow text-[10px] block">npmPackage</label>
              <input
                name="npmPackage"
                defaultValue={entry.npmPackage ?? ""}
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="eyebrow text-[10px] block">requiredEnvVars</label>
              <input
                name="requiredEnvVars"
                defaultValue={requiredEnvVars}
                placeholder="TOKEN_A, TOKEN_B"
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="eyebrow text-[10px] block">docsUrl</label>
              <input
                name="docsUrl"
                type="url"
                defaultValue={entry.docsUrl ?? ""}
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label className="eyebrow text-[10px] block">
                configurableArgs (JSON array)
              </label>
              <textarea
                name="configurableArgs"
                rows={6}
                defaultValue={configurableArgs}
                placeholder='[{"key":"rootPath","label":"Ruta raíz","type":"string","required":true}]'
                className="card-quiet w-full px-3 py-2 text-xs font-mono bg-transparent border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-[10px] text-muted-foreground">
                Array de objetos {`{ key, label, type, defaultValue?, required?, helpText? }`}.
                Vacío = sin args configurables.
              </p>
            </div>
            <label className="flex items-center gap-2 sm:col-span-2 text-sm">
              <input
                type="checkbox"
                name="isOfficial"
                defaultChecked={entry.isOfficial}
              />
              isOfficial (mantenido por modelcontextprotocol.io u oficial upstream)
            </label>
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" size="sm">
                Guardar
              </Button>
              <Link
                href="/operator/mcp"
                className="text-sm underline text-muted-foreground self-center"
              >
                cancelar
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
