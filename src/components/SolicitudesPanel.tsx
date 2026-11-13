'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Solicitud } from '@/lib/solicitudes';

/** La solicitud con la hora ya escrita en hora de Chile, lista para mostrar. */
export type SolicitudFila = Omit<Solicitud, 'creadaEn'> & { llego: string };

const TIPO: Record<Solicitud['variante'], string> = {
  contacto: 'Consulta',
  tasacion: 'Tasación',
  visita: 'Visita',
};

const AVISO: Record<Solicitud['correo'], string> = {
  enviado: 'Enviado',
  'sin-configurar': 'Sin correo',
  error: 'Falló',
  pendiente: 'Pendiente',
};

// Lo que la persona completó además del mensaje, en el orden en que se lee.
function detalles(s: SolicitudFila): string[] {
  return [
    s.propiedad && `Propiedad: ${s.propiedad}`,
    s.tipo && `Tipo: ${s.tipo}`,
    s.comuna && `Comuna: ${s.comuna}`,
    s.motivo && `Motivo: ${s.motivo}`,
    s.fecha && `Fecha preferida: ${s.fecha}`,
  ].filter((linea): linea is string => !!linea);
}

export function SolicitudesPanel({ solicitudes }: { solicitudes: SolicitudFila[] }) {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<number | null>(null);

  async function borrar(id: number) {
    setAlerta(null);
    setTrabajando(true);
    try {
      const res = await fetch(`/api/panel/solicitudes/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const cuerpo = (await res.json().catch(() => ({}))) as { error?: string };
        setAlerta(cuerpo.error ?? 'No pudimos borrar la solicitud.');
        return;
      }
      setConfirmando(null);
      router.refresh();
    } catch {
      setAlerta('No pudimos conectar. Intenta de nuevo.');
    } finally {
      setTrabajando(false);
    }
  }

  const sinAviso = solicitudes.filter((s) => s.correo !== 'enviado').length;

  return (
    <>
      <h1 className="panel__title">Solicitudes</h1>
      <p className="panel__intro">
        Todo lo que llega por los formularios del sitio queda acá, salga o no el aviso por correo. Si alguien pide que borren sus datos,
        se borran desde esta lista.
      </p>

      {sinAviso ? (
        <p className="panel__aviso" role="status">
          {sinAviso === 1 ? 'Hay 1 solicitud que no salió' : `Hay ${sinAviso} solicitudes que no salieron`} por correo: solo{' '}
          {sinAviso === 1 ? 'está' : 'están'} en esta lista.
        </p>
      ) : null}

      {alerta ? (
        <p className="acceso__alerta" role="alert">
          {alerta}
        </p>
      ) : null}

      {solicitudes.length ? (
        <div className="panel__tabla-envoltorio">
          <table className="panel__tabla">
            <thead>
              <tr>
                <th scope="col">Llegó</th>
                <th scope="col">Tipo</th>
                <th scope="col">De</th>
                <th scope="col">Qué pide</th>
                <th scope="col">Aviso</th>
                <th scope="col">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((s) => (
                <tr key={s.id}>
                  <td>{s.llego}</td>
                  <td>{TIPO[s.variante]}</td>
                  <td>
                    <span className="panel__dato">{s.nombre}</span>
                    <a className="panel__dato panel__dato--enlace" href={`mailto:${s.email}`}>
                      {s.email}
                    </a>
                    {s.telefono ? (
                      <a className="panel__dato panel__dato--enlace" href={`tel:${s.telefono.replace(/[^\d+]/g, '')}`}>
                        {s.telefono}
                      </a>
                    ) : null}
                  </td>
                  <td className="panel__celda-texto">
                    {detalles(s).map((linea) => (
                      <span className="panel__dato" key={linea}>
                        {linea}
                      </span>
                    ))}
                    {s.mensaje ? <p className="panel__mensaje">{s.mensaje}</p> : null}
                  </td>
                  <td>
                    <span className={`panel__etiqueta panel__etiqueta--sola${s.correo === 'enviado' ? '' : ' panel__etiqueta--alerta'}`}>{AVISO[s.correo]}</span>
                  </td>
                  <td>
                    <div className="panel__acciones">
                      {confirmando === s.id ? (
                        <>
                          <button type="button" className="panel__accion panel__accion--peligro" onClick={() => borrar(s.id)} disabled={trabajando}>
                            Confirmar
                          </button>
                          <button type="button" className="panel__accion" onClick={() => setConfirmando(null)}>
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button type="button" className="panel__accion" onClick={() => setConfirmando(s.id)} disabled={trabajando}>
                          Borrar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="panel__intro">Todavía no ha llegado ninguna solicitud.</p>
      )}
    </>
  );
}
