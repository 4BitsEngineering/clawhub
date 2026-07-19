import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function OfertaRootPage() {
  const landing = await db.landingPage.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (!landing) notFound();
  redirect(`/oferta/${landing.slug}`);
}
