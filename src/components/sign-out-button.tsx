import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { DEV_COOKIE } from "@/lib/session";
import { Button } from "@/components/ui/button";

async function signOutAction() {
  "use server";
  const c = await cookies();
  c.delete(DEV_COOKIE);
  // Si hay sesión Auth.js también, la cerramos. Si solo había dev cookie,
  // signOut() es no-op pero no falla.
  try {
    await signOut({ redirect: false });
  } catch {
    // sin sesión auth.js — ignorar
  }
  redirect("/login");
}

export function SignOutButton() {
  // Vive siempre en headers navy AI-Office → texto crema fijo
  return (
    <form action={signOutAction}>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="hover:bg-white/10"
        style={{ color: "rgba(245,239,228,0.85)" }}
      >
        Salir
      </Button>
    </form>
  );
}
