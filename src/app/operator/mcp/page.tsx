/**
 * /operator/mcp — gestión del catálogo global de MCP servers + vista de
 * instalaciones por firma.
 *
 * El operator añade/edita/deprecia entries del catálogo. La edición pesada
 * (crear nuevos servers custom) se hace via seed script; esta UI cubre
 * deprecate/restore y visibilidad rápida.
 */
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";
import { recordActivity } from "@/lib/activity";
import { OperatorShell } from "@/components/operator-shell";
import { Prisma } from "@/generated/prisma/client";
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
import { Button } from "@/components/ui/button";

const CATEGORIES = ["fs", "vcs", "messaging", "db", "search", "browser", "ai", "other"];
const TRANSPORTS = ["stdio", "http", "sse", "streamable-http"];

export const dynamic = "force-dynamic";

export default async function OperatorMcpPage({
  searchParams,
}: {
  searchParams?: Promise<{ created?: string; updated?: string }>;
}) {
  const session = await requireOperator();
  const sp = searchParams ? await searchParams : {};

  const [catalog, installs] = await Promise.all([
    db.mcpServerCatalog.findMany({
      orderBy: [{ deprecatedAt: "asc" }, { category: "asc" }, { displayName: "asc" }],
      include: { _count: { select: { installs: true } } },
    }),
    db.firmMcpInstall.findMany({
      include: {
        catalog: { select: { slug: true, displayName: true } },
        firm: { select: { name: true, id: true } },
      },
      orderBy: { installedAt: "desc" },
      take: 100,
    }),
  ]);

  async function createCatalogEntryAction(formData: FormData) {
    "use server";
    const sess = await requireOperator();
    const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
    const displayName = String(formData.get("displayName") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const category = String(formData.get("category") ?? "other");
    const transport = String(formData.get("transport") ?? "stdio");
    const launchCommand = String(formData.get("launchCommand") ?? "").trim() || null;
    const launchArgsRaw = String(formData.get("launchArgs") ?? "").trim();
    const npmPackage = String(formData.get("npmPackage") ?? "").trim() || null;
    const requiredEnvVarsRaw = String(formData.get("requiredEnvVars") ?? "").trim();
    const docsUrl = String(formData.get("docsUrl") ?? "").trim() || null;
    const iconEmoji = String(formData.get("iconEmoji") ?? "").trim() || null;

    if (!slug || !/^[a-z0-9-]{2,40}$/.test(slug)) {
      throw new Error("slug_invalid (use lowercase, digits, hyphens — 2-40 chars)");
    }
    if (!displayName) throw new Error("displayName_required");
    if (!description) throw new Error("description_required");
    if (!CATEGORIES.includes(category)) throw new Error("category_invalid");
    if (!TRANSPORTS.includes(transport)) throw new Error("transport_invalid");

    // launchArgs / requiredEnvVars como listas comma-separated o JSON array.
    let launchArgs: string[] | null = null;
    if (launchArgsRaw) {
      try {
        const parsed = launchArgsRaw.startsWith("[")
          ? JSON.parse(launchArgsRaw)
          : launchArgsRaw.split(",").map((s) => s.trim()).filter(Boolean);
        if (Array.isArray(parsed)) launchArgs = parsed.map(String);
      } catch {
        throw new Error("launchArgs_invalid_json");
      }
    }
    let requiredEnvVars: string[] | null = null;
    if (requiredEnvVarsRaw) {
      requiredEnvVars = requiredEnvVarsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    try {
      const created = await db.mcpServerCatalog.create({
        data: {
          slug,
          displayName,
          description,
          category,
          transport,
          launchCommand,
          launchArgs: launchArgs ? (launchArgs as Prisma.InputJsonValue) : Prisma.JsonNull,
          npmPackage,
          requiredEnvVars: requiredEnvVars ? (requiredEnvVars as Prisma.InputJsonValue) : Prisma.JsonNull,
          docsUrl,
          iconEmoji,
          isOfficial: false, // se sube manualmente; oficial solo via seed
        },
      });
      await recordActivity({
        kind: "mcp.catalog_create",
        summary: `Creó entry MCP "${displayName}" (${slug}) en catálogo`,
        actor: sess,
        metadata: {
          slug,
          category,
          transport,
          launchCommand,
        },
      });
      revalidatePath("/operator/mcp");
      redirect(`/operator/mcp?created=${slug}`);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("Unique constraint")) {
        throw new Error(`slug_taken: ya existe un entry con slug "${slug}"`);
      }
      throw err;
    }
  }

  async function deprecateAction(formData: FormData) {
    "use server";
    const sess = await requireOperator();
    const id = String(formData.get("id") ?? "");
    const entry = await db.mcpServerCatalog.findUnique({ where: { id } });
    if (!entry) throw new Error("not_found");
    await db.mcpServerCatalog.update({
      where: { id },
      data: { deprecatedAt: entry.deprecatedAt ? null : new Date() },
    });
    await recordActivity({
      kind: entry.deprecatedAt ? "mcp.catalog_restore" : "mcp.catalog_deprecate",
      summary: `${entry.deprecatedAt ? "Restauró" : "Deprecó"} catálogo MCP "${entry.displayName}"`,
      actor: sess,
      metadata: { slug: entry.slug },
    });
    revalidatePath("/operator/mcp");
  }

  // Active (non-deprecated) primero
  const active = catalog.filter((c) => !c.deprecatedAt);
  const deprecated = catalog.filter((c) => c.deprecatedAt);

  return (
    <OperatorShell email={session.user.email}>
      <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
          Catálogo MCP
        </h1>
        <p className="text-sm text-muted-foreground">
          {active.length} activos · {deprecated.length} deprecados · {installs.length}{" "}
          instalaciones registradas (top 100).
        </p>
      </header>

      {sp.created && (
        <div className="card-quiet p-3 border-l-4 border-green-500 text-sm">
          ✅ Entry <code>{sp.created}</code> añadida al catálogo. Las firmas
          ya pueden instalarla desde su <code>/firm/mcp</code>.
        </div>
      )}

      {sp.updated && (
        <div className="card-quiet p-3 border-l-4 border-green-500 text-sm">
          ✅ Entry <code>{sp.updated}</code> actualizada.
        </div>
      )}

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">Añadir entry al catálogo</CardTitle>
          <CardDescription>
            Custom MCP server. Si es uno oficial de modelcontextprotocol.io
            recomendado para todas las firmas, mejor añádelo via{" "}
            <code>scripts/seed-mcp-catalog.ts</code> (marca isOfficial=true).
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form action={createCatalogEntryAction} className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="cat-slug" className="eyebrow text-[10px] block">
                Slug *
              </label>
              <input
                id="cat-slug"
                name="slug"
                required
                placeholder="my-custom-mcp"
                pattern="[a-z0-9-]{2,40}"
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-[10px] text-muted-foreground">lowercase, números, guiones (2-40)</p>
            </div>
            <div className="space-y-1">
              <label htmlFor="cat-displayName" className="eyebrow text-[10px] block">
                Nombre visible *
              </label>
              <input
                id="cat-displayName"
                name="displayName"
                required
                placeholder="My Custom MCP"
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="cat-description" className="eyebrow text-[10px] block">
                Descripción *
              </label>
              <input
                id="cat-description"
                name="description"
                required
                placeholder="Qué hace este MCP server, en una línea"
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="cat-category" className="eyebrow text-[10px] block">
                Categoría
              </label>
              <select
                id="cat-category"
                name="category"
                defaultValue="other"
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="cat-transport" className="eyebrow text-[10px] block">
                Transport
              </label>
              <select
                id="cat-transport"
                name="transport"
                defaultValue="stdio"
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded"
              >
                {TRANSPORTS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="cat-launchCommand" className="eyebrow text-[10px] block">
                launchCommand
              </label>
              <input
                id="cat-launchCommand"
                name="launchCommand"
                placeholder="npx | uvx | https://my-mcp.com (para http)"
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-[10px] text-muted-foreground">stdio: comando a ejecutar. http/sse: URL</p>
            </div>
            <div className="space-y-1">
              <label htmlFor="cat-launchArgs" className="eyebrow text-[10px] block">
                launchArgs
              </label>
              <input
                id="cat-launchArgs"
                name="launchArgs"
                placeholder='-y, @my-org/mcp-server   ó   ["-y","@my-org/mcp-server"]'
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-[10px] text-muted-foreground">comma-separated o JSON array</p>
            </div>
            <div className="space-y-1">
              <label htmlFor="cat-npmPackage" className="eyebrow text-[10px] block">
                npmPackage (opcional)
              </label>
              <input
                id="cat-npmPackage"
                name="npmPackage"
                placeholder="@my-org/mcp-server"
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="cat-requiredEnvVars" className="eyebrow text-[10px] block">
                requiredEnvVars
              </label>
              <input
                id="cat-requiredEnvVars"
                name="requiredEnvVars"
                placeholder="API_KEY, ANOTHER_TOKEN"
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-[10px] text-muted-foreground">comma-separated</p>
            </div>
            <div className="space-y-1">
              <label htmlFor="cat-docsUrl" className="eyebrow text-[10px] block">
                docsUrl
              </label>
              <input
                id="cat-docsUrl"
                name="docsUrl"
                type="url"
                placeholder="https://github.com/my-org/mcp-server"
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="cat-iconEmoji" className="eyebrow text-[10px] block">
                iconEmoji
              </label>
              <input
                id="cat-iconEmoji"
                name="iconEmoji"
                maxLength={4}
                placeholder="🔌"
                className="card-quiet w-full px-3 h-9 text-sm bg-transparent border rounded focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="sm:col-span-2 pt-1">
              <Button type="submit" size="sm">
                + Crear entry
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="card-paper border-0 shadow-none p-0">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="font-display text-xl">Catálogo activo</CardTitle>
          <CardDescription>
            Para añadir nuevos servers OFICIALES (mantenidos por upstream), edita{" "}
            <code>scripts/seed-mcp-catalog.ts</code> y vuelve a correr el seed.
            Deprecar oculta el entry del catálogo público pero NO desinstala
            de las firmas que ya lo tienen.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="eyebrow text-[10px]">Server</TableHead>
                <TableHead className="eyebrow text-[10px]">Slug</TableHead>
                <TableHead className="eyebrow text-[10px]">Categoría</TableHead>
                <TableHead className="eyebrow text-[10px]">Transport</TableHead>
                <TableHead className="eyebrow text-[10px] text-right">
                  Instalaciones
                </TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((c) => (
                <TableRow key={c.id} className="hover:bg-paper-2/60">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{c.iconEmoji ?? "🔌"}</span>
                      <strong className="text-sm">{c.displayName}</strong>
                      {c.isOfficial && (
                        <Badge variant="secondary" className="text-[10px]">
                          oficial
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs">{c.slug}</code>
                  </TableCell>
                  <TableCell className="text-sm">{c.category}</TableCell>
                  <TableCell className="text-sm">{c.transport}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {c._count.installs}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/operator/mcp/${c.id}/edit`}
                        className="text-xs underline text-muted-foreground hover:text-foreground"
                      >
                        editar
                      </Link>
                      <form action={deprecateAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          className="text-xs underline text-muted-foreground hover:text-destructive"
                        >
                          deprecar
                        </button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {deprecated.length > 0 && (
        <Card className="card-paper border-0 shadow-none p-0 opacity-60">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="font-display text-xl">Deprecados</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-4 pb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="eyebrow text-[10px]">Server</TableHead>
                  <TableHead className="eyebrow text-[10px]">Deprecado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deprecated.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.displayName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.deprecatedAt!.toLocaleDateString("es-ES")}
                    </TableCell>
                    <TableCell>
                      <form action={deprecateAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          className="text-xs underline text-muted-foreground"
                        >
                          restaurar
                        </button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {installs.length > 0 && (
        <Card className="card-paper border-0 shadow-none p-0">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="font-display text-xl">
              Instalaciones recientes
            </CardTitle>
            <CardDescription>
              Quién tiene qué activo. Top 100 más recientes.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-4 pb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="eyebrow text-[10px]">Firma</TableHead>
                  <TableHead className="eyebrow text-[10px]">MCP</TableHead>
                  <TableHead className="eyebrow text-[10px]">Estado</TableHead>
                  <TableHead className="eyebrow text-[10px]">Instalado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installs.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-sm">
                      <Link
                        href={`/operator/firms/${i.firm.id}`}
                        className="hover:text-brand"
                      >
                        {i.firm.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {i.catalog.displayName}{" "}
                      <code className="text-[10px] text-muted-foreground">
                        {i.catalog.slug}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={i.enabled ? "default" : "secondary"} className="text-[10px]">
                        {i.enabled ? "activo" : "inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {i.installedAt.toLocaleDateString("es-ES")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      </div>
    </OperatorShell>
  );
}
