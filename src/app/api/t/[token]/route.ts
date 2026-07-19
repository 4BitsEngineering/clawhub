import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  const send = await db.campaignSend.findUnique({
    where: { trackingToken: token },
    include: { campaign: { include: { landing: true } } },
  });

  const destination = send
    ? `${appUrl}/oferta/${send.campaign.landing.slug}?t=${token}`
    : `${appUrl}/oferta`;

  if (send) {
    // Record click (only first time)
    if (!send.clickedAt) {
      await db.campaignSend.update({
        where: { id: send.id },
        data: { clickedAt: new Date() },
      });
    }

    // Record landing visit
    await db.landingVisit.create({
      data: {
        landingId: send.campaign.landingId,
        sendId: send.id,
        trackingToken: token,
      },
    });

    // Advance prospect status
    const prospect = await db.prospect.findUnique({
      where: { id: send.prospectId },
      select: { status: true },
    });
    if (
      prospect &&
      prospect.status !== "PURCHASED" &&
      prospect.status !== "VISITED_LANDING"
    ) {
      await db.prospect.update({
        where: { id: send.prospectId },
        data: { status: "VISITED_LANDING" },
      });
    }
  }

  const res = NextResponse.redirect(destination);
  // Attribution cookie: 30 days, httpOnly (server reads it in Stripe checkout)
  res.cookies.set("clawhub-attribution", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });

  return res;
}
