import Link from 'next/link';
import { exigirSesion } from '@/lib/guardias';
import { propiedadesDelPanel } from '@/lib/propiedades';
import { tituloPropiedad } from '@/data/properties';
import { formatPrecio } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function FichasPage() {
  await exigirSesion();
  const propiedades = await propiedadesDelPanel();
  return <>
    <h1 className="panel__title">Fichas técnicas</h1>
    <p className="panel__intro">Selecciona una propiedad, completa sus antecedentes y genera una ficha con la identidad de Cota Clara para imprimir o guardar en PDF.</p>
    <div className="panel__grid">
      {propiedades.map((p) => <article key={p.id} className="panel__card">
        <span className="panel__badge">CC-{p.id} · {p.estado === 'PUBLICADA' ? 'Publicada' : 'Borrador'}</span>
        <h2 className="panel__card-title">{tituloPropiedad(p)}</h2>
        <p className="panel__card-text">{p.comuna} · {formatPrecio(p.precio)}{p.precio.periodo === 'mes' ? ' / mes' : ''}</p>
        <Link className="button button--primary button--sm" href={`/panel/propiedades/${p.id}/ficha`}>Preparar ficha</Link>
      </article>)}
    </div>
    {!propiedades.length ? <p>Todavía no hay propiedades. <Link href="/panel/propiedades/nueva">Crear una propiedad</Link>.</p> : null}
  </>;
}
