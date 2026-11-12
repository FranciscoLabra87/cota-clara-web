import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PropiedadForm } from '@/components/PropiedadForm';
import { nombreTipo } from '@/data/properties';
import { comunas } from '@/data/site';
import { exigirSesion } from '@/lib/guardias';
import { fotosDePropiedad, propiedadPorId } from '@/lib/propiedades';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export default async function EditarPropiedadPage({ params }: Params) {
  await exigirSesion();

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();

  const propiedad = await propiedadPorId(id);
  if (!propiedad) notFound();

  const fotos = await fotosDePropiedad(id);

  return (
    <>
      <Link className="panel__volver" href="/panel/propiedades">
        ← Volver a propiedades
      </Link>
      <h1 className="panel__title">
        {nombreTipo(propiedad.tipo)} · {propiedad.comuna}
      </h1>
      <p className="panel__intro">
        {propiedad.estado === 'PUBLICADA' ? (
          <>
            Publicada. Se ve en{' '}
            <Link href={`/propiedades/${propiedad.slug}`} target="_blank" rel="noopener noreferrer">
              /propiedades/{propiedad.slug}
            </Link>
            .
          </>
        ) : (
          'En borrador: todavía no aparece en el sitio.'
        )}
      </p>
      <PropiedadForm propiedad={propiedad} fotos={fotos} comunas={[...comunas]} />
    </>
  );
}
