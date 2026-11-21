import Link from 'next/link';
import { segmentos, tituloPropiedad } from '@/data/properties';
import { formatNumero } from '@/lib/format';
import { exigirSesion } from '@/lib/guardias';
import { propiedadesDelPanel } from '@/lib/propiedades';

export const dynamic = 'force-dynamic';

/**
 * La entrada al stock desde el panel. Lista los proyectos de inversión en
 * venta, que son los únicos que admiten unidades, con lo que queda de cada
 * uno. El resumen viene en la propiedad: propiedadesDelPanel() ya lo trae en
 * una sola consulta para todo el listado.
 */
export default async function ProyectosPage() {
  await exigirSesion();

  const proyectos = (await propiedadesDelPanel()).filter((p) => p.condicion === 'nuevo' && p.operacion === 'venta');

  return (
    <>
      <div className="panel__cabecera">
        <h1 className="panel__title">Proyectos y stock</h1>
        <Link className="button button--primary button--sm" href="/panel/propiedades/nueva">
          Nuevo proyecto
        </Link>
      </div>
      <p className="panel__intro">
        Los {segmentos.nuevo.label.toLowerCase()} en venta admiten stock por unidades: tipologías, precios y disponibilidad.
        Lo que quede disponible fija el «desde» del aviso.
      </p>

      {proyectos.length === 0 ? (
        <p className="panel__intro">
          Todavía no hay proyectos. En la propiedad, elige el segmento «{segmentos.nuevo.corto}» y la operación venta para poder
          cargarle unidades.
        </p>
      ) : (
        <div className="panel__tabla-envoltorio">
          <table className="panel__tabla">
            <thead>
              <tr>
                <th scope="col">Proyecto</th>
                <th scope="col">Comuna</th>
                <th scope="col">Unidades</th>
                <th scope="col">Disponibles</th>
                <th scope="col">Desde</th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {proyectos.map((p) => (
                <tr key={p.id} className={p.estado === 'PUBLICADA' ? undefined : 'panel__fila--inactiva'}>
                  <td>{tituloPropiedad(p)}</td>
                  <td>{p.comuna}</td>
                  <td>{formatNumero(p.stock?.total ?? 0)}</td>
                  <td>
                    {formatNumero(p.stock?.disponibles ?? 0)}
                    {p.stock?.total && !p.stock.disponibles ? (
                      <span className="panel__dato panel__dato--suave">sin stock</span>
                    ) : null}
                  </td>
                  <td>{p.stock?.desdeUF ? `UF ${formatNumero(p.stock.desdeUF)}` : '—'}</td>
                  <td>{p.estado === 'PUBLICADA' ? 'Publicada' : 'Borrador'}</td>
                  <td className="panel__acciones">
                    <Link className="panel__accion" href={`/panel/propiedades/${p.id}/unidades`}>
                      Stock y unidades
                    </Link>
                    <Link className="panel__accion" href={`/panel/propiedades/${p.id}`}>
                      Editar
                    </Link>
                    <Link className="panel__accion" href={`/panel/propiedades/${p.id}/seguimiento`}>
                      Seguimiento
                    </Link>
                    {p.estado === 'PUBLICADA' ? (
                      <Link className="panel__accion" href={`/propiedades/${p.slug}`} target="_blank" rel="noopener noreferrer">
                        Ver
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
