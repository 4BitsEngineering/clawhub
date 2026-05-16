/**
 * Crea 2-3 skills demo para la firma "Asesoría Demo".
 * Idempotente: upsert por (firmId, slug).
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const DEMO_FIRM_ID = "00000000-0000-0000-0000-000000000001";

const skills = [
  {
    slug: "tono-comunicacion",
    title: "Tono de comunicación con clientes",
    description:
      "Cómo escribimos al cliente: tuteo, claridad, sin jerga fiscal.",
    content: `# Tono de comunicación con clientes

## Reglas básicas

- **Tutea siempre.** Excepto si el cliente nos pide expresamente que le hablemos de usted.
- **Sin jerga fiscal.** Si tenemos que decir "modelo 303", explicamos qué es: "el modelo 303 (IVA trimestral)".
- **Frases cortas.** Máximo 25 palabras por frase. Punto.
- **Asunto del correo claro.** "Pendiente firma" no vale; "Modelo 303 Q1 2026 — pendiente tu firma" sí.

## Fórmulas frecuentes

- Saludo: "Hola [nombre],"
- Cierre amable: "Cualquier cosa me dices. Un saludo,"
- Cierre formal (escritos): "Quedamos a tu disposición. Atentamente,"

## Lo que NO hacemos

- "Cordialmente" → demasiado distante.
- "A continuación adjunto…" → di "adjunto" directamente.
- "Por la presente le comunicamos…" → bloque legal innecesario para 99% de casos.`,
    active: true,
  },
  {
    slug: "procesar-irpf-cliente-nuevo",
    title: "Procesar IRPF de cliente nuevo",
    description: "Pasos para alta y declaración de renta de cliente nuevo.",
    content: `# Procesar IRPF — cliente nuevo

## 1. Pedir documentación

Mandamos al cliente el correo "plantilla-onboarding-irpf" con lista de documentos necesarios:
- DNI
- Datos bancarios IBAN
- Certificados retención (empresa, banco)
- Justificantes deducibles (vivienda, donativos, planes de pensiones)

## 2. Alta en nuestro software

Ir a Clientes → Nuevo → completar ficha con datos recibidos. Asignar gestor responsable.

## 3. Revisar borrador AEAT

Acceder a Renta Web con certificado del cliente y descargar borrador. Revisar:
- Datos personales
- Imputaciones inmobiliarias
- Deducciones automáticas vs las que vimos en su documentación

## 4. Presentar

Una vez revisado y conforme con el cliente, presentar via Renta Web. Archivar acuse en su carpeta.`,
    active: true,
  },
  {
    slug: "plantilla-comunicacion-modelo-303",
    title: "Plantilla recordatorio modelo 303 (IVA trimestral)",
    description: "Email automático que mandamos 7 días antes del vencimiento.",
    content: `# Plantilla: recordatorio modelo 303

**Asunto:** Modelo 303 (IVA Q[X] 2026) — vencimiento [fecha]

Hola {{nombre}},

Te recuerdo que el plazo del modelo 303 (IVA trimestral) vence el **{{fecha_limite}}**.

Para que podamos presentarlo a tiempo necesito que me hagas llegar antes del **{{fecha_limite_documentacion}}**:

- Facturas emitidas del trimestre
- Facturas recibidas (gastos)
- Tickets/justificantes de pequeña cuantía si los hubiera

Si todo está como el trimestre pasado, dímelo y procedo con tus datos habituales.

Un saludo,
{{firma}}`,
    active: false, // empezamos inactivo para probar el toggle
  },
];

async function main() {
  const db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
    }),
  });

  for (const s of skills) {
    const result = await db.skill.upsert({
      where: { firmId_slug: { firmId: DEMO_FIRM_ID, slug: s.slug } },
      update: {
        title: s.title,
        description: s.description,
        content: s.content,
        active: s.active,
        version: { increment: 1 },
        publishedAt: s.active ? new Date() : null,
      },
      create: {
        firmId: DEMO_FIRM_ID,
        slug: s.slug,
        title: s.title,
        description: s.description,
        content: s.content,
        active: s.active,
        version: 1,
        publishedAt: s.active ? new Date() : null,
      },
    });
    console.log(
      `${result.active ? "✓" : "○"} ${result.slug.padEnd(36)} v${result.version}`,
    );
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
