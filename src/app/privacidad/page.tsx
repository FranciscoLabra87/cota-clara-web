import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { site } from '@/data/site';
import { metadatosPagina } from '@/lib/metadata';

export const metadata = metadatosPagina(
  'Política de privacidad',
  'Conoce qué datos trata Cota Clara, para qué los utiliza y cómo solicitar su acceso, corrección o eliminación.',
  '/privacidad',
);

export default function PrivacidadPage() {
  return (
    <LegalPage titulo="Política de privacidad" resumen="Cómo tratamos tus datos al consultar una propiedad, pedir un servicio o utilizar el acceso corporativo." ruta="/privacidad">
      <section>
        <h2>Quién recibe tus datos</h2>
        <p>
          Cota Clara · Patrimonio Inmobiliario recibe y gestiona las solicitudes de este sitio. Para consultas sobre tus datos, escribe a{' '}
          <a href={`mailto:${site.email}`}>{site.email}</a>. Nuestra oficina está en {site.direccion}, Santiago.
        </p>
      </section>
      <section>
        <h2>Qué información tratamos y para qué</h2>
        <ul>
          <li><strong>Consultas y solicitudes:</strong> nombre, correo, teléfono y los antecedentes que entregues sobre tu propiedad, visita o servicio. Los usamos para responder, coordinar la atención y dar seguimiento a tu solicitud.</li>
          <li><strong>Gestión inmobiliaria:</strong> el equipo autorizado puede registrar contactos, etapas, conversaciones, tareas y documentos necesarios para atender una operación o un encargo.</li>
          <li><strong>Acceso corporativo:</strong> datos de la cuenta, rol, sesiones y registros de actividad para identificar a usuarios autorizados y proteger el panel y los archivos internos.</li>
          <li><strong>Seguridad:</strong> datos técnicos de las solicitudes, como la dirección IP, para limitar envíos abusivos y detectar problemas de acceso.</li>
        </ul>
        <p>
          Los campos obligatorios de cada formulario permiten gestionar esa solicitud; los opcionales los decides tú. Evita incluir datos sensibles o documentos de otras personas que no sean necesarios para la consulta.
        </p>
        <p>La autorización para responder un formulario no constituye una suscripción a campañas publicitarias.</p>
      </section>
      <section>
        <h2>Proveedores y comunicaciones</h2>
        <p>
          Usamos servicios de Cloudflare para alojar el sitio, guardar información en D1 y almacenar fotografías y archivos en R2. Los avisos y respuestas por correo se envían mediante Resend o el proveedor de correo SMTP habilitado para el sitio. Estos servicios procesan la información necesaria para prestar sus funciones y pueden operar fuera de Chile.
        </p>
        <p>
          El acceso interno se limita según los permisos de cada usuario. Si una gestión requiere comunicar antecedentes a un propietario, contraparte o profesional que participe en tu encargo, te informaremos y solicitaremos la autorización que corresponda. También podremos atender requerimientos de una autoridad cuando exista una obligación legal.
        </p>
        <p>
          Al cargar los mapas se realizan conexiones con OpenStreetMap o Google Maps, que pueden recibir información técnica de tu conexión. Al abrir WhatsApp o nuestras redes sociales, interactúas además con los servicios de esas plataformas y sus políticas de privacidad.
        </p>
      </section>
      <section>
        <h2>Estadísticas y preferencias</h2>
        <p>
          El sitio utiliza Cloudflare Web Analytics para medir uso y rendimiento sin cookies de analítica. El contador propio de las fichas suma visitas por propiedad y día, sin guardar la IP ni un identificador del visitante.
        </p>
        <p>
          Google Analytics 4 es opcional: solo se activa si está configurado y aceptas la analítica. Puedes rechazarla o retirar tu consentimiento desde la{' '}
          <Link href="/cookies">página de cookies y preferencias</Link>.
        </p>
      </section>
      <section>
        <h2>Conservación y seguridad</h2>
        <p>
          Conservamos las consultas y los antecedentes de gestión mientras sean necesarios para atenderlas, mantener la relación solicitada o cumplir obligaciones aplicables. No asignamos el mismo plazo a todas las operaciones; puedes consultar por un registro específico o pedir su eliminación.
        </p>
        <p>
          La IP asociada al formulario se utiliza para prevenir abusos. El sistema elimina ese dato de las solicitudes con más de 24 horas al procesar nuevos envíos. Las sesiones corporativas caducan a los siete días y pueden cerrarse antes. Otros registros de seguridad se gestionan según su finalidad.
        </p>
        <p>Utilizamos conexiones HTTPS, controles de acceso y permisos por rol para resguardar la información.</p>
      </section>
      <section>
        <h2>Cómo ejercer tus derechos</h2>
        <p>
          Puedes solicitar información sobre tus datos, su origen, uso y destinatarios; pedir que se corrijan antecedentes inexactos; y solicitar su eliminación, bloqueo o dejar de recibir comunicaciones, según corresponda conforme a la Ley N.º 19.628 y la normativa aplicable.
        </p>
        <p>
          Escribe a <a href={`mailto:${site.email}`}>{site.email}</a> indicando tu solicitud y un medio de contacto. Podemos pedir los antecedentes mínimos para verificar tu identidad y proteger tus datos. Si debemos conservar algún antecedente por una obligación aplicable, te explicaremos el motivo.
        </p>
      </section>
    </LegalPage>
  );
}
