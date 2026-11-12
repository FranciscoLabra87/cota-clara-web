import Link from 'next/link';
import { PageHero } from '@/components/PageHero';

export default function NotFound() {
  return (
    <>
      <PageHero migas={[{ href: '/', label: 'Inicio' }, { label: 'Página no encontrada' }]} title="No encontramos esta página" lead="Puede que la propiedad ya no esté disponible o que la dirección haya cambiado.">
        <div className="page-hero__actions">
          <Link className="button button--primary" href="/propiedades">
            Ver propiedades
          </Link>
          <Link className="button button--outline-light" href="/">
            Ir al inicio
          </Link>
        </div>
      </PageHero>
    </>
  );
}
