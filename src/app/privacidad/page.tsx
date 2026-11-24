import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { site } from '@/data/site';

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description:
    'Qué datos personales recibe Cota Clara por su sitio web, para qué los usa, con quién los comparte, cuánto tiempo los guarda y cómo ejercer tus derechos.',
  alternates: { canonical: '/privacidad' },
};

// Describe lo que el sitio hace de verdad: si cambia un formulario, un
// proveedor o cuánto se guarda algo, hay que actualizar este texto y su fecha.
const actualizada = '24 de noviembre de 2026';

export default function PrivacidadPage() {
  return (
    <>
      <PageHero
        migas={[{ href: '/', label: 'Inicio' }, { label: 'Política de privacidad' }]}
        title="Política de privacidad"
        lead="Usamos tus datos solo para atender lo que nos pides. Acá explicamos cuáles, para qué, con quién y cómo pedir que los corrijamos o eliminemos."
      />
      <section className="section section--after-hero">
        <div className="container legal">
          <p className="legal__updated">Última actualización: {actualizada}.</p>

          <div className="legal__section">
            <h2 className="legal__title">Quién es responsable de tus datos</h2>
            <p>
              {site.nombre}, con oficina en {site.calle}, {site.edificio}, {site.comuna}, Santiago. Para cualquier consulta sobre esta
              política o sobre tus datos, escríbenos a <a href={`mailto:${site.email}`}>{site.email}</a> o llámanos al{' '}
              <a href={`tel:${site.telefonoHref}`}>{site.telefono}</a>.
            </p>
          </div>

          <div className="legal__section">
            <h2 className="legal__title">Qué datos recibimos</h2>
            <p>Solo los que tú nos entregas al escribirnos por el sitio:</p>
            <ul className="legal__list">
              <li className="legal__item">Tu nombre, correo electrónico y, si lo indicas, tu teléfono.</li>
              <li className="legal__item">
                Lo que cuentas de tu solicitud: el mensaje, el tipo de propiedad, la comuna, la propiedad que te interesa y la fecha que
                propones para una reunión.
              </li>
              <li className="legal__item">
                La dirección IP desde la que se envió el formulario, que usamos solo para frenar envíos masivos y borramos pasado un día.
              </li>
            </ul>
            <p>
              No pedimos datos sensibles, no compramos bases de datos y no armamos perfiles de quienes visitan el sitio. Si nos escribes por
              WhatsApp, correo o teléfono, recibimos lo que nos cuentes por ese medio.
            </p>
          </div>

          <div className="legal__section">
            <h2 className="legal__title">Para qué los usamos</h2>
            <ul className="legal__list">
              <li className="legal__item">Responder tu consulta y coordinar la reunión, visita o tasación que pidas.</li>
              <li className="legal__item">
                Hacer seguimiento de tu interés en una propiedad mientras dure la gestión, para no pedirte la misma información dos veces.
              </li>
              <li className="legal__item">Enviarte la confirmación de que recibimos tu solicitud.</li>
              <li className="legal__item">Proteger el sitio y sus formularios contra el abuso y el spam.</li>
            </ul>
            <p>
              Lo hacemos con tu consentimiento, que nos das al marcar la casilla del formulario, y para tomar las medidas que nos pides antes
              de contratar un servicio. Puedes retirar tu consentimiento cuando quieras, sin efecto retroactivo. No usamos tus datos para
              publicidad ni los vendemos.
            </p>
          </div>

          <div className="legal__section">
            <h2 className="legal__title">Con quién los compartimos</h2>
            <p>No compartimos tus datos con terceros sin tu autorización. Para funcionar, el sitio usa estos proveedores, que los tratan por encargo nuestro:</p>
            <ul className="legal__list">
              <li className="legal__item">
                <strong>Cloudflare</strong>: aloja el sitio y la base de datos donde quedan las solicitudes, y mide visitas de forma agregada,
                sin cookies.
              </li>
              <li className="legal__item">
                <strong>Resend</strong>: envía los correos de aviso y de confirmación.
              </li>
            </ul>
            <p>
              Estos proveedores pueden guardar la información en servidores fuera de Chile, como Estados Unidos. Además, entregaremos datos
              cuando una autoridad competente lo exija conforme a la ley.
            </p>
          </div>

          <div className="legal__section">
            <h2 className="legal__title">Cookies y servicios de terceros</h2>
            <p>
              El sitio público no usa cookies de publicidad ni de seguimiento, por eso no te pedimos aceptarlas. La única cookie propia es la
              de sesión del acceso corporativo, que solo usa nuestro equipo. Para contar las visitas de cada ficha, el navegador guarda una
              marca temporal que se borra al cerrar la pestaña y que no te identifica.
            </p>
            <p>Algunas partes del sitio cargan contenido de terceros, que se rige por sus propias políticas:</p>
            <ul className="legal__list">
              <li className="legal__item">El mapa de la oficina en Contacto es de Google Maps.</li>
              <li className="legal__item">El mapa de propiedades de la portada usa imágenes de OpenStreetMap.</li>
              <li className="legal__item">Los botones de WhatsApp abren una conversación en ese servicio.</li>
            </ul>
          </div>

          <div className="legal__section">
            <h2 className="legal__title">Cuánto tiempo los guardamos</h2>
            <p>
              Conservamos tu solicitud mientras la estemos atendiendo y mientras dure la gestión comercial que nazca de ella. Después la
              eliminamos, salvo que una obligación legal nos pida guardarla por más tiempo. La dirección IP se borra pasado un día. Puedes
              pedirnos que borremos tu solicitud antes.
            </p>
          </div>

          <div className="legal__section">
            <h2 className="legal__title">Tus derechos</h2>
            <p>Conforme a la ley chilena de protección de datos personales, puedes pedirnos:</p>
            <ul className="legal__list">
              <li className="legal__item">
                <strong>Acceso</strong>: saber qué datos tuyos tenemos y para qué.
              </li>
              <li className="legal__item">
                <strong>Rectificación</strong>: corregir los que estén incompletos o equivocados.
              </li>
              <li className="legal__item">
                <strong>Supresión</strong>: que los eliminemos.
              </li>
              <li className="legal__item">
                <strong>Oposición</strong>: que dejemos de usarlos para un fin determinado.
              </li>
              <li className="legal__item">
                <strong>Portabilidad</strong>: recibirlos en un formato de uso común.
              </li>
              <li className="legal__item">
                <strong>Bloqueo</strong>: que suspendamos su uso mientras revisamos una solicitud tuya.
              </li>
            </ul>
            <p>
              Escríbenos a <a href={`mailto:${site.email}`}>{site.email}</a> con tu nombre, el derecho que quieres ejercer y un correo o
              teléfono de contacto. Es gratis. Te responderemos dentro de 30 días corridos. Si no quedas conforme con la respuesta, puedes
              reclamar ante la Agencia de Protección de Datos Personales.
            </p>
          </div>

          <div className="legal__section">
            <h2 className="legal__title">Cómo los protegemos</h2>
            <p>
              El sitio funciona solo por conexión cifrada (HTTPS). Las solicitudes quedan en una base de datos a la que accede únicamente
              nuestro equipo, con cuentas personales y contraseña. Registramos los ingresos al área interna y no guardamos los datos de las
              personas en los registros técnicos.
            </p>
          </div>

          <div className="legal__section">
            <h2 className="legal__title">Cambios a esta política</h2>
            <p>
              Si cambiamos la forma en que tratamos tus datos, actualizaremos esta página y su fecha. Revisa también nuestros{' '}
              <Link href="/terminos">términos y condiciones</Link>.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
