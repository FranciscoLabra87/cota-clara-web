import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { site } from '@/data/site';
import { metadatosPagina } from '@/lib/metadata';

export const metadata = metadatosPagina(
  'Términos de uso',
  'Información sobre las publicaciones, consultas, honorarios y uso del sitio de Cota Clara.',
  '/terminos',
);

export default function TerminosPage() {
  return (
    <LegalPage titulo="Términos de uso" resumen="Información para consultar propiedades y servicios de Cota Clara con claridad." ruta="/terminos">
      <section>
        <h2>El sitio y nuestros servicios</h2>
        <p>
          Este es el sitio de Cota Clara · Patrimonio Inmobiliario. Permite conocer propiedades y servicios, solicitar información y coordinar visitas o reuniones. Puedes contactarnos en{' '}
          <a href={`mailto:${site.email}`}>{site.email}</a> o en nuestra oficina de {site.direccion}, Santiago.
        </p>
        <p>
          Enviar una consulta o solicitar una visita no formaliza una compraventa, un arriendo ni un encargo profesional. La identidad de las partes, el alcance, los plazos, los honorarios y las condiciones de cada servicio se establecen en el documento o contrato correspondiente antes de su contratación.
        </p>
      </section>
      <section>
        <h2>Publicaciones de propiedades</h2>
        <p>
          Las fichas presentan la información disponible de cada propiedad o proyecto: precio, características, fotografías y ubicación. La disponibilidad, los precios y las unidades de un proyecto pueden cambiar durante su comercialización. Confirma con el equipo los antecedentes vigentes antes de presentar una oferta o tomar una decisión.
        </p>
        <p>
          Las superficies, planos, imágenes y mapas ayudan a conocer el inmueble. La revisión de sus antecedentes y una visita permiten verificar las características relevantes para tu operación. Si detectas una diferencia o un error, avísanos para revisarlo.
        </p>
      </section>
      <section>
        <h2>Precios, honorarios y herramientas</h2>
        <p>
          Revisa la moneda y los conceptos indicados en cada publicación. Los honorarios de corretaje y otros servicios se describen en sus páginas y se confirman para cada encargo, junto con los impuestos y gastos que correspondan. Puedes consultar{' '}
          <Link href="/servicios/corretaje#honorarios">qué cobramos por corretaje</Link> o pedir el detalle del servicio que necesitas.
        </p>
        <p>
          Los cálculos de financiamiento y estimaciones del sitio son orientativos. La aprobación de un crédito y sus condiciones dependen de la entidad financiera; una simulación no equivale a una oferta ni a una aprobación.
        </p>
      </section>
      <section>
        <h2>Consultas y acceso corporativo</h2>
        <p>
          Entrega información correcta y utiliza los formularios para consultas relacionadas con propiedades o servicios. No envíes contenido que suplante a otra persona ni archivos o mensajes que afecten la seguridad del sitio.
        </p>
        <p>
          El panel corporativo y el Drive están reservados a usuarios autorizados. Cada persona debe resguardar su contraseña y utilizar la información y los archivos conforme a sus permisos y al encargo que atiende. Si detectas un acceso no reconocido, comunícalo al equipo.
        </p>
      </section>
      <section>
        <h2>Datos personales y enlaces externos</h2>
        <p>
          La <Link href="/privacidad">política de privacidad</Link> explica cómo tratamos las solicitudes y los datos del panel. En{' '}
          <Link href="/cookies">cookies y preferencias</Link> puedes revisar las tecnologías utilizadas y decidir sobre la analítica opcional.
        </p>
        <p>Los mapas, las redes sociales y otros enlaces externos tienen sus propias condiciones. Revisa esas condiciones al utilizar sus servicios.</p>
      </section>
      <section>
        <h2>Consultas o correcciones</h2>
        <p>
          Para aclarar una publicación, conocer las condiciones de un servicio o informar un problema del sitio, escribe a{' '}
          <a href={`mailto:${site.email}`}>{site.email}</a>. Estos términos no limitan los derechos que te reconoce la legislación chilena.
        </p>
      </section>
    </LegalPage>
  );
}
