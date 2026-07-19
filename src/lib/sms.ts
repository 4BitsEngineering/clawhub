export async function sendSms({
  to,
  body,
}: {
  to: string;
  body: string;
}): Promise<{ sid?: string; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (!sid || !token || !from) {
    console.log(
      `\n${"─".repeat(60)}\n📱 SMS (dev) → ${to}\n${body}\n${"─".repeat(60)}\n`,
    );
    return { sid: "dev-noop" };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    },
  );

  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    return { error: err.message ?? "Twilio error" };
  }
  const data = (await res.json()) as { sid: string };
  return { sid: data.sid };
}
