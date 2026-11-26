import type { Metadata } from 'next';
import { ListadoPropiedades } from '@/components/ListadoPropiedades';
import { segmentos } from '@/data/properties';
import { propiedadesPublicadas } from '@/lib/propiedades';
import { metadatosPagina } from '@/lib/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = metadatosPagina(
  'Retail: propiedades usadas',
  'Departamentos, casas y oficinas usados en venta y arriendo.',
  segmentos.usado.href,
);

export default async function RetailPage() {
  return (
    <ListadoPropiedades
      title={segmentos.usado.label}
      lead={segmentos.usado.lead}
      propiedades={await propiedadesPublicadas('usado')}
    />
  );
}
