import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateInstance } from "@/lib/instance-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const instance = await authenticateInstance(req);
  if (!instance) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const skill = await db.skill.findUnique({
    where: { firmId_slug: { firmId: instance.firmId, slug } },
  });
  if (!skill || !skill.active) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    slug: skill.slug,
    title: skill.title,
    description: skill.description,
    content: skill.content,
    version: skill.version,
    updated_at: skill.updatedAt.toISOString(),
    published_at: skill.publishedAt?.toISOString() ?? null,
  });
}
