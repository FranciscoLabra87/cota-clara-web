import { Suspense } from 'react';
import { PageHero } from './PageHero';
import { PropertyExplorer } from './PropertyExplorer';
import type { Propiedad } from '@/data/properties';

// El explorador corre en el navegador y recibe la lista completa. La tarjeta
// muestra solo la portada y los datos cortos: mandar además la descripción,
// las características y la galería entera de cada propiedad engordaba la
// página con texto y direcciones de fotos que nadie llegaba a ver acá.
const paraListado = (p: Propiedad): Propiedad => ({
  ...p,
  descripcion: [],
  caracteristicas: [],
  ...(p.imagenes?.length ? { imagenes: p.imagenes.slice(0, 1) } : {}),
});

type Props = { title: string; lead: string; propiedades: Propiedad[]; miga?: string };

/** El listado con filtros: lo comparten /propiedades y las páginas de cada segmento. */
export function ListadoPropiedades({ title, lead, propiedades, miga = title }: Props) {
  return (
    <>
      <PageHero migas={[{ href: '/', label: 'Inicio' }, { label: miga }]} title={title} lead={lead} />
      <section className="section section--tint section--after-hero">
        <div className="container">
          <Suspense fallback={<p className="explorer__count">Cargando propiedades…</p>}>
            <PropertyExplorer propiedades={propiedades.map(paraListado)} />
          </Suspense>
        </div>
      </section>
    </>
  );
}
