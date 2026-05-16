/**
 * Convierte un título a slug URL-safe.
 *   "Tono de Comunicación" → "tono-de-comunicacion"
 *   "Procesar IRPF (cliente nuevo)" → "procesar-irpf-cliente-nuevo"
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
