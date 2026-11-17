import type { Metadata } from 'next';
import { ListadoPropiedades } from '@/components/ListadoPropiedades';
import { segmentos } from '@/data/properties';
import { propiedadesPublicadas } from '@/lib/propiedades';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Proyectos de inversión',
  description: 'Proyectos inmobiliarios nuevos para invertir o para vivir: departamentos y casas a estrenar.',
  alternates: { canonical: segmentos.nuevo.href },
};

export default async function ProyectosDeInversionPage() {
  return (
    <ListadoPropiedades
      title={segmentos.nuevo.label}
      lead={segmentos.nuevo.lead}
      propiedades={await propiedadesPublicadas('nuevo')}
    />
  );
}
