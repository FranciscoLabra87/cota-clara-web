import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FichaTecnicaEditor } from '@/components/FichaTecnicaEditor';
import { exigirSesion } from '@/lib/guardias';
import { propiedadPorId } from '@/lib/propiedades';
import { fichaDe } from '@/lib/ficha-tecnica';
import { idDeRuta } from '@/lib/panel-api';
import { tituloPropiedad } from '@/data/properties';

export const dynamic = 'force-dynamic';

export default async function FichaPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSesion();
  const id = idDeRuta((await params).id);
  if (!id) notFound();
  const propiedad = await propiedadPorId(id);
  if (!propiedad) notFound();
  const antecedentes = await fichaDe(id);
  const emitida = new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeZone: 'America/Santiago' }).format(new Date());
  return <>
    <div className="ficha-tool__heading">
      <Link className="panel__volver" href="/panel/fichas">← Volver a fichas</Link>
      <h1 className="panel__title">{tituloPropiedad(propiedad)}</h1>
      <p className="panel__intro">Ficha técnico-legal CC-{id} · <Link href={`/panel/propiedades/${id}`}>Editar datos del aviso</Link></p>
      <p><Link className="button button--outline button--sm" href={`/panel/propiedades/${id}/ficha/comercial`}>Ir a la ficha comercial</Link></p>
    </div>
    <FichaTecnicaEditor propiedad={propiedad} antecedentes={antecedentes} emitida={emitida} />
  </>;
}
