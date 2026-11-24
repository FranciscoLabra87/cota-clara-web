import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { site } from '@/data/site';

export const metadata: Metadata = {
  title: 'Términos y condiciones',
  description:
    'Condiciones de uso del sitio de Cota Clara: alcance de la información de las propiedades, del simulador de crédito y de los honorarios publicados.',
  alternates: { canonical: '/terminos' },
};

const actualizada = '24 de noviembre de 2026';

export default function TerminosPage() {
  return (
    <>
      <PageHero
        migas={[{ href: '/', label: 'Inicio' }, { label: 'Términos y condiciones' }]}
        title="Términos y condiciones"
        lead="Las reglas para usar este sitio y el alcance de la información que publicamos."
      />
      <section className="section section--after-hero">
        <div className="container legal">
          <p className="legal__updated">Última actualización: {actualizada}.</p>

          <div className="legal__section">
            <h2 className="legal__title">Sobre este sitio</h2>
            <p>
              Este sitio es de {site.nombre}, firma de corretaje, tasaciones, asesoría y gestión patrimonial con oficina en {site.calle},{' '}
              {site.comuna}, Santiago. Al usarlo aceptas estas condiciones. Si no estás de acuerdo con ellas, te pedimos no usar el sitio.
            </p>
          </div>

          <div className="legal__section">
            <h2 className="legal__title">La información de las propiedades</h2>
            <p>
              Publicamos cada propiedad con los datos que nos entregan su propietario o la inmobiliaria. Precios, superficies, gastos comunes,
              disponibilidad, fotos y planos son referenciales y pueden cambiar sin aviso. Una publicación no es una oferta que obligue a
              vender o arrendar: las condiciones de cada operación se acuerdan por escrito.
            </p>
            <p>
              Antes de decidir, confirma con nosotros los datos que te importen y revisa los documentos de la propiedad. Las imágenes
              pueden ser ilustrativas, sobre todo en los proyectos en verde o en blanco.
            </p>
          </div>

          <div className="legal__section">
            <h2 className="legal__title">El simulador de crédito</h2>
            <p>
              El dividendo que muestran las fichas es una estimación con supuestos generales (por defecto, pie de 20%, plazo de 25 años y
              tasa anual de 4,1%). No incluye seguros, gastos operacionales ni impuestos, y no es una oferta de crédito. La tasa, el monto y
              la aprobación los define cada banco según tu evaluación.
            </p>
          </div>

          <div className="legal__section">
            <h2 className="legal__title">Honorarios</h2>
            <p>
              Los honorarios que mostramos en cada servicio son referenciales. Los que rigen son los que te entregamos por escrito y
              firmamos contigo antes de empezar cualquier gestión.
            </p>
          </div>

          <div className="legal__section">
            <h2 className="legal__title">Formularios y solicitudes</h2>
            <p>
              Al enviarnos un formulario te comprometes a entregar datos verdaderos y propios. Enviar una solicitud no nos obliga a prestar
              un servicio ni te obliga a contratarlo. Cómo tratamos esos datos está explicado en nuestra{' '}
              <Link href="/privacidad">política de privacidad</Link>.
            </p>
          </div>

          <div className="legal__section">
            <h2 className="legal__title">Uso permitido</h2>
            <p>Puedes navegar el sitio y compartir sus enlaces. No está permitido:</p>
            <ul className="legal__list">
              <li className="legal__item">Copiar o descargar de forma masiva su contenido, con robots u otros medios automáticos.</li>
              <li className="legal__item">Enviar spam por los formularios o usarlos para escribir a nombre de otra persona.</li>
              <li className="legal__item">Intentar entrar al área interna sin una cuenta autorizada o afectar el funcionamiento del sitio.</li>
            </ul>
          </div>

          <div className="legal__section">
            <h2 className="legal__title">Propiedad intelectual</h2>
            <p>
              La marca {site.nombre}, su logo, los textos y el diseño del sitio son de {site.nombre} o se usan con autorización. Las fotos y
              planos de las propiedades pertenecen a sus autores o propietarios. No puedes reproducirlos con fines comerciales sin permiso.
            </p>
          </div>

          <div className="legal__section">
            <h2 className="legal__title">Enlaces a otros sitios</h2>
            <p>
              El sitio tiene enlaces y mapas de servicios de terceros, como Google Maps, OpenStreetMap y WhatsApp. No controlamos esos
              servicios ni respondemos por su contenido; cada uno tiene sus propias condiciones.
            </p>
          </div>

          <div className="legal__section">
            <h2 className="legal__title">Responsabilidad</h2>
            <p>
              Hacemos lo posible para que la información esté al día y el sitio funcione sin interrupciones, pero no podemos garantizarlo
              siempre. Nada de estas condiciones limita los derechos que te da la Ley de Protección de los Derechos de los Consumidores.
            </p>
          </div>

          <div className="legal__section">
            <h2 className="legal__title">Cambios y ley aplicable</h2>
            <p>
              Podemos actualizar estos términos; la versión vigente es la publicada en esta página, con su fecha. Se rigen por las leyes de
              Chile.
            </p>
            <p>
              ¿Dudas? Escríbenos a <a href={`mailto:${site.email}`}>{site.email}</a>.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
