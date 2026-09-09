import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal, Puntos, Seccion } from "@/components/documento-legal";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Términos del Servicio",
  description:
    "Condiciones de uso del buscador de normativa ISP/ANAMED de RegulaMED: alcance, límites, cuentas, propiedad intelectual y responsabilidad.",
  alternates: { canonical: "/terminos" },
};

export default function TerminosPage() {
  return (
    <DocumentoLegal
      etiqueta="Legal"
      titulo="Términos del Servicio"
      bajada="Estas condiciones regulan el uso del buscador de normativa y de las demás herramientas de RegulaMED. Al crear una cuenta las aceptas."
      actualizado="9 de septiembre de 2026"
    >
      <Seccion n="01" titulo="Qué es RegulaMED">
        <p>
          RegulaMED es un servicio operado por Nicolás Román Gligo, Químico Farmacéutico, persona
          natural con actividades de asesoría en asuntos regulatorios en {SITE.ciudad}, Chile.
          Comprende un buscador gratuito de normativa sanitaria chilena, la posibilidad de agendar
          reuniones de asesoría y los servicios profesionales que se contraten por separado.
        </p>
      </Seccion>

      <Seccion n="02" titulo="El buscador no es asesoría legal ni regulatoria">
        <p>
          Este es el punto más importante de este documento. El buscador recupera y cita pasajes de
          decretos, resoluciones y normas técnicas publicadas por el Instituto de Salud Pública y
          otras autoridades; no interpreta tu caso ni sustituye una opinión profesional.
        </p>
        <p>
          El corpus se actualiza a diario y cada resultado indica su fecha, pero una norma puede
          haber sido modificada, derogada o publicada después de la última actualización.{" "}
          <strong className="text-foreground">
            Verifica siempre contra la fuente oficial antes de tomar una decisión regulatoria
          </strong>
          , especialmente si de ella dependen plazos, registros sanitarios o el cumplimiento de una
          exigencia de la autoridad.
        </p>
        <p>
          Cuando el motor no encuentra respaldo suficiente, el servicio declara la ausencia de
          evidencia en vez de ofrecer una respuesta aproximada. Esa declaración es una respuesta
          legítima del sistema y no un error.
        </p>
      </Seccion>

      <Seccion n="03" titulo="Respuestas redactadas con inteligencia artificial">
        <p>
          Algunas consultas permiten pedir una respuesta redactada por un modelo de lenguaje. Esa
          redacción se construye únicamente a partir de los pasajes normativos recuperados y debe
          citarlos, pero puede contener errores de interpretación, omisiones o citas mal
          atribuidas. Es un borrador de trabajo: la cita y el texto oficial mandan por sobre el
          resumen.
        </p>
      </Seccion>

      <Seccion n="04" titulo="Tu cuenta">
        <p>
          El buscador es gratuito y requiere una cuenta. Te comprometes a entregar datos veraces, a
          mantener una sola cuenta y a no compartir tus credenciales. Eres responsable de la
          actividad que ocurra bajo tu cuenta.
        </p>
        <p>
          Puedes cerrarla cuando quieras escribiendo a{" "}
          <a href={`mailto:${SITE.email}`} className="text-foreground underline underline-offset-4">
            {SITE.email}
          </a>
          . Podemos suspender cuentas que incumplan estos términos, avisándote salvo que el abuso
          sea flagrante.
        </p>
      </Seccion>

      <Seccion n="05" titulo="Uso aceptable">
        <p>Al usar el servicio te obligas a no:</p>
        <Puntos
          items={[
            "Extraer masivamente el corpus por medios automatizados, ni reconstruir la base de datos para revenderla o publicarla como propia.",
            "Revender el acceso, compartir tu cuenta con terceros o usar el servicio para prestar un servicio equivalente.",
            "Intentar vulnerar la seguridad, saltarte las cuotas de uso o interferir con la disponibilidad del sitio.",
            "Cargar contenido ilícito o datos personales de terceros en las consultas o comentarios.",
          ]}
        />
        <p>
          Aplicamos límites de uso por cuenta y por dirección IP para mantener el servicio
          disponible para todos.
        </p>
      </Seccion>

      <Seccion n="06" titulo="Propiedad intelectual">
        <p>
          Los textos normativos son documentos públicos de sus organismos emisores y se citan con
          enlace a la fuente oficial. El software, el diseño del sitio, la organización del corpus,
          los índices de búsqueda y los textos propios son de RegulaMED. Puedes citar los resultados
          en tu trabajo profesional indicando la fuente oficial; no puedes reproducir el servicio ni
          sus componentes.
        </p>
      </Seccion>

      <Seccion n="07" titulo="Reuniones agendadas">
        <p>
          Las horas ofrecidas reflejan la disponibilidad real del calendario y se confirman por
          correo con un enlace de videollamada. Puedes cancelar desde el enlace de gestión que
          recibes en esa confirmación. Una reunión de diagnóstico no constituye por sí sola una
          relación de asesoría: los servicios profesionales se rigen por la propuesta que se firme
          por separado.
        </p>
      </Seccion>

      <Seccion n="08" titulo="Disponibilidad y responsabilidad">
        <p>
          El servicio se ofrece &laquo;tal como está&raquo;, sin garantía de disponibilidad
          ininterrumpida ni de exhaustividad del corpus. Podemos modificarlo, suspenderlo o
          discontinuarlo, avisando con antelación razonable cuando el cambio sea sustantivo.
        </p>
        <p>
          En la máxima medida que permite la ley chilena, RegulaMED no responde por decisiones
          tomadas a partir de los resultados del buscador ni por daños indirectos derivados de su
          uso. Nada en estos términos limita la responsabilidad por dolo o culpa grave, ni los
          derechos que la ley reconoce a los consumidores.
        </p>
      </Seccion>

      <Seccion n="09" titulo="Datos personales">
        <p>
          El tratamiento de tus datos se rige por la{" "}
          <Link href="/privacidad" className="text-foreground underline underline-offset-4">
            Política de Privacidad
          </Link>
          , que forma parte integrante de estos términos.
        </p>
      </Seccion>

      <Seccion n="10" titulo="Cambios, ley aplicable y contacto">
        <p>
          Podemos actualizar estos términos; la fecha de vigencia del encabezado indica la versión
          vigente y los cambios sustantivos se avisan por correo. Si sigues usando el servicio
          después de un cambio, se entiende que lo aceptas.
        </p>
        <p>
          Estos términos se rigen por la ley chilena y cualquier controversia se somete a los
          tribunales ordinarios de {SITE.ciudad}. Para cualquier asunto relacionado con este
          documento, escribe a{" "}
          <a href={`mailto:${SITE.email}`} className="text-foreground underline underline-offset-4">
            {SITE.email}
          </a>
          .
        </p>
      </Seccion>
    </DocumentoLegal>
  );
}
