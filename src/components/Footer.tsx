import Link from 'next/link';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { comunas, site, whatsappHref } from '@/data/site';
import { servicios } from '@/data/services';

export function Footer() {
  const anio = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <Logo variant="negativo" />
            <p className="site-footer__concept">{site.concepto}</p>
            <p className="site-footer__motto">{site.lema}</p>
          </div>

          <nav className="site-footer__col" aria-label="Servicios">
            <h2 className="site-footer__title">Servicios</h2>
            <ul className="site-footer__list">
              {servicios.map((s) => (
                <li key={s.slug}>
                  <Link className="site-footer__link" href={`/servicios/${s.slug}`}>
                    {s.nombre}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="site-footer__col" aria-label="Propiedades por comuna">
            <h2 className="site-footer__title">Propiedades</h2>
            <ul className="site-footer__list">
              {comunas.slice(0, 5).map((c) => (
                <li key={c}>
                  <Link className="site-footer__link" href={`/propiedades?comuna=${encodeURIComponent(c)}`}>
                    {c}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="site-footer__col site-footer__col--contact">
            <h2 className="site-footer__title">Contacto</h2>
            <ul className="site-footer__list">
              <li>
                <a className="site-footer__link site-footer__link--icon" href={`tel:${site.telefonoHref}`}>
                  <Icon name="phone" /> {site.telefono}
                </a>
              </li>
              <li>
                <a className="site-footer__link site-footer__link--icon" href={`mailto:${site.email}`}>
                  <Icon name="mail" /> {site.email}
                </a>
              </li>
              <li>
                <a className="site-footer__link site-footer__link--icon" href={whatsappHref()} target="_blank" rel="noopener noreferrer">
                  <Icon name="whatsapp" /> WhatsApp
                </a>
              </li>
              <li className="site-footer__text site-footer__link--icon">
                <Icon name="pin" /> {site.direccion}
              </li>
            </ul>
          </div>
        </div>

        <div className="site-footer__bottom">
          <p>
            © {anio} {site.nombre} · {site.bajada}
          </p>
          <ul className="site-footer__legal">
            <li>
              <Link className="site-footer__link" href="/contacto">
                Política de privacidad
              </Link>
            </li>
            <li>
              <Link className="site-footer__link" href="/servicios/corretaje#honorarios">
                Qué cobramos y por qué
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
