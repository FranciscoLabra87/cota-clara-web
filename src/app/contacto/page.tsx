import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { LeadForm } from '@/components/LeadForm';
import { PageHero } from '@/components/PageHero';
import { mapaEmbed, mapaHref, site, whatsappHref } from '@/data/site';
import { metadatosPagina } from '@/lib/metadata';

export const metadata = metadatosPagina(
  'Contacto',
  'Agenda una reunión con Cota Clara para vender, arrendar, tasar o administrar tu propiedad.',
  '/contacto',
);

export default function ContactoPage() {
  return (
    <>
      <PageHero
        migas={[{ href: '/', label: 'Inicio' }, { label: 'Contacto' }]}
        title="¿Conversemos?"
        lead="Cuéntanos qué necesitas: vender, arrendar, tasar o administrar. Te respondemos en un día hábil."
      />
      <section className="section section--after-hero section--tint">
        <div className="container contact">
          <div className="contact__form">
            <LeadForm variante="contacto" titulo="Escríbenos" bajada="Todos los campos, salvo los opcionales, son necesarios." boton="Enviar mensaje" />
          </div>
          <div className="contact__info">
            <ul className="contact__list">
              <li className="contact__item">
                <Icon name="phone" className="contact__icon" />
                <div>
                  <p className="contact__label">Teléfono</p>
                  <a className="contact__value" href={`tel:${site.telefonoHref}`}>
                    {site.telefono}
                  </a>
                </div>
              </li>
              <li className="contact__item">
                <Icon name="mail" className="contact__icon" />
                <div>
                  <p className="contact__label">Correo</p>
                  <a className="contact__value" href={`mailto:${site.email}`}>
                    {site.email}
                  </a>
                </div>
              </li>
              <li className="contact__item">
                <Icon name="whatsapp" className="contact__icon" />
                <div>
                  <p className="contact__label">WhatsApp</p>
                  <a className="contact__value" href={whatsappHref()} target="_blank" rel="noopener noreferrer">
                    Escríbenos
                  </a>
                </div>
              </li>
              <li className="contact__item">
                <Icon name="pin" className="contact__icon" />
                <div>
                  <p className="contact__label">Oficina</p>
                  <a className="contact__value" href={mapaHref} target="_blank" rel="noopener noreferrer">
                    {site.calle}
                  </a>
                  <p className="contact__text">
                    {site.edificio}, {site.comuna}
                  </p>
                </div>
              </li>
              <li className="contact__item">
                <Icon name="clock" className="contact__icon" />
                <div>
                  <p className="contact__label">Horario</p>
                  <p className="contact__value">{site.horario}</p>
                </div>
              </li>
            </ul>
            <div className="contact__brand">
              <span className="contact__brand-label">Cota Clara · Patrimonio Inmobiliario</span>
              <p className="contact__brand-motto">{site.lema}</p>
              <p className="contact__brand-location">{site.direccion}</p>
            </div>
            <div className="contact__privacy" id="privacidad">
              <p className="contact__label">Privacidad</p>
              <p className="contact__text">
                Usamos los datos del formulario para responder y dar seguimiento a tu solicitud. Conoce los proveedores que intervienen y cómo
                solicitar acceso, corrección o eliminación en nuestra <Link href="/privacidad">política de privacidad</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="oficina-titulo">
        <div className="container office-map">
          <div className="office-map__info">
            <span className="eyebrow">Dónde estamos</span>
            <h2 className="office-map__title" id="oficina-titulo">
              Nuestra oficina
            </h2>
            <address className="office-map__address">
              {site.calle}
              <br />
              {site.edificio}
              <br />
              {site.comuna}, Santiago
            </address>
            <p className="office-map__hours">{site.horario}</p>
            <a className="button button--primary" href={mapaHref} target="_blank" rel="noopener noreferrer">
              Cómo llegar
            </a>
          </div>
          <div className="office-map__frame">
            <iframe
              className="office-map__iframe"
              src={mapaEmbed}
              title={`Mapa de la oficina de Cota Clara en ${site.direccion}`}
              loading="lazy"
              allowFullScreen
            />
          </div>
        </div>
      </section>
    </>
  );
}
