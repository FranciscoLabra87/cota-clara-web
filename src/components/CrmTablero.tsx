'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import type { Actividad, Interesado } from '@/lib/crm';
import { ETAPAS, nombreActividad, nombreEtapa, TIPOS_ACTIVIDAD, type Etapa, type TipoActividad } from '@/lib/crm-etapas';
import { formatNumero } from '@/lib/format';

export type InteresadoFila = Omit<Interesado, 'creadoEn'> & { llego: string };
export type ActividadFila = Omit<Actividad, 'fecha'> & { cuando: string };
/** Tareas abiertas ligadas a un interesado de esta propiedad. */
export type TareaCrm = { id: number; titulo: string; interesadoId: number; responsableNombre: string | null; venceTexto: string | null };

type Props = {
  propiedad: { id: number; titulo: string; segmento: string; publicada: boolean; slug: string };
  numeros: {
    visitasWeb: number;
    visitasSemana: number;
    interesados: number;
    activos: number;
    llamadas: number;
    visitasFisicas: number;
  };
  ultimo: { tipo: TipoActividad; usuarioNombre: string | null; interesadoNombre: string; cuando: string } | null;
  interesados: InteresadoFila[];
  actividades: ActividadFila[];
  tareas: TareaCrm[];
  usuarioId: number;
  esAdmin: boolean;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Cómo se lee una actividad en el historial. */
function resumenActividad(a: ActividadFila) {
  if (a.tipo === 'etapa') return `Pasó a «${nombreEtapa(a.detalle)}»`;
  return a.detalle || nombreActividad(a.tipo);
}

const quien = (nombre: string | null) => nombre ?? 'Sitio web';

export function CrmTablero({ propiedad, numeros, ultimo, interesados, actividades, tareas, usuarioId, esAdmin }: Props) {
  const router = useRouter();
  const id = useId();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const actual = interesados.find((i) => i.id === abierto) ?? null;
  const historialDe = (interesadoId: number) => actividades.filter((a) => a.interesadoId === interesadoId);

  // El diálogo se abre con showModal para que tenga fondo, foco atrapado y
  // cierre con Escape, igual que la galería del sitio.
  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (actual && !d.open) d.showModal();
    if (!actual && d.open) d.close();
  }, [actual]);

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

  async function agregar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = Object.fromEntries(new FormData(form));
    const ok = await pedir('/api/panel/crm/interesados', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ ...datos, propiedadId: propiedad.id }),
    });
    if (ok) form.reset();
  }

  const mover = (interesadoId: number, etapa: Etapa) =>
    pedir(`/api/panel/crm/interesados/${interesadoId}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ etapa }) });

  async function registrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!actual) return;
    const form = e.currentTarget;
    const datos = Object.fromEntries(new FormData(form));
    const ok = await pedir(`/api/panel/crm/interesados/${actual.id}/actividades`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(datos),
    });
    if (ok) form.reset();
  }

  // La tarea queda a nombre de quien la crea y ligada a este cliente.
  async function crearTarea(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!actual) return;
    const form = e.currentTarget;
    const datos = Object.fromEntries(new FormData(form));
    const ok = await pedir('/api/panel/tareas', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ ...datos, interesadoId: actual.id, responsableId: usuarioId }),
    });
    if (ok) form.reset();
  }

  async function guardarDatos(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!actual) return;
    const datos = Object.fromEntries(new FormData(e.currentTarget));
    const ok = await pedir(`/api/panel/crm/interesados/${actual.id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(datos) });
    if (ok) setEditando(false);
  }

  async function borrar() {
    if (!actual) return;
    const ok = await pedir(`/api/panel/crm/interesados/${actual.id}`, { method: 'DELETE' });
    if (ok) cerrar();
  }

  function abrir(interesadoId: number) {
    setAlerta(null);
    setEditando(false);
    setConfirmando(false);
    setAbierto(interesadoId);
  }

  function cerrar() {
    setAbierto(null);
    setEditando(false);
    setConfirmando(false);
  }

  const puedeBorrar = actual ? esAdmin || actual.creadoPor === usuarioId : false;

  return (
    <div className="crm">
      <div className="panel__cabecera">
        <div>
          <p className="panel__eyebrow">Seguimiento · {propiedad.segmento}</p>
          <h1 className="panel__title">{propiedad.titulo}</h1>
        </div>
        {propiedad.publicada ? (
          <Link className="button button--outline button--sm" href={`/propiedades/${propiedad.slug}`} target="_blank" rel="noopener noreferrer">
            Ver en el sitio
          </Link>
        ) : null}
      </div>

      <dl className="crm__numeros">
        <div className="crm__numero">
          <dt className="crm__numero-nombre">Visitas en la web</dt>
          <dd className="crm__numero-valor">{formatNumero(numeros.visitasWeb)}</dd>
          <dd className="crm__numero-nota">{formatNumero(numeros.visitasSemana)} en 7 días</dd>
        </div>
        <div className="crm__numero">
          <dt className="crm__numero-nombre">Interesados activos</dt>
          <dd className="crm__numero-valor">{formatNumero(numeros.activos)}</dd>
          <dd className="crm__numero-nota">de {formatNumero(numeros.interesados)} en total</dd>
        </div>
        <div className="crm__numero">
          <dt className="crm__numero-nombre">Llamadas</dt>
          <dd className="crm__numero-valor">{formatNumero(numeros.llamadas)}</dd>
        </div>
        <div className="crm__numero">
          <dt className="crm__numero-nombre">Visitas físicas</dt>
          <dd className="crm__numero-valor">{formatNumero(numeros.visitasFisicas)}</dd>
        </div>
        <div className="crm__numero crm__numero--ancho">
          <dt className="crm__numero-nombre">Último contacto</dt>
          {ultimo ? (
            <>
              <dd className="crm__numero-texto">
                {nombreActividad(ultimo.tipo)} de {quien(ultimo.usuarioNombre)} con {ultimo.interesadoNombre}
              </dd>
              <dd className="crm__numero-nota">{ultimo.cuando}</dd>
            </>
          ) : (
            <dd className="crm__numero-texto">Todavía no hay contactos registrados</dd>
          )}
        </div>
      </dl>

      {alerta && !actual ? (
        <p className="acceso__alerta" role="alert">
          {alerta}
        </p>
      ) : null}

      <form className="crm__agregar" onSubmit={agregar} aria-label="Agregar interesado">
        <div className="field crm__agregar-campo">
          <label className="field__label" htmlFor={`${id}-nombre`}>
            Nombre
          </label>
          <input className="field__control" id={`${id}-nombre`} name="nombre" type="text" required minLength={2} maxLength={120} />
        </div>
        <div className="field crm__agregar-campo">
          <label className="field__label" htmlFor={`${id}-telefono`}>
            Teléfono <span className="field__optional">(opcional)</span>
          </label>
          <input className="field__control" id={`${id}-telefono`} name="telefono" type="tel" maxLength={40} />
        </div>
        <div className="field crm__agregar-campo">
          <label className="field__label" htmlFor={`${id}-email`}>
            Correo <span className="field__optional">(opcional)</span>
          </label>
          <input className="field__control" id={`${id}-email`} name="email" type="email" maxLength={160} />
        </div>
        <button type="submit" className="button button--primary button--sm" disabled={trabajando}>
          Agregar interesado
        </button>
      </form>

      <div className="crm__tablero">
        {ETAPAS.map((etapa, n) => {
          const tarjetas = interesados.filter((i) => i.etapa === etapa.value);
          return (
            <section key={etapa.value} className="crm__columna" aria-labelledby={`${id}-col-${etapa.value}`}>
              <h2 className="crm__columna-titulo" id={`${id}-col-${etapa.value}`}>
                {etapa.label} <span className="crm__columna-cuenta">{tarjetas.length}</span>
              </h2>
              <ul className="crm__tarjetas">
                {tarjetas.map((i) => {
                  const ultima = historialDe(i.id)[0];
                  return (
                    <li key={i.id} className="crm__tarjeta">
                      <button type="button" className="crm__tarjeta-abrir" onClick={() => abrir(i.id)}>
                        <span className="crm__tarjeta-nombre">{i.nombre}</span>
                        {i.telefono ? <span className="crm__tarjeta-dato">{i.telefono}</span> : null}
                        <span className="crm__tarjeta-dato crm__tarjeta-dato--suave">
                          {ultima ? `${nombreActividad(ultima.tipo)} · ${ultima.cuando}` : `Agregado ${i.llego}`}
                        </span>
                        {i.origen === 'formulario' ? <span className="panel__etiqueta">desde el sitio</span> : null}
                      </button>
                      <div className="crm__tarjeta-mover">
                        <button
                          type="button"
                          className="panel__accion panel__accion--orden"
                          onClick={() => mover(i.id, ETAPAS[n - 1].value)}
                          disabled={trabajando || n === 0}
                          aria-label={`Mover a ${ETAPAS[n - 1]?.label ?? ''}`}
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          className="panel__accion panel__accion--orden"
                          onClick={() => mover(i.id, ETAPAS[n + 1].value)}
                          disabled={trabajando || n === ETAPAS.length - 1}
                          aria-label={`Mover a ${ETAPAS[n + 1]?.label ?? ''}`}
                        >
                          →
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <dialog ref={dialogo} className="crm__dialogo" onClose={cerrar} aria-labelledby={`${id}-dialogo-titulo`}>
        {actual ? (
          <div className="crm__dialogo-cuerpo">
            <div className="crm__dialogo-cabecera">
              <h2 className="panel__subtitulo" id={`${id}-dialogo-titulo`}>
                {actual.nombre}
              </h2>
              <button type="button" className="panel__accion" onClick={cerrar}>
                Cerrar
              </button>
            </div>

            {alerta ? (
              <p className="acceso__alerta" role="alert">
                {alerta}
              </p>
            ) : null}

            {editando ? (
              <form className="crm__form" onSubmit={guardarDatos}>
                <div className="field">
                  <label className="field__label" htmlFor={`${id}-e-nombre`}>
                    Nombre
                  </label>
                  <input className="field__control" id={`${id}-e-nombre`} name="nombre" defaultValue={actual.nombre} required minLength={2} maxLength={120} />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor={`${id}-e-telefono`}>
                    Teléfono
                  </label>
                  <input className="field__control" id={`${id}-e-telefono`} name="telefono" type="tel" defaultValue={actual.telefono} maxLength={40} />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor={`${id}-e-email`}>
                    Correo
                  </label>
                  <input className="field__control" id={`${id}-e-email`} name="email" type="email" defaultValue={actual.email} maxLength={160} />
                </div>
                <div className="crm__botones">
                  <button type="submit" className="button button--primary button--sm" disabled={trabajando}>
                    Guardar
                  </button>
                  <button type="button" className="button button--outline button--sm" onClick={() => setEditando(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="crm__contacto">
                <p className="crm__contacto-dato">
                  {actual.telefono ? <a href={`tel:${actual.telefono.replace(/[^\d+]/g, '')}`}>{actual.telefono}</a> : 'Sin teléfono'}
                  {' · '}
                  {actual.email ? <a href={`mailto:${actual.email}`}>{actual.email}</a> : 'Sin correo'}
                </p>
                <div className="field crm__etapa">
                  <label className="field__label" htmlFor={`${id}-etapa`}>
                    Etapa
                  </label>
                  <select
                    className="field__control field__control--select"
                    id={`${id}-etapa`}
                    value={actual.etapa}
                    onChange={(e) => mover(actual.id, e.target.value as Etapa)}
                    disabled={trabajando}
                  >
                    {ETAPAS.map((e) => (
                      <option key={e.value} value={e.value}>
                        {e.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="crm__botones">
                  <button type="button" className="panel__accion" onClick={() => setEditando(true)}>
                    Editar datos
                  </button>
                  {puedeBorrar ? (
                    confirmando ? (
                      <>
                        <button type="button" className="panel__accion panel__accion--peligro" onClick={borrar} disabled={trabajando}>
                          Confirmar: borrar con su historial
                        </button>
                        <button type="button" className="panel__accion" onClick={() => setConfirmando(false)}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button type="button" className="panel__accion" onClick={() => setConfirmando(true)}>
                        Borrar
                      </button>
                    )
                  ) : null}
                </div>
              </div>
            )}

            <form className="crm__form" onSubmit={registrar}>
              <h3 className="crm__form-titulo">Registrar</h3>
              <div className="field">
                <label className="field__label" htmlFor={`${id}-tipo`}>
                  Qué pasó
                </label>
                <select className="field__control field__control--select" id={`${id}-tipo`} name="tipo" defaultValue="llamada">
                  {TIPOS_ACTIVIDAD.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor={`${id}-detalle`}>
                  Observaciones <span className="field__optional">(lo que dijo el cliente)</span>
                </label>
                <textarea className="field__control" id={`${id}-detalle`} name="detalle" rows={3} maxLength={2000} />
              </div>
              <button type="submit" className="button button--primary button--sm" disabled={trabajando}>
                Registrar
              </button>
            </form>

            <form className="crm__form" onSubmit={crearTarea}>
              <h3 className="crm__form-titulo">Tareas de seguimiento</h3>
              {tareas.some((t) => t.interesadoId === actual.id) ? (
                <ul className="crm__tareas">
                  {tareas
                    .filter((t) => t.interesadoId === actual.id)
                    .map((t) => (
                      <li key={t.id}>
                        {t.titulo}
                        <span className="crm__tareas-meta">
                          {' · '}
                          {t.responsableNombre ?? 'Sin asignar'}
                          {t.venceTexto ? ` · vence el ${t.venceTexto}` : ''}
                        </span>
                      </li>
                    ))}
                </ul>
              ) : null}
              <div className="field">
                <label className="field__label" htmlFor={`${id}-tarea`}>
                  Qué hay que hacer
                </label>
                <input className="field__control" id={`${id}-tarea`} name="titulo" required minLength={2} maxLength={160} placeholder="Llamar el jueves para confirmar" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor={`${id}-tarea-vence`}>
                  Fecha límite <span className="field__optional">(opcional)</span>
                </label>
                <input className="field__control" id={`${id}-tarea-vence`} name="venceEn" type="date" />
              </div>
              <div className="crm__botones">
                <button type="submit" className="button button--outline button--sm" disabled={trabajando}>
                  Crear tarea
                </button>
                <Link className="panel__accion" href="/panel/tareas">
                  Ver todas las tareas
                </Link>
              </div>
            </form>

            <h3 className="crm__form-titulo">Historial</h3>
            {historialDe(actual.id).length === 0 ? (
              <p className="panel__intro">Todavía no hay nada registrado.</p>
            ) : (
              <ol className="crm__historial">
                {historialDe(actual.id).map((a) => (
                  <li key={a.id} className={`crm__evento${a.tipo === 'etapa' ? ' crm__evento--sistema' : ''}`}>
                    <p className="crm__evento-cabecera">
                      <strong>{nombreActividad(a.tipo)}</strong> · {quien(a.usuarioNombre)} · {a.cuando}
                    </p>
                    <p className="crm__evento-detalle">{resumenActividad(a)}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
