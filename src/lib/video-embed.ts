/** Convierte una URL pública de YouTube o Vimeo a su URL de embed. */
export function toEmbedUrl(raw: string): string {
  if (!raw) return "";

  // youtube.com/watch?v=ID  o  youtube.com/watch?...&v=ID
  const ytWatch = raw.match(/youtube\.com\/watch\?(?:[^&]*&)*v=([A-Za-z0-9_-]+)/);
  if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}?rel=0`;

  // youtu.be/ID
  const ytShort = raw.match(/youtu\.be\/([A-Za-z0-9_-]+)/);
  if (ytShort) return `https://www.youtube.com/embed/${ytShort[1]}?rel=0`;

  // vimeo.com/ID
  const vimeo = raw.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;

  // Ya es embed o URL desconocida — devolver tal cual
  return raw;
}
