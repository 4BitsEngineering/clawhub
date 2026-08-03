import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/mailer";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: "OPERATOR" | "FIRM_ADMIN" | "EMPRESA" | "COMERCIAL";
      firmId?: string | null;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  providers: [
    // El transporte SMTP de Nodemailer nunca se usa: sendVerificationRequest
    // está sobrescrito para enviar vía Resend (src/lib/mailer.ts). Se conserva
    // el provider porque su id ("nodemailer") ya está referenciado en signIn().
    Nodemailer({
      server: {
        host: "localhost",
        port: 1025,
        auth: { user: "", pass: "" },
      },
      from: "dev@clawhub.local",
      async sendVerificationRequest({ identifier, url }) {
        if (!process.env.RESEND_API_KEY) {
          // Dev sin Resend: el enlace se loguea en consola y el flujo no falla.
          const banner = "═".repeat(72);
          // eslint-disable-next-line no-console
          console.log(
            `\n${banner}\n` +
              `🔐  AI-Office Center · magic link\n` +
              `    para: ${identifier}\n` +
              `    abre: ${url}\n` +
              `${banner}\n`,
          );
          return;
        }
        const { error } = await sendEmail({
          to: identifier,
          subject: "Tu acceso a AI-Office Center",
          html: `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
  <h1 style="font-size:20px;margin:0 0 8px">Accede a AI-Office Center</h1>
  <p style="color:#555;line-height:1.6">
    Haz clic en el botón para entrar. Este enlace es de un solo uso y caduca
    en 24 horas.
  </p>
  <div style="text-align:center;margin:28px 0">
    <a href="${url}"
       style="display:inline-block;background:#065f46;color:#fff;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:600">
      Entrar →
    </a>
  </div>
  <p style="color:#888;font-size:12px;line-height:1.5">
    Si no has solicitado este acceso, ignora este email — nadie puede entrar
    sin abrir el enlace.
  </p>
</div>`,
        });
        if (error) {
          // Auth.js muestra "error enviando email" al usuario si lanzamos
          throw new Error(`No se pudo enviar el magic link: ${error}`);
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    // Tras solicitar el magic link, Auth.js redirige aquí ("revisa tu email")
    verifyRequest: "/login?sent=1",
  },
  callbacks: {
    // Solo emails ya dados de alta pueden entrar — sin self-signup. Sin este
    // guard, el PrismaAdapter crearía un User (rol por defecto FIRM_ADMIN) a
    // cualquiera que pida un magic link. Se bloquea ya al solicitar el enlace
    // (verificationRequest), así no se envían emails a desconocidos.
    async signIn({ user, email }) {
      if (email?.verificationRequest) {
        if (!user.email) return false;
        const exists = await db.user.findUnique({
          where: { email: user.email },
          select: { id: true },
        });
        return exists !== null;
      }
      return true;
    },
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        // @ts-expect-error — role comes from User table (Prisma type)
        session.user.role = user.role;
        // @ts-expect-error — firmId comes from User table (Prisma type)
        session.user.firmId = user.firmId;
      }
      return session;
    },
  },
});
