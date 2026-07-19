/**
 * Session helper que combina dos paths:
 *
 *   1. Dev login: cookie `dev-user-id` set por un server action en /login.
 *      Activo solo si DEV_AUTH_ENABLED === "true". Sin verificación —
 *      strictly for testing / demos.
 *
 *   2. Auth.js v5 (magic link via Nodemailer/Resend cuando llegue prod).
 *
 * En producción, DEV_AUTH_ENABLED debe estar UNSET — solo Auth.js corre.
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const DEV_COOKIE = "clawhub-dev-user";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: "OPERATOR" | "FIRM_ADMIN" | "EMPRESA" | "COMERCIAL";
  firmId?: string | null;
};

export type Session = { user: SessionUser };

export async function getSession(): Promise<Session | null> {
  if (process.env.DEV_AUTH_ENABLED === "true") {
    const c = await cookies();
    const userId = c.get(DEV_COOKIE)?.value;
    if (userId) {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (user) {
        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            firmId: user.firmId,
          },
        };
      }
    }
  }
  const real = await auth();
  if (!real?.user) return null;
  return real as Session;
}

function homeForRole(role: SessionUser["role"]): string {
  if (role === "OPERATOR") return "/operator";
  if (role === "EMPRESA") return "/empresa";
  if (role === "COMERCIAL") return "/sales";
  return "/firm";
}

export async function requireOperator(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.user.role !== "OPERATOR") redirect(homeForRole(s.user.role));
  return s;
}

export async function requireFirmAdmin(): Promise<
  Session & { user: SessionUser & { firmId: string } }
> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.user.role !== "FIRM_ADMIN") redirect(homeForRole(s.user.role));
  if (!s.user.firmId) redirect("/login");
  return s as Session & { user: SessionUser & { firmId: string } };
}

export async function requireEmpresa(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.user.role !== "EMPRESA" && s.user.role !== "OPERATOR") {
    redirect(homeForRole(s.user.role));
  }
  return s;
}

export async function requireSalesRep(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.user.role !== "COMERCIAL") redirect(homeForRole(s.user.role));
  return s;
}
