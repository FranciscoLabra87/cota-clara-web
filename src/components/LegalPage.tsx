import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHero } from './PageHero';
import { site } from '@/data/site';

type Props = {
  titulo: string;
  resumen: string;
  ruta: '/privacidad' | '/terminos' | '/cookies';
  children: ReactNode;
};

const paginas = [
  { href: '/privacidad', label: 'Privacidad' },
  { href: '/terminos', label: 'Términos de uso' },
  { href: '/cookies', label: 'Cookies y preferencias' },
] as const;

export function LegalPage({ titulo, resumen, ruta, children }: Props) {
  return (
    <>
      <PageHero migas={[{ href: '/', label: 'Inicio' }, { label: titulo }]} title={titulo} lead={resumen} />
      <section className="section section--after-hero">
        <div className="container legal">
          <nav className="legal__nav" aria-label="Información legal">
            {paginas.map((pagina) => (
              <Link className="legal__nav-link" key={pagina.href} href={pagina.href} aria-current={ruta === pagina.href ? 'page' : undefined}>
                {pagina.label}
              </Link>
            ))}
          </nav>
          <article className="legal__content" aria-label={titulo}>
            <p className="legal__updated">Última actualización: 26 de noviembre de 2026.</p>
            {children}
            <aside className="legal__contact" aria-labelledby="legal-contacto">
              <h2 id="legal-contacto">Contacto</h2>
              <p>
                Cota Clara · Patrimonio Inmobiliario<br />
                <a href={`mailto:${site.email}`}>{site.email}</a><br />
                {site.direccion}, Santiago, Chile.
              </p>
            </aside>
          </article>
        </div>
      </section>
    </>
  );
}
