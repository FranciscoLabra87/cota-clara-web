import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHero } from '@/components/PageHero';
import { PropertyExplorer } from '@/components/PropertyExplorer';
import { propiedades } from '@/data/properties';

export const metadata: Metadata = {
  title: 'Propiedades en venta y arriendo',
  description: 'Departamentos, casas y oficinas en venta y arriendo en Providencia, Las Condes, Vitacura, Ñuñoa, La Reina y Lo Barnechea.',
};

export default function PropiedadesPage() {
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
