import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHero } from '@/components/PageHero';
import { PropertyExplorer } from '@/components/PropertyExplorer';
import type { Propiedad } from '@/data/properties';
import { propiedadesPublicadas } from '@/lib/propiedades';

// El inventario vive en D1: la página se arma en cada visita para que lo que
// se publica desde el panel aparezca al tiro, sin pasar por un deploy.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Propiedades en venta y arriendo',
  description: 'Departamentos, casas y oficinas en venta y arriendo en las regiones Metropolitana, de Valparaíso y de Coquimbo.',
};

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

export default async function PropiedadesPage() {
  const propiedades = (await propiedadesPublicadas()).map(paraListado);

  return (
    <>
      <PageHero
        migas={[{ href: '/', label: 'Inicio' }, { label: 'Propiedades' }]}
        title="Propiedades en venta y arriendo"
        lead="Explora las propiedades disponibles y filtra por comuna, tipo y presupuesto."
      />
      <section className="section section--tint section--after-hero">
        <div className="container">
          <Suspense fallback={<p className="explorer__count">Cargando propiedades…</p>}>
            <PropertyExplorer propiedades={propiedades} />
          </Suspense>
        </div>
      </section>
    </>
  );
}
