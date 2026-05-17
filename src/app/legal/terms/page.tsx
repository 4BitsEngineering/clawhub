/**
 * /legal/terms — términos de servicio. Plantilla base adaptable.
 *
 * Igual que privacy: revisión legal obligatoria antes de servir en prod.
 */
import Link from "next/link";

export const metadata = {
  title: "Términos de Servicio — clawhub",
};

export default function TermsPage() {
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
          Términos de Servicio
        </h1>
        <p className="text-muted-foreground">
          Última actualización: {updatedAt}
        </p>

        <h2 className="font-display text-2xl font-semibold pt-4">
          1. Objeto
        </h2>
        <p>
          Estos términos regulan el uso del servicio <strong>clawhub</strong>{" "}
          ofrecido por <strong>{operatorOrg}</strong> (en adelante &ldquo;el
          Operador&rdquo;). clawhub es un panel de control para gestionar
          instancias de OpenClaw desplegadas en los PCs de la empresa
          cliente.
        </p>

        <h2 className="font-display text-2xl font-semibold pt-4">
          2. Modelo de despliegue
        </h2>
        <p>
          El software ejecuta en los PCs del cliente (modelo on-prem). El
          Operador NO accede a los datos de negocio del cliente — solo
          recibe telemetría operativa para prestar el servicio (ver{" "}
          <Link href="/legal/privacy" className="underline">
            Política de Privacidad
          </Link>
          ).
        </p>

        <h2 className="font-display text-2xl font-semibold pt-4">
          3. Alta y planes
        </h2>
        <p>
          El cliente contrata un plan con un número de seats (PCs)
          determinado. Si se alcanza el límite, deberá ampliar plan antes de
          dar de alta más PCs. Los planes vigentes y sus precios se
          comunican comercialmente.
        </p>

        <h2 className="font-display text-2xl font-semibold pt-4">
          4. Obligaciones del cliente
        </h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Mantener actualizadas las credenciales de administrador.</li>
          <li>
            Velar por que el uso del software cumpla la normativa vigente en
            su sector (LOPD-GDD, secreto profesional, etc.).
          </li>
          <li>
            No revertir, descompilar ni redistribuir el software sin
            autorización escrita.
          </li>
        </ul>

        <h2 className="font-display text-2xl font-semibold pt-4">
          5. Disponibilidad
        </h2>
        <p>
          El Operador hará esfuerzos razonables para mantener el control
          plane disponible 24/7, pero no garantiza un SLA específico salvo
          que se haya pactado en un contrato anexo. Las instancias locales
          siguen funcionando aunque el control plane esté caído (operación
          autónoma).
        </p>

        <h2 className="font-display text-2xl font-semibold pt-4">
          6. Limitación de responsabilidad
        </h2>
        <p>
          En la máxima medida permitida por la ley, la responsabilidad
          acumulada del Operador no excederá del importe pagado por el
          cliente durante los 12 meses anteriores al incidente que motive
          la reclamación.
        </p>

        <h2 className="font-display text-2xl font-semibold pt-4">
          7. Propiedad intelectual
        </h2>
        <p>
          El cliente conserva la propiedad de sus SOPs, plantillas y
          configuración. El Operador conserva la propiedad del software y
          de la marca clawhub.
        </p>

        <h2 className="font-display text-2xl font-semibold pt-4">
          8. Resolución
        </h2>
        <p>
          Cualquiera de las partes puede resolver el contrato con preaviso
          de 30 días. A la finalización, el cliente puede solicitar la
          exportación de sus datos en formato máquina (JSON) durante los
          60 días siguientes.
        </p>

        <h2 className="font-display text-2xl font-semibold pt-4">
          9. Ley aplicable
        </h2>
        <p>
          Estos términos se rigen por la ley española. Para cualquier
          controversia, las partes se someten a los juzgados y tribunales
          del domicilio del Operador, salvo que la ley aplicable establezca
          un fuero imperativo distinto.
        </p>

        <h2 className="font-display text-2xl font-semibold pt-4">
          10. Contacto
        </h2>
        <p>
          Para cualquier consulta:{" "}
          <a href={`mailto:${supportEmail}`} className="underline">
            {supportEmail}
          </a>
          .
        </p>

        <div className="card-quiet p-4 mt-8 text-xs text-muted-foreground">
          <strong>Aviso:</strong> esta plantilla está pensada como punto de
          partida. Antes de servir en producción real, hazla revisar por un
          abogado mercantil que adapte cláusulas a tu modelo de negocio
          concreto.
        </div>
      </article>
    </main>
  );
}
