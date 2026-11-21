import { nombreEstadoUnidad, type TipologiaConStock, type Unidad } from '@/data/properties';
import { formatNumero } from '@/lib/format';

// El stock del proyecto en la ficha pública. Solo se muestran las unidades
// disponibles y las reservadas: lo vendido y lo bloqueado no se publica, y la
// consulta ya las deja fuera (ESTADOS_PUBLICOS en src/lib/unidades.ts).

type Props = { tipologias: TipologiaConStock[]; unidades: Unidad[] };

export function TablaTipologias({ tipologias, unidades }: Props) {
  const conStock = tipologias.filter((t) => t.total > 0);
  if (!conStock.length && !unidades.length) {
    return <p className="property__text">Por ahora no quedan unidades disponibles en este proyecto.</p>;
  }

  return (
    <>
      {conStock.length ? (
        <div className="stock__envoltorio">
          <table className="stock__tabla">
            <caption className="visually-hidden">Tipologías del proyecto</caption>
            <thead>
              <tr>
                <th scope="col">Tipología</th>
                <th scope="col">Dormitorios</th>
                <th scope="col">Baños</th>
                <th scope="col">Superficie útil</th>
                <th scope="col">Disponibles</th>
                <th scope="col">Desde</th>
              </tr>
            </thead>
            <tbody>
              {conStock.map((t) => (
                <tr key={t.id}>
                  <th scope="row">{t.codigo}</th>
                  <td>{t.dormitorios || '—'}</td>
                  <td>{t.banos || '—'}</td>
                  <td>
                    {t.superficieUtil ? `${formatNumero(t.superficieUtil, 2)} m²` : '—'}
                    {t.superficieTerraza ? (
                      <span className="stock__detalle"> + {formatNumero(t.superficieTerraza, 2)} m² de terraza</span>
                    ) : null}
                  </td>
                  <td>{t.disponibles}</td>
                  <td>{t.desdeUF ? `UF ${formatNumero(t.desdeUF)}` : 'Sin stock'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {unidades.length ? (
        <div className="stock__envoltorio">
          <table className="stock__tabla">
            <caption className="stock__caption">Unidades publicadas</caption>
            <thead>
              <tr>
                <th scope="col">Unidad</th>
                <th scope="col">Tipología</th>
                <th scope="col">Piso</th>
                <th scope="col">Orientación</th>
                <th scope="col">Superficie</th>
                <th scope="col">Precio</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {unidades.map((u) => (
                <tr key={u.id} className={u.estado === 'reservada' ? 'stock__fila--reservada' : undefined}>
                  <th scope="row">{u.numero}</th>
                  <td>{tipologias.find((t) => t.id === u.tipologiaId)?.codigo ?? '—'}</td>
                  <td>{u.piso ?? '—'}</td>
                  <td>{u.orientacion || '—'}</td>
                  <td>{u.superficieUtil ? `${formatNumero(u.superficieUtil, 2)} m²` : '—'}</td>
                  <td>UF {formatNumero(u.precioUF)}</td>
                  <td>{nombreEstadoUnidad(u.estado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
