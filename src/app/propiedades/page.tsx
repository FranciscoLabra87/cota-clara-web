import type { Metadata } from 'next';
import { ListadoPropiedades } from '@/components/ListadoPropiedades';
import { propiedadesPublicadas } from '@/lib/propiedades';

// El inventario vive en D1: la página se arma en cada visita para que lo que
// se publica desde el panel aparezca al tiro, sin pasar por un deploy.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Propiedades en venta y arriendo',
  description: 'Departamentos, casas y oficinas en venta y arriendo en las regiones Metropolitana, de Valparaíso y de Coquimbo.',
};

// Todo el inventario junto. Ya no está en el menú, que separa los dos
// segmentos, pero lo usan el buscador de la portada y los enlaces antiguos.
export default async function PropiedadesPage() {
  return (
    <ListadoPropiedades
      title="Propiedades en venta y arriendo"
      miga="Propiedades"
      lead="Explora las propiedades disponibles y filtra por comuna, tipo y presupuesto."
      propiedades={await propiedadesPublicadas()}
    />
  );
}
