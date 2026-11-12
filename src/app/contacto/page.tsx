import type { Metadata } from 'next';
import { Icon } from '@/components/Icon';
import { Illustration } from '@/components/Illustration';
import { LeadForm } from '@/components/LeadForm';
import { PageHero } from '@/components/PageHero';
import { site, whatsappHref } from '@/data/site';

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Agenda una reunión con Cota Clara para vender, arrendar, tasar o administrar tu propiedad.',
};

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
                <Icon name="clock" className="contact__icon" />
                <div>
                  <p className="contact__label">Horario</p>
                  <p className="contact__value">{site.horario}</p>
                </div>
              </li>
            </ul>
            <div className="contact__map">
              <Illustration variant="mapa" seed={2} etiqueta="Cota Clara" label={`Ubicación referencial: ${site.direccion}`} />
            </div>
            <div className="contact__privacy" id="privacidad">
              <p className="contact__label">Privacidad</p>
              <p className="contact__text">
                Usamos tus datos solo para responder tu solicitud. No los compartimos con terceros sin tu autorización y puedes pedir que los
                eliminemos escribiendo a {site.email}.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
