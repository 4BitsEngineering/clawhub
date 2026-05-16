import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateInstance } from "@/lib/instance-auth";

export async function GET(req: NextRequest) {
  const instance = await authenticateInstance(req);
  if (!instance) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const skills = await db.skill.findMany({
    where: { firmId: instance.firmId, active: true },
    select: {
      slug: true,
      title: true,
      description: true,
      version: true,
      updatedAt: true,
      publishedAt: true,
    },
    orderBy: { slug: "asc" },
  });

  return NextResponse.json({
    firm_id: instance.firmId,
    count: skills.length,
    skills: skills.map((s) => ({
      slug: s.slug,
      title: s.title,
      description: s.description,
      version: s.version,
      updated_at: s.updatedAt.toISOString(),
      published_at: s.publishedAt?.toISOString() ?? null,
    })),
  });
}
