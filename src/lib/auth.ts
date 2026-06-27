import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: "OPERATOR" | "FIRM_ADMIN";
      firmId?: string | null;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  providers: [
    // Dev mode: Nodemailer transport is configured but never used.
    // sendVerificationRequest is overridden to log the magic link to stdout.
    // Swap this for a real email provider (Resend, SES, SMTP) when going to prod.
    Nodemailer({
      server: {
        host: "localhost",
        port: 1025,
        auth: { user: "", pass: "" },
      },
      from: "dev@clawhub.local",
      async sendVerificationRequest({ identifier, url }) {
        const banner = "═".repeat(72);
        // eslint-disable-next-line no-console
        console.log(
          `\n${banner}\n` +
            `🔐  AI-Office Center · magic link\n` +
            `    para: ${identifier}\n` +
            `    abre: ${url}\n` +
            `${banner}\n`,
        );
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
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
