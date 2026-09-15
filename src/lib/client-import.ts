// Parser de importación de clientes (change clientes-crm). Lee .xlsx (via
// read-excel-file) y .csv (nativo) a filas, mapea cabeceras de forma laxa
// (sinónimos, sin acentos) y valida. No ejecuta fórmulas.
import readXlsxFile from "read-excel-file/node";
import { Readable } from "node:stream";

export type ParsedRow = {
  name: string;
  email: string;
  phone: string;
  cif: string | null;
  contactName: string | null;
  notes: string | null;
};

export type RowIssue = { row: number; raw: Record<string, string>; reason: string };

export type ParseResult = {
  valid: ParsedRow[];
  invalid: RowIssue[];
  totalRows: number;
};

export const MAX_IMPORT_ROWS = 2000;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

// Sinónimos de cabecera → campo canónico.
const HEADER_MAP: Record<string, keyof ParsedRow> = {};
for (const h of ["nombre", "empresa", "razonsocial", "cliente", "name"]) HEADER_MAP[h] = "name";
for (const h of ["email", "correo", "correoelectronico", "mail", "emailempresa"]) HEADER_MAP[h] = "email";
for (const h of ["telefono", "movil", "phone", "tlf", "tel", "celular"]) HEADER_MAP[h] = "phone";
for (const h of ["cif", "nif", "cifnif", "dni"]) HEADER_MAP[h] = "cif";
for (const h of ["contacto", "persona", "personacontacto", "contactname", "responsable"]) HEADER_MAP[h] = "contactName";
for (const h of ["notas", "observaciones", "nota", "notes"]) HEADER_MAP[h] = "notes";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Convierte una matriz de celdas (primera fila = cabeceras) en ParseResult.
function fromMatrix(matrix: unknown[][]): ParseResult {
  const valid: ParsedRow[] = [];
  const invalid: RowIssue[] = [];
  if (matrix.length === 0) return { valid, invalid, totalRows: 0 };

  const headers = (matrix[0] as unknown[]).map((c) => norm(String(c ?? "")));
  // índice de columna por campo canónico
  const col: Partial<Record<keyof ParsedRow, number>> = {};
  headers.forEach((h, i) => {
    const field = HEADER_MAP[h];
    if (field && col[field] === undefined) col[field] = i;
  });

  const body = matrix.slice(1);
  for (let i = 0; i < body.length; i++) {
    const cells = body[i] as unknown[];
    const get = (f: keyof ParsedRow) => {
      const idx = col[f];
      return idx === undefined ? "" : String(cells[idx] ?? "").trim();
    };
    const raw: Record<string, string> = {
      name: get("name"),
      email: get("email"),
      phone: get("phone"),
    };
    // Fila totalmente vacía → ignorar (no cuenta como error)
    if (!raw.name && !raw.email && !raw.phone && !get("cif")) continue;

    const name = raw.name;
    const email = raw.email.toLowerCase();
    const phone = raw.phone;
    const missing: string[] = [];
    if (!name) missing.push("nombre");
    if (!email) missing.push("email");
    else if (!EMAIL_RE.test(email)) missing.push("email inválido");
    if (!phone) missing.push("teléfono");
    if (missing.length) {
      invalid.push({ row: i + 2, raw, reason: missing.join(", ") });
      continue;
    }
    valid.push({
      name,
      email,
      phone,
      cif: get("cif") || null,
      contactName: get("contactName") || null,
      notes: get("notes") || null,
    });
  }
  return { valid, invalid, totalRows: body.length };
}

// CSV nativo (coma o punto y coma; comillas dobles). Suficiente para exports
// de Excel/Sheets; no pretende cubrir todos los edge cases de RFC 4180.
function parseCsv(text: string): unknown[][] {
  const rows: string[][] = [];
  const delim = (text.split("\n")[0].match(/;/g)?.length ?? 0) >
    (text.split("\n")[0].match(/,/g)?.length ?? 0)
    ? ";"
    : ",";
  for (const line of text.split(/\r?\n/)) {
    if (line === "") continue;
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

export async function parseImportFile(
  file: File,
): Promise<ParseResult> {
  const buf = Buffer.from(await file.arrayBuffer());
  const isCsv =
    file.name.toLowerCase().endsWith(".csv") ||
    file.type === "text/csv";
  let matrix: unknown[][];
  if (isCsv) {
    matrix = parseCsv(buf.toString("utf8"));
  } else {
    // read-excel-file/node acepta un Stream. Devuelve Row[][]; lo tratamos como
    // matriz de celdas desconocidas.
    matrix = (await readXlsxFile(Readable.from(buf))) as unknown as unknown[][];
  }
  if (matrix.length - 1 > MAX_IMPORT_ROWS) {
    matrix = matrix.slice(0, MAX_IMPORT_ROWS + 1);
  }
  return fromMatrix(matrix);
}
