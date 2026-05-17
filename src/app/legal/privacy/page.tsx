/**
 * /legal/privacy — política de privacidad. Base LOPD-GDD adaptable.
 *
 * Esta plantilla está pensada como punto de partida. Antes de servir en
 * producción, hazla revisar por un abogado especialista en protección de
 * datos para tu jurisdicción y caso de uso concretos.
 */
import Link from "next/link";

export const metadata = {
  title: "Política de Privacidad — clawhub",
};

export default function PrivacyPage() {
  const updatedAt = "2026-05-17";
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "soporte@clawhub.es";
  const operatorOrg = process.env.NEXT_PUBLIC_OPERATOR_ORG || "[NOMBRE DE LA EMPRESA OPERADORA]";

  return (
    <main className="container-page min-h-screen py-12 sm:py-16">
      <article className="prose prose-sm sm:prose max-w-3xl mx-auto space-y-6 text-sm leading-relaxed">
        <Link href="/" className="text-xs underline text-muted-foreground">
          ← Volver a inicio
        </Link>

        <h1 className="font-display text-4xl font-semibold">
          Política de Privacidad
        </h1>
        <p className="text-muted-foreground">
          Última actualización: {updatedAt}
        </p>

        <p>
          Esta política explica cómo <strong>{operatorOrg}</strong> (en
          adelante &ldquo;el Operador&rdquo;) trata los datos personales en{" "}
          <strong>clawhub</strong>, el panel de control de copilotos IA
          ofrecido bajo arquitectura on-prem.
        </p>

        <h2 className="font-display text-2xl font-semibold pt-4">
          1. Arquitectura y separación de datos
        </h2>
        <p>
          clawhub está diseñado de forma que los datos sensibles del
          trabajador (correo, conversaciones con clientes, documentos
          internos, memoria del agente) residan{" "}
          <strong>exclusivamente en el PC del trabajador</strong>. El control
          plane (este servicio web) solo recibe:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Identificadores de instancia (instance_id, token hasheado)</li>
          <li>
            Telemetría operativa: estado online/offline, versión instalada,
            uso de CPU/RAM, tokens consumidos agregados
          </li>
          <li>
            Snapshots de configuración del agente (SOPs, plantillas) — sin
            datos personales de los clientes finales del trabajador
          </li>
          <li>Logs de actividad (quién hizo qué acción en clawhub)</li>
        </ul>

        <h2 className="font-display text-2xl font-semibold pt-4">
          2. Responsable del tratamiento
        </h2>
        <p>
          <strong>{operatorOrg}</strong>. Contacto:{" "}
          <a href={`mailto:${supportEmail}`} className="underline">
            {supportEmail}
          </a>
          .
        </p>

        <h2 className="font-display text-2xl font-semibold pt-4">
          3. Datos personales tratados en el control plane
        </h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Cuentas administrativas</strong>: email, rol (operator o
            firm_admin), firma asociada, fecha de alta.
          </li>
          <li>
            <strong>Identificación de PC</strong>: etiqueta del trabajador
            ({"<workerLabel>"}), versión instalada, sistema operativo,
            timestamps de heartbeat.
          </li>
          <li>
            <strong>Telemetría agregada</strong>: tokens consumidos por
            agente, coste estimado. No incluye contenido de las
            conversaciones.
          </li>
          <li>
            <strong>Audit log</strong>: quién hizo qué acción en clawhub
            (encolar comando, cambiar configuración, etc.).
          </li>
        </ul>

        <h2 className="font-display text-2xl font-semibold pt-4">
          4. Finalidad del tratamiento
        </h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Prestar el servicio de gestión remota de copilotos.</li>
          <li>Facturar el uso del servicio.</li>
          <li>Detectar incidencias técnicas (PCs offline, errores).</li>
          <li>Cumplir obligaciones legales y fiscales.</li>
        </ul>

        <h2 className="font-display text-2xl font-semibold pt-4">
          5. Base jurídica
        </h2>
        <p>
          Ejecución del contrato suscrito con el cliente (RGPD art. 6.1.b).
          Para el audit log, también interés legítimo en garantizar la
          seguridad del servicio (art. 6.1.f).
        </p>

        <h2 className="font-display text-2xl font-semibold pt-4">
          6. Plazo de conservación
        </h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            Telemetría operativa: 12 meses desde su generación, salvo
            obligación legal de conservación mayor.
          </li>
          <li>
            Audit log: 24 meses para cumplir con requisitos de auditoría
            (LOPD-GDD art. 32.2).
          </li>
          <li>
            Datos de cuenta: mientras dure la relación contractual + 5 años
            por obligaciones mercantiles y fiscales.
          </li>
        </ul>

        <h2 className="font-display text-2xl font-semibold pt-4">
          7. Encargados de tratamiento
        </h2>
        <p>
          El Operador utiliza los siguientes proveedores para prestar el
          servicio (todos con datos en la UE):
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Vercel Inc.</strong> — alojamiento del control plane.
          </li>
          <li>
            <strong>Supabase</strong> (region eu-central-1, Frankfurt) — base
            de datos.
          </li>
          <li>
            <strong>GitHub</strong> — almacenamiento de bundles binarios del
            software.
          </li>
        </ul>

        <h2 className="font-display text-2xl font-semibold pt-4">
          8. Tus derechos
        </h2>
        <p>
          Puedes ejercitar tus derechos de acceso, rectificación, supresión,
          oposición, limitación y portabilidad escribiendo a{" "}
          <a href={`mailto:${supportEmail}`} className="underline">
            {supportEmail}
          </a>{" "}
          o presentando una reclamación ante la Agencia Española de
          Protección de Datos (
          <a
            href="https://www.aepd.es"
            target="_blank"
            rel="noopener"
            className="underline"
          >
            aepd.es
          </a>
          ).
        </p>

        <h2 className="font-display text-2xl font-semibold pt-4">
          9. Cookies
        </h2>
        <p>
          clawhub utiliza una única cookie técnica de sesión necesaria para
          mantenerte autenticado. No usamos cookies de análisis ni de
          marketing.
        </p>

        <h2 className="font-display text-2xl font-semibold pt-4">
          10. Cambios en esta política
        </h2>
        <p>
          Podemos actualizar esta política para reflejar cambios técnicos o
          legales. La fecha de última actualización aparece arriba.
        </p>

        <div className="card-quiet p-4 mt-8 text-xs text-muted-foreground">
          <strong>Aviso:</strong> esta plantilla está pensada como punto de
          partida. Antes de servir en producción real, hazla revisar por un
          abogado especialista en protección de datos para tu jurisdicción
          y caso de uso concretos.
        </div>
      </article>
    </main>
  );
}
