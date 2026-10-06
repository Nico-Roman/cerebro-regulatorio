import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal, Puntos, Seccion } from "@/components/documento-legal";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description:
    "Qué datos personales trata RegulaMED, con qué finalidad y base legal, cuánto tiempo, con qué proveedores y cómo ejercer tus derechos conforme a la Ley 19.628 y la Ley 21.719.",
  alternates: { canonical: "/privacidad" },
};

// Versión 2026-10-01 (encargo E). Escrita pensando en la Ley 21.719, que entra
// en plena vigencia el 1 de diciembre de 2026. Lo que Nico debe confirmar con un
// abogado antes de publicarla quedó listado en APP-Regulatoria/CAMBIOS-2026-10-01.md.

export default function PrivacidadPage() {
  return (
    <DocumentoLegal
      etiqueta="Legal"
      titulo="Política de Privacidad"
      bajada="Este documento describe qué datos personales tratamos en RegulaMED, para qué y con qué base legal, cuánto tiempo los guardamos, con quién se comparten y cómo puedes ejercer tus derechos. Está escrito para que se entienda leyéndolo una vez."
      actualizado="1 de octubre de 2026"
    >
      <Seccion n="01" titulo="Quién trata tus datos">
        <p>
          El responsable del tratamiento es <strong>Nicolás Román Gligo</strong>, Químico
          Farmacéutico, persona natural con actividades de asesoría en asuntos regulatorios,
          domiciliado en {SITE.ciudad}, Chile, que opera este sitio bajo el nombre de fantasía
          RegulaMED.
        </p>
        <p>
          Para cualquier consulta sobre esta política o para ejercer tus derechos, escribe a{" "}
          <a href={`mailto:${SITE.email}`} className="text-foreground underline underline-offset-4">
            {SITE.email}
          </a>
          .
        </p>
      </Seccion>

      <Seccion n="02" titulo="Qué datos guardamos">
        <p>
          Solo guardamos datos que tú entregas o que se generan al usar el servicio. No compramos
          bases de datos ni obtenemos tu información de terceros.
        </p>
        <Puntos
          items={[
            <>
              <strong className="text-foreground">Cuenta.</strong> Nombre, correo y foto de perfil
              entregados por Google si eliges &laquo;Continuar con Google&raquo;, o solo tu correo si
              entras con enlace mágico. Nunca recibimos tu contraseña de Google.
            </>,
            <>
              <strong className="text-foreground">Perfil profesional.</strong> Empresa, cargo, tipo
              de perfil y teléfono opcional.
            </>,
            <>
              <strong className="text-foreground">Consultas.</strong> El texto de cada pregunta y
              de cada repregunta dentro de una conversación, los filtros, las búsquedas que generó
              el asistente, la respuesta y sus citas, y las señales de calidad (por ejemplo, si una
              afirmación quedó sin cita). Si votas una respuesta, el voto y tu comentario.
            </>,
            <>
              <strong className="text-foreground">Texto pegado en un flujo.</strong> Cuando pegas,
              por ejemplo, una observación del ISP, ese texto se usa para generar la respuesta y no
              se guarda completo: conservamos solo una huella (hash), su largo y los primeros 200
              caracteres, para control de abusos.
            </>,
            <>
              <strong className="text-foreground">Reservas y contacto.</strong> Nombre, correo,
              empresa, tipo de producto, etapa, motivo y horario elegido.
            </>,
            <>
              <strong className="text-foreground">Datos técnicos.</strong> Dirección IP y navegador
              asociados a tu sesión, para seguridad y límites de uso; y, cuando existen, los
              parámetros UTM del enlace por el que llegaste.
            </>,
          ]}
        />
        <p>
          No debes ingresar datos de pacientes ni datos de salud de terceros (ver los{" "}
          <Link href="/terminos" className="text-foreground underline underline-offset-4">
            Términos
          </Link>
          ). Si el sistema los detecta, no procesa el mensaje.
        </p>
      </Seccion>

      <Seccion n="03" titulo="Para qué los usamos y con qué base legal">
        <Puntos
          items={[
            <>
              <strong className="text-foreground">Prestarte el servicio</strong> (cuenta, sesión,
              respuestas, historial de conversaciones, cupo diario). Base: la ejecución del contrato
              que aceptas al crear tu cuenta.
            </>,
            <>
              <strong className="text-foreground">Mejorar el asistente</strong>: detectar qué
              normativa falta, medir si las respuestas sirven y corregir errores. Base: nuestro
              interés legítimo en que la herramienta responda bien, limitado a lo necesario.
            </>,
            <>
              <strong className="text-foreground">Proteger el servicio</strong>: control de abusos,
              límites de uso y seguridad de las cuentas. Base: interés legítimo.
            </>,
            <>
              <strong className="text-foreground">Agendar reuniones y responder contactos</strong>,
              y hacerte una propuesta si la pides. Base: tu solicitud.
            </>,
            <>
              <strong className="text-foreground">Avisarte de cambios normativos o novedades</strong>,
              solo si aceptaste recibirlos. Base: tu consentimiento, que puedes retirar en cualquier
              momento.
            </>,
          ]}
        />
        <p>
          No usamos tus consultas ni el texto que pegas para entrenar modelos de lenguaje. No
          tomamos decisiones automatizadas que produzcan efectos jurídicos sobre ti ni elaboramos
          perfiles con esa finalidad.
        </p>
      </Seccion>

      <Seccion n="04" titulo="Cuando pides una respuesta humana">
        <p>
          Si el asistente no encuentra la respuesta y aprietas «Te respondo yo en 24 horas
          hábiles», enviamos tu pregunta y tu correo a {SITE.email} para que un químico
          farmacéutico te conteste. Ese correo se trata como un mensaje de contacto.
        </p>
      </Seccion>

      <Seccion n="05" titulo="Con quién se comparten (proveedores y transferencia internacional)">
        <p>
          No vendemos ni cedemos tus datos. Los compartimos solo con los proveedores que hacen
          funcionar el servicio, cada uno limitado a lo que necesita:
        </p>
        <Puntos
          items={[
            <>
              <strong className="text-foreground">Railway</strong> (Estados Unidos): alojamiento de
              la aplicación y de la base de datos.
            </>,
            <>
              <strong className="text-foreground">Google</strong> (Estados Unidos): autenticación
              y, para las reuniones, el evento de calendario y la videollamada.
            </>,
            <>
              <strong className="text-foreground">Resend</strong> (Estados Unidos): envío de
              correos (enlace de acceso, confirmaciones, respuestas humanas).
            </>,
            <>
              <strong className="text-foreground">Groq</strong> (Estados Unidos), proveedor del
              modelo de lenguaje: recibe la pregunta, el texto pegado en un flujo y los pasajes
              normativos, nunca tu nombre ni tu correo.
            </>,
            <>
              <strong className="text-foreground">GitHub</strong> (Estados Unidos): guarda los
              respaldos de la base de datos, cifrados antes de salir del servidor.
            </>,
            <>
              <strong className="text-foreground">Sentry</strong> (Estados Unidos), si está
              activado: recibe los errores técnicos del sitio, sin el texto de las preguntas ni el
              contenido de las solicitudes.
            </>,
          ]}
        />
        <p>
          Esto implica transferencia internacional de datos a Estados Unidos. También podríamos
          entregar información si una autoridad competente lo requiere por resolución fundada.
        </p>
      </Seccion>

      <Seccion n="06" titulo="Uso limitado de los datos de Google">
        <p>
          El uso que RegulaMED hace de la información recibida de las API de Google se rige por la{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            Política de Datos de Usuario de los Servicios de API de Google
          </a>
          , incluidos sus requisitos de uso limitado. Usamos tu perfil básico de Google solo para
          crear y mantener tu cuenta, y el acceso a Google Calendar se ejerce exclusivamente sobre
          el calendario de RegulaMED. No usamos datos de Google para publicidad ni los vendemos.
        </p>
      </Seccion>

      <Seccion n="07" titulo="Cookies">
        <p>
          Usamos una única cookie propia: la que mantiene tu sesión iniciada. No usamos cookies de
          analítica, de publicidad ni de seguimiento entre sitios.
        </p>
      </Seccion>

      <Seccion n="08" titulo="Cuánto tiempo los conservamos">
        <p>
          Los datos de tu cuenta, mientras la cuenta exista. Las consultas y conversaciones se
          conservan asociadas a tu cuenta durante 12 meses; después se disocian (se borra el
          vínculo contigo) y solo se conservan para mejorar el servicio. Las reservas, tres años.
          Si eliminas tu cuenta, borramos tus datos identificatorios y disociamos tus consultas.
        </p>
      </Seccion>

      <Seccion n="09" titulo="Tus derechos">
        <p>
          Conforme a la Ley 19.628 y a la Ley 21.719, que la reemplaza y entra en plena vigencia el
          1 de diciembre de 2026, puedes pedir en cualquier momento el acceso a tus datos, su
          rectificación, su supresión, la oposición a un tratamiento determinado y su portabilidad
          en un formato estructurado.
        </p>
        <p>
          Basta con escribir a{" "}
          <a href={`mailto:${SITE.email}`} className="text-foreground underline underline-offset-4">
            {SITE.email}
          </a>{" "}
          desde el correo de tu cuenta. Respondemos dentro de los treinta días corridos. Si crees
          que no tratamos bien tus datos, puedes reclamar ante la Agencia de Protección de Datos
          Personales una vez que entre en funciones.
        </p>
      </Seccion>

      <Seccion n="10" titulo="Seguridad y menores de edad">
        <p>
          El sitio se sirve íntegramente sobre HTTPS, las sesiones expiran, los respaldos van
          cifrados y el acceso a los datos está restringido al responsable. Si ocurriera una
          vulneración que afecte tus datos, te avisaríamos por correo.
        </p>
        <p>
          RegulaMED es una herramienta profesional dirigida a personas mayores de 18 años. No
          recogemos datos de menores de edad de forma consciente.
        </p>
      </Seccion>

      <Seccion n="11" titulo="Versión y cambios">
        <p>
          Esta es la versión del 1 de octubre de 2026. Si cambiamos algo sustantivo, actualizaremos
          la fecha del encabezado y, cuando el cambio te afecte directamente, te avisaremos por
          correo antes de que entre en vigor. Consulta también los{" "}
          <Link href="/terminos" className="text-foreground underline underline-offset-4">
            Términos del Servicio
          </Link>
          .
        </p>
      </Seccion>
    </DocumentoLegal>
  );
}
