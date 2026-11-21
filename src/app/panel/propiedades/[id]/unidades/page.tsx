import Link from 'next/link';
import { notFound } from 'next/navigation';
import { UnidadesPanel } from '@/components/UnidadesPanel';
import { segmentos, tituloPropiedad } from '@/data/properties';
import { exigirSesion } from '@/lib/guardias';
import { formatNumero } from '@/lib/format';
import { propiedadPorId } from '@/lib/propiedades';
import { stockDeProyecto } from '@/lib/unidades';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export default async function UnidadesPage({ params }: Params) {
  await exigirSesion();

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();

  const propiedad = await propiedadPorId(id);
  if (!propiedad) notFound();

  const volver = (
    <Link className="panel__volver" href={`/panel/propiedades/${id}`}>
      ← Volver a la propiedad
    </Link>
  );

  // El stock existe solo en un proyecto en venta: ver asegurarProyecto() en
  // src/lib/unidades.ts. Acá se avisa en vez de mostrar tablas que no se
  // pueden guardar.
  if (propiedad.condicion !== 'nuevo' || propiedad.operacion !== 'venta') {
    return (
      <>
        {volver}
        <h1 className="panel__title">Unidades</h1>
        <p className="panel__intro">
          El stock por unidades es solo de los proyectos de inversión en venta. Esta propiedad está como{' '}
          {segmentos[propiedad.condicion].label.toLowerCase()} en {propiedad.operacion}.
        </p>
      </>
    );
  }

  const { tipologias, unidades, resumen } = await stockDeProyecto(id);

  return (
    <>
      {volver}
      <h1 className="panel__title">Unidades · {tituloPropiedad(propiedad)}</h1>
      <p className="panel__intro">
        {resumen.total === 0
          ? 'Sin stock cargado. Mientras no haya unidades, la ficha muestra el precio escrito en la propiedad.'
          : `${formatNumero(resumen.disponibles)} de ${formatNumero(resumen.total)} disponibles.` +
            (resumen.desdeUF ? ` La ficha publica desde UF ${formatNumero(resumen.desdeUF)}.` : ' La ficha avisa que no queda stock.')}
      </p>
      <UnidadesPanel propiedadId={id} tipologias={tipologias} unidades={unidades} />
    </>
  );
}
