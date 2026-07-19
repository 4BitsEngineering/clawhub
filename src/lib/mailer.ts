import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ id?: string; error?: string }> {
  if (!resend) {
    // Dev mode: log to console instead of sending
    console.log(
      `\n${"─".repeat(60)}\n📧 MAILER (dev) → ${to}\n   Asunto: ${subject}\n${"─".repeat(60)}\n`,
    );
    return { id: "dev-noop" };
  }
  const from =
    process.env.RESEND_FROM ?? "AI-Office <noreply@aioffice.es>";
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
  });
  if (error) return { error: error.message };
  return { id: data?.id };
}
