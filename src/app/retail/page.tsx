import type { Metadata } from 'next';
import { ListadoPropiedades } from '@/components/ListadoPropiedades';
import { segmentos } from '@/data/properties';
import { propiedadesPublicadas } from '@/lib/propiedades';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Retail: propiedades usadas',
  description: 'Departamentos, casas y oficinas usados en venta y arriendo.',
  alternates: { canonical: segmentos.usado.href },
};

export default async function RetailPage() {
  return (
    <ListadoPropiedades
      title={segmentos.usado.label}
      lead={segmentos.usado.lead}
      propiedades={await propiedadesPublicadas('usado')}
    />
  );
}
