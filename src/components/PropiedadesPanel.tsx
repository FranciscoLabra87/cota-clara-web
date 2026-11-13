'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { nombreTipo } from '@/data/properties';
import { formatNumero, formatPrecio } from '@/lib/format';
import type { PropiedadAdmin } from '@/lib/propiedades';
import type { Visitas } from '@/lib/visitas';

type Props = {
  propiedades: PropiedadAdmin[];
  /** Por id de propiedad. Las que nunca tuvieron una visita no vienen. */
  visitas: Record<number, Visitas>;
};

export function PropiedadesPanel({ propiedades, visitas }: Props) {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<number | null>(null);

  async function pedir(url: string, init: RequestInit) {
    setAlerta(null);
    setTrabajando(true);
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        const cuerpo = (await res.json().catch(() => ({}))) as { error?: string };
        setAlerta(cuerpo.error ?? 'No pudimos completar la acción.');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setAlerta('No pudimos conectar. Intenta de nuevo.');
      return false;
    } finally {
      setTrabajando(false);
    }
  }

  const cambiarEstado = (p: PropiedadAdmin) =>
    pedir(`/api/panel/propiedades/${p.id}/estado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: p.estado === 'PUBLICADA' ? 'BORRADOR' : 'PUBLICADA' }),
    });

  async function borrar(p: PropiedadAdmin) {
    const ok = await pedir(`/api/panel/propiedades/${p.id}`, { method: 'DELETE' });
    if (ok) setConfirmando(null);
  }

  return (
    <>
      <div className="panel__cabecera">
        <h1 className="panel__title">Propiedades</h1>
        <Link className="button button--primary button--sm" href="/panel/propiedades/nueva">
          Nueva propiedad
        </Link>
      </div>
      <p className="panel__intro">
        Las publicadas aparecen en el sitio al tiro. Las que están en borrador solo se ven desde acá.
      </p>

      {alerta ? (
        <p className="acceso__alerta" role="alert">
          {alerta}
        </p>
      ) : null}

      {propiedades.length === 0 ? (
        <p className="panel__intro">Todavía no hay propiedades cargadas.</p>
      ) : (
        <div className="panel__tabla-envoltorio">
          <table className="panel__tabla">
            <thead>
              <tr>
                <th scope="col">Propiedad</th>
                <th scope="col">Operación</th>
                <th scope="col">Precio</th>
                <th scope="col">Fotos</th>
                <th scope="col">Visitas</th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {propiedades.map((p) => (
                <tr key={p.id} className={p.estado === 'PUBLICADA' ? undefined : 'panel__fila--inactiva'}>
                  <td>
                    {nombreTipo(p.tipo)} · {p.comuna}
                    {p.destacada ? <span className="panel__etiqueta">destacada</span> : null}
                  </td>
                  <td>{p.operacion === 'venta' ? 'Venta' : 'Arriendo'}</td>
                  <td>{formatPrecio(p.precio)}</td>
                  <td>{p.imagenes?.length ?? 0}</td>
                  <td>
                    {formatNumero(visitas[p.id]?.total ?? 0)}
                    <span className="panel__dato panel__dato--suave">{formatNumero(visitas[p.id]?.semana ?? 0)} en 7 días</span>
                  </td>
                  <td>{p.estado === 'PUBLICADA' ? 'Publicada' : 'Borrador'}</td>
                  <td className="panel__acciones">
                    <Link className="panel__accion" href={`/panel/propiedades/${p.id}`}>
                      Editar
                    </Link>
                    <button type="button" className="panel__accion" onClick={() => cambiarEstado(p)} disabled={trabajando}>
                      {p.estado === 'PUBLICADA' ? 'Despublicar' : 'Publicar'}
                    </button>
                    {p.estado === 'PUBLICADA' ? (
                      <Link className="panel__accion" href={`/propiedades/${p.slug}`} target="_blank" rel="noopener noreferrer">
                        Ver
                      </Link>
                    ) : null}
                    {confirmando === p.id ? (
                      <>
                        <button type="button" className="panel__accion panel__accion--peligro" onClick={() => borrar(p)} disabled={trabajando}>
                          Confirmar
                        </button>
                        <button type="button" className="panel__accion" onClick={() => setConfirmando(null)}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button type="button" className="panel__accion" onClick={() => setConfirmando(p.id)} disabled={trabajando}>
                        Borrar
                      </button>
                    )}
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
