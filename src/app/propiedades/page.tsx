import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHero } from '@/components/PageHero';
import { PropertyExplorer } from '@/components/PropertyExplorer';
import { propiedadesPublicadas } from '@/lib/propiedades';

// El inventario vive en D1: la página se arma en cada visita para que lo que
// se publica desde el panel aparezca al tiro, sin pasar por un deploy.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Propiedades en venta y arriendo',
  description: 'Departamentos, casas y oficinas en venta y arriendo en Providencia, Las Condes, Vitacura, Ñuñoa, La Reina y Lo Barnechea.',
};

export default async function PropiedadesPage() {
  const propiedades = await propiedadesPublicadas();

  return (
    <>
      <PageHero
        migas={[{ href: '/', label: 'Inicio' }, { label: 'Propiedades' }]}
        title="Propiedades en venta y arriendo"
        lead="Cada precio está respaldado por un informe de valor. Filtra por comuna, tipo y presupuesto."
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
