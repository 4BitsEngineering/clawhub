// Oculto para el cliente (FIRM_ADMIN) — change firm-client-portal.
// La gestión operativa vive en el panel del operador (/operator/firms/[id]).
import { redirect } from "next/navigation";

export default function HiddenForFirmAdmin() {
  redirect("/firm");
}
