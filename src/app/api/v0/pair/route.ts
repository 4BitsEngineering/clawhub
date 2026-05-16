import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateInstanceToken } from "@/lib/tokens";

const PairBody = z.object({
  pairing_code: z.string().min(4).max(32),
  worker_label: z.string().min(1).max(120),
  version: z.string().min(1).max(40),
  os: z.string().max(40).optional(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof PairBody>;
  try {
    body = PairBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "bad_request", detail: (err as Error).message },
      { status: 400 },
    );
  }

  const pairingToken = await db.pairingToken.findUnique({
    where: { code: body.pairing_code },
    include: { firm: true },
  });

  if (!pairingToken) {
    return NextResponse.json({ error: "code_not_found" }, { status: 404 });
  }
  if (pairingToken.usedAt) {
    return NextResponse.json({ error: "code_already_used" }, { status: 410 });
  }
  if (pairingToken.expiresAt < new Date()) {
    return NextResponse.json({ error: "code_expired" }, { status: 410 });
  }

  const { plain, hash } = generateInstanceToken();

  // Crear Instance + marcar pairing como usado en una transacción.
  const [instance] = await db.$transaction([
    db.instance.create({
      data: {
        instanceTokenHash: hash,
        firmId: pairingToken.firmId,
        workerLabel: body.worker_label,
        version: body.version,
        os: body.os ?? null,
      },
    }),
    db.pairingToken.update({
      where: { id: pairingToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({
    instance_id: instance.id,
    instance_token: plain,
    firm_id: pairingToken.firm.id,
    firm_name: pairingToken.firm.name,
  });
}
