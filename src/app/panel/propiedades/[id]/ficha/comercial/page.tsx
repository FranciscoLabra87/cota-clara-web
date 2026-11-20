import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FichaComercialEditor } from '@/components/FichaComercialEditor';
import { tituloPropiedad } from '@/data/properties';
import { exigirSesion } from '@/lib/guardias';
import { idDeRuta } from '@/lib/panel-api';
import { propiedadPorId } from '@/lib/propiedades';

export const dynamic = 'force-dynamic';

export default async function FichaComercialPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSesion();
  const id = idDeRuta((await params).id);
  if (!id) notFound();
  const propiedad = await propiedadPorId(id);
  if (!propiedad) notFound();

  return <>
    <div className="ficha-comercial__heading">
      <Link className="panel__volver" href="/panel/fichas">← Volver a fichas</Link>
      <p className="panel__eyebrow">Presentación comercial · CC-{id}</p>
      <h1 className="panel__title">{tituloPropiedad(propiedad)}</h1>
      <p className="panel__intro">Prepara una ficha visual para compartir con interesados. Se arma con los datos y fotos que ya tiene esta propiedad.</p>
      <div className="ficha-comercial__heading-links">
        <Link href={`/panel/propiedades/${id}`} className="ficha-comercial__edit-link">Editar datos del aviso</Link>
        <Link href={`/panel/propiedades/${id}/ficha`} className="ficha-comercial__edit-link">Abrir ficha técnico-legal</Link>
      </div>
    </div>
    <FichaComercialEditor propiedad={propiedad} />
  </>;
}
