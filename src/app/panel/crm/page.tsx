import Link from 'next/link';
import { segmentos, tituloPropiedad } from '@/data/properties';
import { nombreActividad, resumenes } from '@/lib/crm';
import { horaDeChile } from '@/lib/fecha';
import { formatNumero } from '@/lib/format';
import { exigirSesion } from '@/lib/guardias';
import { propiedadesDelPanel } from '@/lib/propiedades';
import { visitasPorPropiedad } from '@/lib/visitas';

export const dynamic = 'force-dynamic';

export default async function CrmPage() {
  await exigirSesion();

  const [propiedades, numeros, visitas] = await Promise.all([propiedadesDelPanel(), resumenes(), visitasPorPropiedad()]);

  // Arriba las que tuvieron movimiento más reciente; después las que tienen
  // interesados sin contacto registrado, y al final las que no tienen nada.
  const filas = propiedades
    .map((p) => ({ p, r: numeros.get(p.id), v: visitas.get(p.id) }))
    .sort((a, b) => {
      const fa = a.r?.ultimo?.fecha ?? '';
      const fb = b.r?.ultimo?.fecha ?? '';
      if (fa !== fb) return fb.localeCompare(fa);
      return (b.r?.activos ?? 0) - (a.r?.activos ?? 0);
    });

  return (
    <>
      <h1 className="panel__title">CRM</h1>
      <p className="panel__intro">
        Qué pasa con cada propiedad: interesados, llamadas, visitas físicas y el último contacto. Entra a una para ver su tablero y
        registrar lo que dijo cada cliente.
      </p>

      {filas.length === 0 ? (
        <p className="panel__intro">Todavía no hay propiedades cargadas.</p>
      ) : (
        <div className="panel__tabla-envoltorio">
          <table className="panel__tabla">
            <thead>
              <tr>
                <th scope="col">Propiedad</th>
                <th scope="col">Visitas web</th>
                <th scope="col">Interesados</th>
                <th scope="col">Llamadas</th>
                <th scope="col">Visitas físicas</th>
                <th scope="col">Último contacto</th>
                <th scope="col">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ p, r, v }) => (
                <tr key={p.id} className={p.estado === 'PUBLICADA' ? undefined : 'panel__fila--inactiva'}>
                  <td>
                    {tituloPropiedad(p)}
                    <span className="panel__dato panel__dato--suave">
                      {segmentos[p.condicion].label} · {p.estado === 'PUBLICADA' ? 'Publicada' : 'Borrador'}
                    </span>
                  </td>
                  <td>
                    {formatNumero(v?.total ?? 0)}
                    <span className="panel__dato panel__dato--suave">{formatNumero(v?.semana ?? 0)} en 7 días</span>
                  </td>
                  <td>
                    {formatNumero(r?.activos ?? 0)}
                    <span className="panel__dato panel__dato--suave">de {formatNumero(r?.interesados ?? 0)}</span>
                  </td>
                  <td>{formatNumero(r?.llamadas ?? 0)}</td>
                  <td>{formatNumero(r?.visitas ?? 0)}</td>
                  <td>
                    {r?.ultimo ? (
                      <>
                        {nombreActividad(r.ultimo.tipo)} · {r.ultimo.usuarioNombre ?? 'Sitio web'} con {r.ultimo.interesadoNombre}
                        <span className="panel__dato panel__dato--suave">{horaDeChile(r.ultimo.fecha)}</span>
                      </>
                    ) : (
                      <span className="panel__dato--suave">Sin contactos</span>
                    )}
                  </td>
                  <td className="panel__acciones">
                    <Link className="panel__accion" href={`/panel/propiedades/${p.id}/seguimiento`}>
                      Seguimiento
                    </Link>
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
