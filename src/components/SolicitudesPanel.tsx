'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useState, type FormEvent } from 'react';
import type { Solicitud } from '@/lib/solicitudes';
import '@/styles/blocks/solicitudes.css';

/** Horas ya formateadas en la zona de Chile por la página del servidor. */
export type SolicitudFila = Omit<Solicitud, 'creadaEn' | 'respondidaEn'> & {
  llego: string;
  respondidaCuando: string | null;
};

const TIPO: Record<Solicitud['variante'], string> = {
  contacto: 'Consulta',
  tasacion: 'Tasación',
  visita: 'Propiedad',
};

const AVISO: Record<Solicitud['correo'], string> = {
  enviado: 'Enviado',
  'sin-configurar': 'Sin correo',
  error: 'Falló',
  pendiente: 'Pendiente',
};

const ESTADO: Record<Solicitud['estado'], string> = {
  pendiente: 'Por responder',
  enviando: 'Envío sin confirmar',
  error: 'Envío fallido',
  respondida: 'Respondida',
};

function detalles(s: SolicitudFila): string[] {
  return [
    s.propiedad && 'Propiedad: ' + s.propiedad,
    s.tipo && 'Tipo: ' + s.tipo,
    s.comuna && 'Comuna: ' + s.comuna,
    s.motivo && 'Motivo: ' + s.motivo,
    s.fecha && 'Fecha preferida: ' + s.fecha,
  ].filter((linea): linea is string => !!linea);
}

async function errorDe(res: Response, fallback: string): Promise<string> {
  const cuerpo = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof cuerpo?.error === 'string' ? cuerpo.error : fallback;
}

export function SolicitudesPanel({ solicitudes, correoListo }: { solicitudes: SolicitudFila[]; correoListo: boolean }) {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState<number | null>(null);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorRespuesta, setErrorRespuesta] = useState<{ id: number; mensaje: string } | null>(null);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [abierta, setAbierta] = useState<number | null>(null);

  function alternarDetalle(id: number) {
    setAbierta(abierta === id ? null : id);
    setConfirmando(null);
    setErrorRespuesta(null);
  }

  async function responder(evento: FormEvent<HTMLFormElement>, s: SolicitudFila) {
    evento.preventDefault();
    const form = evento.currentTarget;
    const datos = new FormData(form);
    const respuesta = String(datos.get('respuesta') ?? '').trim();
    const nota = String(datos.get('nota') ?? '').trim();
    if (!respuesta || !nota) {
      setErrorRespuesta({ id: s.id, mensaje: 'Escribe la respuesta y una nota interna antes de enviarla.' });
      form.querySelector<HTMLTextAreaElement>(respuesta ? '[name="nota"]' : '[name="respuesta"]')?.focus();
      return;
    }

    setErrorRespuesta(null);
    setAlerta(null);
    setAviso(null);
    setTrabajando(s.id);
    try {
      const res = await fetch('/api/panel/solicitudes/' + s.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuesta, nota }),
      });
      if (!res.ok) {
        setErrorRespuesta({ id: s.id, mensaje: await errorDe(res, 'No pudimos enviar la respuesta. Intenta de nuevo.') });
        router.refresh();
        return;
      }
      setAbierta(null);
      setAviso('Respuesta a ' + s.nombre + ' procesada. Revisa el estado actualizado en la tabla.');
      router.refresh();
    } catch {
      setErrorRespuesta({ id: s.id, mensaje: 'No pudimos conectar. Intenta de nuevo.' });
    } finally {
      setTrabajando(null);
    }
  }

  async function reintentar(s: SolicitudFila) {
    setErrorRespuesta(null);
    setAlerta(null);
    setAviso(null);
    setTrabajando(s.id);
    try {
      const res = await fetch('/api/panel/solicitudes/' + s.id, { method: 'PATCH' });
      if (!res.ok) {
        setErrorRespuesta({ id: s.id, mensaje: await errorDe(res, 'No pudimos reintentar el envío.') });
        router.refresh();
        return;
      }
      setAviso('Reintento de respuesta a ' + s.nombre + ' procesado. Revisa el estado actualizado en la tabla.');
      router.refresh();
    } catch {
      setErrorRespuesta({ id: s.id, mensaje: 'No pudimos conectar. Intenta de nuevo.' });
    } finally {
      setTrabajando(null);
    }
  }

  async function borrar(id: number) {
    setAlerta(null);
    setAviso(null);
    setTrabajando(id);
    try {
      const res = await fetch('/api/panel/solicitudes/' + id, { method: 'DELETE' });
      if (!res.ok) {
        setAlerta(await errorDe(res, 'No pudimos borrar la solicitud.'));
        return;
      }
      setConfirmando(null);
      setAbierta(null);
      router.refresh();
    } catch {
      setAlerta('No pudimos conectar. Intenta de nuevo.');
    } finally {
      setTrabajando(null);
    }
  }

  const sinAviso = solicitudes.filter((s) => s.correo !== 'enviado').length;
  const porResponder = solicitudes.filter((s) => s.estado !== 'respondida').length;

  return (
    <>
      <h1 className="panel__title">Solicitudes</h1>
      <p className="panel__intro">
        Responde las consultas desde aquí y deja una nota interna para el equipo. Cada respuesta queda asociada a su solicitud.
      </p>
      <p className="solicitudes__resumen">
        <strong>{porResponder}</strong> {porResponder === 1 ? 'solicitud por resolver' : 'solicitudes por resolver'}
      </p>

      {!correoListo ? (
        <p className="panel__aviso" role="status">
          Las respuestas por correo aún no están habilitadas. Las solicitudes siguen guardadas; pide a un administrador activar el correo antes de responder.
        </p>
      ) : null}

      {sinAviso ? (
        <p className="panel__aviso" role="status">
          {sinAviso === 1 ? 'Hay 1 aviso al equipo que no salió' : 'Hay ' + sinAviso + ' avisos al equipo que no salieron'} por correo.{' '}
          {sinAviso === 1 ? 'La solicitud está guardada' : 'Las solicitudes están guardadas'} en esta lista.
        </p>
      ) : null}
      {aviso ? <p className="panel__aviso" role="status">{aviso}</p> : null}
      {alerta ? <p className="acceso__alerta" role="alert">{alerta}</p> : null}

      {solicitudes.length ? (
        <div className="panel__tabla-envoltorio">
          <table className="panel__tabla">
            <thead>
              <tr>
                <th scope="col">Llegó</th>
                <th scope="col">Tipo</th>
                <th scope="col">De</th>
                <th scope="col">Qué pide</th>
                <th scope="col">Aviso interno</th>
                <th scope="col">Estado</th>
                <th scope="col"><span className="visually-hidden">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((s) => {
                const detalleAbierto = abierta === s.id;
                const enCurso = trabajando === s.id;
                const errorActual = errorRespuesta?.id === s.id ? errorRespuesta.mensaje : null;
                return (
                  <Fragment key={s.id}>
                    <tr>
                      <td>{s.llego}</td>
                      <td>{TIPO[s.variante]}</td>
                      <td>
                        <span className="panel__dato">{s.nombre}</span>
                        <a className="panel__dato panel__dato--enlace" href={'mailto:' + s.email}>{s.email}</a>
                        {s.telefono ? (
                          <a className="panel__dato panel__dato--enlace" href={'tel:' + s.telefono.replace(/[^\d+]/g, '')}>{s.telefono}</a>
                        ) : null}
                      </td>
                      <td className="panel__celda-texto">
                        {detalles(s).map((linea) => <span className="panel__dato" key={linea}>{linea}</span>)}
                        {s.mensaje ? <p className="panel__mensaje">{s.mensaje}</p> : null}
                      </td>
                      <td>
                        <span className={'panel__etiqueta panel__etiqueta--sola' + (s.correo === 'enviado' ? '' : ' panel__etiqueta--alerta')}>
                          {AVISO[s.correo]}
                        </span>
                      </td>
                      <td>
                        <span className={'solicitudes__estado solicitudes__estado--' + s.estado}>{ESTADO[s.estado]}</span>
                        {s.estado === 'respondida' && s.respondidaCuando ? <span className="solicitudes__meta">{s.respondidaCuando}</span> : null}
                        {errorActual && !detalleAbierto ? <span className="solicitudes__error" role="alert">{errorActual}</span> : null}
                      </td>
                      <td>
                        <div className="solicitudes__acciones">
                          {confirmando === s.id ? (
                            <>
                              <button type="button" className="solicitudes__accion solicitudes__accion--peligro" onClick={() => borrar(s.id)} disabled={trabajando !== null}>
                                {enCurso ? 'Borrando…' : 'Sí, borrar'}
                              </button>
                              <button type="button" className="solicitudes__accion" onClick={() => setConfirmando(null)} disabled={enCurso}>Cancelar</button>
                            </>
                          ) : (
                            <>
                              {(s.estado === 'pendiente' || s.estado === 'respondida' || !!s.respuestaTexto) ? (
                                <button
                                  type="button"
                                  className="solicitudes__accion solicitudes__accion--principal"
                                  onClick={() => alternarDetalle(s.id)}
                                  aria-expanded={detalleAbierto}
                                  aria-controls={'solicitud-detalle-' + s.id}
                                  disabled={trabajando !== null || (s.estado === 'pendiente' && !correoListo)}
                                >
                                  {detalleAbierto ? 'Cerrar' : s.estado === 'pendiente' ? 'Responder' : 'Ver respuesta'}
                                </button>
                              ) : null}
                              {s.estado === 'error' ? (
                                <button type="button" className="solicitudes__accion" onClick={() => reintentar(s)} disabled={trabajando !== null || !correoListo}>
                                  {enCurso ? 'Reintentando…' : 'Reintentar envío'}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="solicitudes__accion solicitudes__accion--peligro"
                                onClick={() => { setConfirmando(s.id); setAbierta(null); }}
                                disabled={trabajando !== null}
                              >
                                Borrar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {detalleAbierto ? (
                      <tr>
                        <td colSpan={7} className="solicitudes__detalle-celda">
                          <section className="solicitudes__detalle" id={'solicitud-detalle-' + s.id} aria-label={'Respuesta a la solicitud de ' + s.nombre}>
                            {s.estado === 'pendiente' ? (
                              <form className="solicitudes__form" onSubmit={(evento) => responder(evento, s)} noValidate>
                                <div>
                                  <h2 className="solicitudes__titulo">Responder a {s.nombre}</h2>
                                  <p className="solicitudes__ayuda">La respuesta se enviará a <strong>{s.email}</strong>. La nota solo será visible en el panel.</p>
                                </div>
                                <div className="field">
                                  <label className="field__label" htmlFor={'respuesta-' + s.id}>Respuesta por correo</label>
                                  <textarea className="field__control field__control--textarea" id={'respuesta-' + s.id} name="respuesta" rows={6} minLength={10} maxLength={4000} required disabled={enCurso} />
                                </div>
                                <div className="field">
                                  <label className="field__label" htmlFor={'nota-' + s.id}>Nota interna para el equipo</label>
                                  <textarea className="field__control field__control--textarea" id={'nota-' + s.id} name="nota" rows={3} minLength={3} maxLength={500} required disabled={enCurso} />
                                </div>
                                {errorActual ? <p className="solicitudes__error" role="alert">{errorActual}</p> : null}
                                <div className="solicitudes__form-acciones">
                                  <button type="submit" className="button button--primary" disabled={enCurso}>{enCurso ? 'Enviando…' : 'Enviar respuesta'}</button>
                                  <button type="button" className="button button--outline" onClick={() => setAbierta(null)} disabled={enCurso}>Cancelar</button>
                                </div>
                              </form>
                            ) : (
                              <div className="solicitudes__registro">
                                <h2 className="solicitudes__titulo">{s.estado === 'respondida' ? 'Respuesta enviada' : 'Respuesta preparada'}</h2>
                                {s.estado === 'error' ? <p className="solicitudes__ayuda">El correo no pudo salir. Puedes reintentar el envío desde la lista.</p> : null}
                                {s.estado === 'enviando' ? <p className="solicitudes__ayuda">No se pudo confirmar el envío. Revisa el registro del correo antes de intentar otra acción.</p> : null}
                                <dl className="solicitudes__registro-campos">
                                  <div><dt>Respuesta para {s.email}</dt><dd>{s.respuestaTexto || 'Sin texto guardado.'}</dd></div>
                                  <div><dt>Nota interna</dt><dd>{s.notaRespuesta || 'Sin nota guardada.'}</dd></div>
                                </dl>
                                {s.estado === 'respondida' ? (
                                  <p className="solicitudes__firma">
                                    Respondió {s.respondidaPorNombre || 'el equipo'}{s.respondidaCuando ? ' · ' + s.respondidaCuando : ''}
                                  </p>
                                ) : null}
                                {errorActual ? <p className="solicitudes__error" role="alert">{errorActual}</p> : null}
                              </div>
                            )}
                          </section>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="panel__intro">Todavía no ha llegado ninguna solicitud.</p>
      )}
    </>
  );
}
