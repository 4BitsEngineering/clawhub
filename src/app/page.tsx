import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Fase de validación: la raíz NO muestra landing de marketing — va directa al
// panel (según rol) o al login. La landing se restaurará cuando lancemos
// (queda en el historial git, commit anterior a este).
export default async function HomePage() {
  const session = await getSession();
  if (session?.user?.role === "OPERATOR") redirect("/operator");
  if (session?.user?.role === "FIRM_ADMIN") redirect("/firm");
  redirect("/login");
}
