import type { Metadata } from "next";
import Link from "next/link";
import { DocumentoLegal, Puntos, Seccion } from "@/components/documento-legal";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Términos del Servicio",
  description:
    "Condiciones de uso del asistente de normativa ISP/ANAMED de RegulaMED: alcance, límites de uso, datos que no se pueden pegar, cuentas, propiedad intelectual y responsabilidad.",
  alternates: { canonical: "/terminos" },
};

export default function TerminosPage() {
  return (
    <DocumentoLegal
      etiqueta="Legal"
      titulo="Términos del Servicio"
      bajada="Estas condiciones regulan el uso del asistente de normativa y de las demás herramientas de RegulaMED. Al crear una cuenta las aceptas."
      actualizado="1 de octubre de 2026"
    >
      <Seccion n="01" titulo="Qué es RegulaMED">
        <p>
          RegulaMED es un servicio operado por Nicolás Román Gligo, Químico Farmacéutico, persona
          natural con actividades de asesoría en asuntos regulatorios en {SITE.ciudad}, Chile.
          Comprende un asistente gratuito de normativa sanitaria chilena (buscador, respuestas
          redactadas con cita y flujos guiados), la posibilidad de agendar reuniones de asesoría y
          los servicios profesionales que se contraten por separado.
        </p>
      </Seccion>

      <Seccion n="02" titulo="El asistente orienta; no reemplaza una revisión profesional">
        <p>
          Este es el punto más importante de este documento. El asistente recupera y cita pasajes
          de decretos, resoluciones y normas técnicas publicadas por el Instituto de Salud Pública y
          otras autoridades, y redacta respuestas y borradores a partir de ellos. Orienta y ahorra
          tiempo, pero{" "}
          <strong className="text-foreground">
            no reemplaza la revisión de un químico farmacéutico ni una asesoría regulatoria o legal
          </strong>
          : no conoce tu expediente ni interpreta tu caso con la responsabilidad de un profesional.
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

      <Seccion n="03" titulo="Respuestas y borradores con inteligencia artificial">
        <p>
          Las respuestas del asistente las redacta un modelo de lenguaje únicamente a partir de los
          pasajes normativos recuperados, y cada afirmación normativa debe citarlos. Aun así puede
          contener errores de interpretación, omisiones o citas mal atribuidas; cuando una
          obligación o un plazo queda sin cita, se marca en pantalla. Es un borrador de trabajo: la
          cita y el texto oficial mandan por sobre el resumen.
        </p>
        <p>
          Los borradores de respuesta a observaciones del ISP llevan la etiqueta «Borrador para
          revisión profesional» y no deben presentarse a la autoridad sin que un profesional los
          revise contra el expediente.
        </p>
        <p>
          Para redactar, la pregunta, el texto que pegues en un flujo y los pasajes recuperados se
          envían a un proveedor externo de modelos de lenguaje. No se envía tu nombre, tu correo ni
          ningún otro dato de tu cuenta. Una respuesta a una pregunta (no a un texto pegado) puede
          reutilizarse para otra persona que haga la misma pregunta y reciba los mismos pasajes.
        </p>
      </Seccion>

      <Seccion n="04" titulo="Límite de uso: 10 preguntas al día">
        <p>
          Cada persona tiene 10 preguntas al día. Cuenta todo mensaje enviado: una pregunta, una
          repregunta en la misma conversación o la ejecución de un flujo guiado, aunque la
          respuesta salga de la caché, el asistente se abstenga o el mensaje no corresponda a una
          consulta normativa. El cupo se renueva a medianoche, hora de Chile, y no se acumula.
        </p>
      </Seccion>

      <Seccion n="05" titulo="Lo que no debes pegar ni escribir">
        <p>
          <strong className="text-foreground">Está prohibido ingresar datos de pacientes</strong>:
          nombres junto a diagnósticos o tratamientos, RUT, fechas de nacimiento, fichas clínicas o
          cualquier dato que permita identificar a una persona y su salud. El sistema intenta
          detectarlos y, si los encuentra, no procesa el mensaje; esa detección es una ayuda, no
          una garantía, y la responsabilidad de no ingresarlos es tuya.
        </p>
        <p>
          Tampoco pegues información confidencial de un empleador o de un cliente que no estés
          autorizado a compartir. El texto que pegas en un flujo se usa solo para generar la
          respuesta: no lo guardamos completo más allá de ella (solo una huella, su largo y los
          primeros 200 caracteres, para control de abusos) y no lo usamos para entrenar modelos.
        </p>
      </Seccion>

      <Seccion n="06" titulo="Tu cuenta">
        <p>
          El asistente es gratuito y requiere una cuenta. Te comprometes a entregar datos veraces, a
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

      <Seccion n="07" titulo="Uso aceptable">
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

      <Seccion n="08" titulo="Propiedad intelectual">
        <p>
          Los textos normativos son documentos públicos de sus organismos emisores y se citan con
          enlace a la fuente oficial. El software, el diseño del sitio, la organización del corpus,
          los índices de búsqueda y los textos propios son de RegulaMED. Puedes citar los resultados
          en tu trabajo profesional indicando la fuente oficial; no puedes reproducir el servicio ni
          sus componentes.
        </p>
      </Seccion>

      <Seccion n="09" titulo="Reuniones agendadas">
        <p>
          Las horas ofrecidas reflejan la disponibilidad real del calendario y se confirman por
          correo con un enlace de videollamada. Puedes cancelar desde el enlace de gestión que
          recibes en esa confirmación. Una reunión de diagnóstico no constituye por sí sola una
          relación de asesoría: los servicios profesionales se rigen por la propuesta que se firme
          por separado.
        </p>
      </Seccion>

      <Seccion n="10" titulo="Servicio gratuito, disponibilidad y responsabilidad">
        <p>
          Hoy el asistente es gratuito. Esto puede cambiar: si en el futuro alguna parte pasa a
          tener costo, lo avisaremos por correo con antelación y nada se cobrará sin que lo
          aceptes expresamente.
        </p>
        <p>
          El servicio se ofrece &laquo;tal como está&raquo;, sin garantía de disponibilidad
          ininterrumpida ni de exhaustividad del corpus. Podemos modificarlo, suspenderlo o
          discontinuarlo, avisando con antelación razonable cuando el cambio sea sustantivo.
        </p>
        <p>
          En la máxima medida que permite la ley chilena, RegulaMED no responde por decisiones
          tomadas a partir de los resultados, respuestas o borradores del asistente, ni por daños
          indirectos derivados de su uso. Nuestra responsabilidad total frente a ti por el uso del
          servicio gratuito se limita al monto que hayas pagado por él en los doce meses
          anteriores al hecho. Nada en estos términos limita la responsabilidad por dolo o culpa grave, ni los
          derechos que la ley reconoce a los consumidores.
        </p>
      </Seccion>

      <Seccion n="11" titulo="Datos personales">
        <p>
          El tratamiento de tus datos se rige por la{" "}
          <Link href="/privacidad" className="text-foreground underline underline-offset-4">
            Política de Privacidad
          </Link>
          , que forma parte integrante de estos términos.
        </p>
      </Seccion>

      <Seccion n="12" titulo="Cambios, ley aplicable y contacto">
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
