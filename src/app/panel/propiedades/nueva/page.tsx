import Link from 'next/link';
import { PropiedadForm } from '@/components/PropiedadForm';
import { comunas } from '@/data/site';
import { exigirSesion } from '@/lib/guardias';

export const dynamic = 'force-dynamic';

export default async function NuevaPropiedadPage() {
  await exigirSesion();

  return (
    <>
      <Link className="panel__volver" href="/panel/propiedades">
        ← Volver a propiedades
      </Link>
      <h1 className="panel__title">Nueva propiedad</h1>
      <p className="panel__intro">
        Parte en borrador si todavía te falta información. Las fotos se cargan después de crearla.
      </p>
      <PropiedadForm comunas={[...comunas]} />
    </>
  );
}
