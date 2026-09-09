import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal, Puntos, Seccion } from "@/components/documento-legal";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description:
    "Qué datos personales trata RegulaMED, con qué finalidad, con quién se comparten y cómo ejercer tus derechos conforme a la Ley 19.628 y la Ley 21.719.",
  alternates: { canonical: "/privacidad" },
};

export default function PrivacidadPage() {
  return (
    <DocumentoLegal
      etiqueta="Legal"
      titulo="Política de Privacidad"
      bajada="Este documento describe qué datos personales trata RegulaMED, para qué, con quién se comparten y cómo puedes ejercer tus derechos. Está escrito para que se entienda leyéndolo una vez."
      actualizado="9 de septiembre de 2026"
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

      <Seccion n="02" titulo="Qué datos recogemos y de dónde">
        <p>
          Solo recogemos datos que tú entregas o que se generan al usar el servicio. No compramos
          bases de datos ni obtenemos tu información de terceros.
        </p>
        <Puntos
          items={[
            <>
              <strong className="text-foreground">Cuenta.</strong> Nombre, dirección de correo y
              foto de perfil, entregados por Google cuando eliges &laquo;Continuar con
              Google&raquo;, o solo tu correo si entras con enlace mágico. Nunca recibimos ni
              almacenamos tu contraseña de Google.
            </>,
            <>
              <strong className="text-foreground">Perfil profesional.</strong> Empresa, cargo, tipo
              de perfil (por ejemplo importador, laboratorio, consultor) y teléfono opcional. Nos
              sirven para saber a quién le falta qué normativa.
            </>,
            <>
              <strong className="text-foreground">Uso del buscador.</strong> El texto de cada
              consulta, los filtros aplicados, la norma citada en el primer resultado y la señal de
              confianza del motor. Si votas si una respuesta te sirvió, guardamos ese voto y tu
              comentario.
            </>,
            <>
              <strong className="text-foreground">Datos técnicos de sesión.</strong> Dirección IP y
              navegador asociados a tu sesión, para detectar accesos indebidos y limitar abusos.
            </>,
            <>
              <strong className="text-foreground">Reservas de reunión.</strong> Si agendas una
              hora: nombre, correo, empresa, motivo y el horario elegido.
            </>,
            <>
              <strong className="text-foreground">Origen de la visita.</strong> Parámetros UTM de la
              campaña o el enlace por el que llegaste, cuando existen.
            </>,
          ]}
        />
      </Seccion>

      <Seccion n="03" titulo="Para qué los usamos">
        <p>
          Cada dato tiene una finalidad concreta y ninguna de ellas es publicitaria hacia terceros:
        </p>
        <Puntos
          items={[
            "Darte acceso al buscador de normativa y mantener tu sesión iniciada.",
            "Detectar qué normativa falta en el corpus, priorizar su incorporación y medir si los resultados sirven.",
            "Avisarte por correo cuando cambie una norma relevante o cuando actualicemos el corpus, solo si aceptaste recibir novedades.",
            "Agendar, confirmar y cancelar reuniones de asesoría.",
            "Responder tus mensajes de contacto y, si lo pediste, hacerte una propuesta de servicios.",
            "Proteger el servicio: control de abusos, cuotas de uso y seguridad de las cuentas.",
          ]}
        />
        <p>
          No tomamos decisiones automatizadas que produzcan efectos jurídicos sobre ti, ni
          elaboramos perfiles con esa finalidad.
        </p>
      </Seccion>

      <Seccion n="04" titulo="Con quién se comparten">
        <p>
          No vendemos ni cedemos tus datos. Los compartimos únicamente con los proveedores que
          hacen funcionar el servicio, cada uno limitado a lo que necesita:
        </p>
        <Puntos
          items={[
            <>
              <strong className="text-foreground">Railway</strong> (Estados Unidos): alojamiento de
              la aplicación y de la base de datos.
            </>,
            <>
              <strong className="text-foreground">Google</strong> (Estados Unidos): autenticación
              con tu cuenta y, para las reuniones, creación del evento de calendario y el enlace de
              videollamada.
            </>,
            <>
              <strong className="text-foreground">Resend</strong> (Estados Unidos): envío de los
              correos transaccionales (enlace de acceso, confirmación de reunión, avisos).
            </>,
            <>
              <strong className="text-foreground">Proveedor del modelo de lenguaje</strong>: solo si
              usas el botón que redacta una respuesta, se envía tu pregunta junto con los pasajes
              normativos recuperados. No se envía tu nombre, tu correo ni tu historial.
            </>,
          ]}
        />
        <p>
          Esto implica transferencia internacional de datos a Estados Unidos. También podríamos
          entregar información si una autoridad competente lo requiere por resolución fundada.
        </p>
      </Seccion>

      <Seccion n="05" titulo="Uso limitado de los datos de Google">
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
          , incluidos sus requisitos de uso limitado.
        </p>
        <p>
          En concreto: usamos tu perfil básico de Google solo para crear y mantener tu cuenta. El
          acceso a Google Calendar se ejerce exclusivamente sobre el calendario de RegulaMED, para
          publicar los horarios disponibles y crear el evento de la reunión que reserves. No leemos
          los calendarios de los usuarios, no usamos datos de Google para publicidad, no los
          vendemos y no los entregamos a terceros salvo lo indicado en la sección anterior.
        </p>
      </Seccion>

      <Seccion n="06" titulo="Cookies">
        <p>
          Usamos una única cookie propia: la que mantiene tu sesión iniciada. Sin ella tendrías que
          autenticarte en cada página. No usamos cookies de analítica, de publicidad ni de
          seguimiento entre sitios, y no hay píxeles de terceros incrustados.
        </p>
      </Seccion>

      <Seccion n="07" titulo="Cuánto tiempo los conservamos">
        <p>
          Mantenemos los datos de tu cuenta mientras esta exista. Las consultas y sus votos se
          conservan de forma asociada a tu cuenta mientras el servicio esté activo, porque son la
          materia prima con la que decidimos qué normativa incorporar. Las reservas se conservan
          por tres años, plazo razonable para respaldar una relación profesional. Si eliminas tu
          cuenta, borramos tus datos identificatorios y conservamos las consultas de forma
          disociada, sin vínculo contigo.
        </p>
      </Seccion>

      <Seccion n="08" titulo="Tus derechos">
        <p>
          Conforme a la Ley 19.628 sobre protección de la vida privada y a la Ley 21.719, que la
          reemplaza y entra en plena vigencia el 1 de diciembre de 2026, puedes pedir en cualquier
          momento el acceso a tus datos, su rectificación, su supresión, la oposición a un
          tratamiento determinado y su portabilidad en un formato estructurado.
        </p>
        <p>
          Basta con escribir a{" "}
          <a href={`mailto:${SITE.email}`} className="text-foreground underline underline-offset-4">
            {SITE.email}
          </a>{" "}
          desde el correo de tu cuenta. Respondemos dentro de los treinta días corridos. Si crees
          que no tratamos bien tus datos, podrás reclamar ante la Agencia de Protección de Datos
          Personales una vez que entre en funciones.
        </p>
      </Seccion>

      <Seccion n="09" titulo="Seguridad y menores de edad">
        <p>
          El sitio se sirve íntegramente sobre HTTPS, las sesiones expiran y el acceso a los datos
          está restringido al responsable. Ningún sistema es infalible: si ocurriera una
          vulneración que afecte tus datos, te avisaríamos por correo.
        </p>
        <p>
          RegulaMED es una herramienta profesional dirigida a personas mayores de 18 años. No
          recogemos datos de menores de edad de forma consciente.
        </p>
      </Seccion>

      <Seccion n="10" titulo="Cambios a esta política">
        <p>
          Si cambiamos algo sustantivo, actualizaremos la fecha de vigencia del encabezado y, cuando
          el cambio te afecte directamente, te avisaremos por correo antes de que entre en vigor.
          Consulta también los{" "}
          <Link href="/terminos" className="text-foreground underline underline-offset-4">
            Términos del Servicio
          </Link>
          .
        </p>
      </Seccion>
    </DocumentoLegal>
  );
}
