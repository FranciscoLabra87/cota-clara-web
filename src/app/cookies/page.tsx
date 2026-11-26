import Link from 'next/link';
import { CookiePreferencesButton } from '@/components/CookiePreferencesButton';
import { LegalPage } from '@/components/LegalPage';
import { metadatosPagina } from '@/lib/metadata';

export const metadata = metadatosPagina(
  'Cookies y preferencias',
  'Revisa las cookies necesarias y la analítica opcional de Cota Clara, y administra tus preferencias.',
  '/cookies',
);

export default function CookiesPage() {
  return (
    <LegalPage titulo="Cookies y preferencias" resumen="Puedes navegar y consultar propiedades sin aceptar la analítica opcional." ruta="/cookies">
      <section>
        <h2>Elige qué permites</h2>
        <p>
          Las cookies son archivos pequeños que un sitio guarda en tu navegador. También usamos almacenamiento local para recordar tu elección. Las tecnologías necesarias permiten el acceso corporativo y la gestión de preferencias; la analítica opcional requiere tu autorización.
        </p>
        <div className="legal__actions"><CookiePreferencesButton /></div>
        <p>Puedes volver a este botón para aceptar, rechazar o cambiar tu elección en cualquier momento.</p>
      </section>
      <section>
        <h2>Tecnologías necesarias</h2>
        <dl className="legal__definitions">
          <div>
            <dt>Sesión corporativa: <code>cota_sesion</code></dt>
            <dd>Cookie propia que identifica una sesión de usuario autorizado. Caduca a los siete días y se invalida al cerrar la sesión. No se utiliza para publicidad.</dd>
          </div>
          <div>
            <dt>Preferencias: <code>cota.cookies.v1</code></dt>
            <dd>Registro en el almacenamiento local de tu navegador que guarda tu elección sobre analítica, su fecha y versión durante 180 días. Después se solicita una nueva elección. Puedes cambiarla antes o borrar el almacenamiento del navegador.</dd>
          </div>
        </dl>
        <p>Cloudflare presta servicios de seguridad y, cuando está habilitado en el acceso corporativo, Turnstile ayuda a prevenir accesos automatizados.</p>
      </section>
      <section>
        <h2>Analítica opcional: Google Analytics 4</h2>
        <p>
          Google Analytics 4 solo se carga si el sitio tiene una medición configurada y aceptas la analítica. Puede utilizar cookies como <code>_ga</code> y <code>_ga_*</code> para medir visitas y uso del sitio. Si rechazas, no se carga esta herramienta.
        </p>
        <p>
          Al retirar tu autorización se desactiva la medición y se eliminan las cookies de Google Analytics que este sitio puede borrar en su propio dominio. También puedes revisar o eliminar cookies desde tu navegador. Esto no elimina información ya recibida por Google ni cookies de dominios ajenos.
        </p>
      </section>
      <section>
        <h2>Mediciones sin cookies y mapas</h2>
        <p>
          Cloudflare Web Analytics mide uso y rendimiento sin utilizar cookies ni almacenamiento local para esa medición. El contador propio de propiedades suma visitas por ficha y día sin identificar al visitante.
        </p>
        <p>
          Los mapas de propiedades usan OpenStreetMap y el mapa de la oficina utiliza Google Maps. Al cargar un mapa, tu navegador se conecta con el proveedor correspondiente y puede comunicar datos técnicos, como la IP. Google Maps puede utilizar tecnologías propias según sus políticas; la elección sobre Google Analytics no controla esos servicios externos.
        </p>
        <p>
          Puedes consultar las políticas de{' '}
          <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare</a>,{' '}
          <a href="https://policies.google.com/privacy?hl=es" target="_blank" rel="noopener noreferrer">Google</a> y{' '}
          <a href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener noreferrer">OpenStreetMap Foundation</a>.
        </p>
      </section>
      <section>
        <h2>Control desde tu navegador</h2>
        <p>
          Puedes consultar, bloquear o borrar cookies y almacenamiento local desde los ajustes de privacidad del navegador. Si bloqueas las tecnologías necesarias, algunas funciones, como mantener abierta una sesión corporativa, pueden dejar de funcionar.
        </p>
        <p>Para conocer el tratamiento de consultas y otros datos personales, revisa nuestra <Link href="/privacidad">política de privacidad</Link>.</p>
      </section>
    </LegalPage>
  );
}
