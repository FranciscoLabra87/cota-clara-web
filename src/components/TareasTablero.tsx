'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import type { Tarea } from '@/lib/tareas';
import { ESTADOS_TAREA, type EstadoTarea } from '@/lib/tareas-estados';

export type TareaFila = Tarea & { vencida: boolean; venceTexto: string | null };
type Opcion = { id: number; nombre: string };

type Props = {
  tareas: TareaFila[];
  usuarios: Opcion[];
  propiedades: Opcion[];
  usuarioId: number;
  esAdmin: boolean;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Los campos de una tarea, iguales al crearla y al editarla. */
function CamposTarea({ prefijo, tarea, usuarios, propiedades, usuarioId }: { prefijo: string; tarea?: TareaFila } & Omit<Props, 'tareas' | 'esAdmin'>) {
  return (
    <>
      <div className="field tareas__campo tareas__campo--ancho">
        <label className="field__label" htmlFor={`${prefijo}-titulo`}>
          Qué hay que hacer
        </label>
        <input className="field__control" id={`${prefijo}-titulo`} name="titulo" defaultValue={tarea?.titulo} required minLength={2} maxLength={160} />
      </div>
      <div className="field tareas__campo">
        <label className="field__label" htmlFor={`${prefijo}-responsable`}>
          Responsable
        </label>
        <select
          className="field__control field__control--select"
          id={`${prefijo}-responsable`}
          name="responsableId"
          defaultValue={tarea ? (tarea.responsableId ?? '') : usuarioId}
        >
          <option value="">Sin asignar</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="field tareas__campo">
        <label className="field__label" htmlFor={`${prefijo}-vence`}>
          Fecha límite <span className="field__optional">(opcional)</span>
        </label>
        <input className="field__control" id={`${prefijo}-vence`} name="venceEn" type="date" defaultValue={tarea?.venceEn ?? ''} />
      </div>
      {tarea?.interesadoId ? (
        <input type="hidden" name="interesadoId" value={tarea.interesadoId} />
      ) : (
        <div className="field tareas__campo">
          <label className="field__label" htmlFor={`${prefijo}-propiedad`}>
            Propiedad <span className="field__optional">(opcional)</span>
          </label>
          <select
            className="field__control field__control--select"
            id={`${prefijo}-propiedad`}
            name="propiedadId"
            defaultValue={tarea?.propiedadId ?? ''}
          >
            <option value="">Ninguna</option>
            {propiedades.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field tareas__campo tareas__campo--ancho">
        <label className="field__label" htmlFor={`${prefijo}-detalle`}>
          Detalle <span className="field__optional">(opcional)</span>
        </label>
        <textarea className="field__control" id={`${prefijo}-detalle`} name="detalle" rows={2} maxLength={2000} defaultValue={tarea?.detalle} />
      </div>
    </>
  );
}

export function TareasTablero({ tareas, usuarios, propiedades, usuarioId, esAdmin }: Props) {
  const router = useRouter();
  const id = useId();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [soloMias, setSoloMias] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [confirmando, setConfirmando] = useState<number | null>(null);

  const visibles = soloMias ? tareas.filter((t) => t.responsableId === usuarioId) : tareas;
  const actual = tareas.find((t) => t.id === editando) ?? null;

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

  async function crear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const ok = await pedir('/api/panel/tareas', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    if (ok) form.reset();
  }

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!actual) return;
    const ok = await pedir(`/api/panel/tareas/${actual.id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
    });
    if (ok) setEditando(null);
  }

  const mover = (tareaId: number, estado: EstadoTarea) =>
    pedir(`/api/panel/tareas/${tareaId}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ estado }) });

  async function borrar(tareaId: number) {
    const ok = await pedir(`/api/panel/tareas/${tareaId}`, { method: 'DELETE' });
    if (ok) setConfirmando(null);
  }

  return (
    <div className="tareas">
      <div className="panel__cabecera">
        <h1 className="panel__title">Tareas</h1>
        <div className="tareas__filtro" role="group" aria-label="Qué tareas ver">
          <button type="button" className={`tareas__filtro-boton${soloMias ? ' tareas__filtro-boton--activo' : ''}`} aria-pressed={soloMias} onClick={() => setSoloMias(true)}>
            Mis tareas
          </button>
          <button type="button" className={`tareas__filtro-boton${soloMias ? '' : ' tareas__filtro-boton--activo'}`} aria-pressed={!soloMias} onClick={() => setSoloMias(false)}>
            Todas
          </button>
        </div>
      </div>

      {alerta && !actual ? (
        <p className="acceso__alerta" role="alert">
          {alerta}
        </p>
      ) : null}

      <form className="tareas__nueva" onSubmit={crear} aria-label="Nueva tarea">
        <CamposTarea prefijo={`${id}-n`} usuarios={usuarios} propiedades={propiedades} usuarioId={usuarioId} />
        <button type="submit" className="button button--primary button--sm" disabled={trabajando}>
          Crear tarea
        </button>
      </form>

      <div className="tareas__tablero">
        {ESTADOS_TAREA.map((estado, n) => {
          const columna = visibles.filter((t) => t.estado === estado.value);
          return (
            <section key={estado.value} className="tareas__columna" aria-labelledby={`${id}-col-${estado.value}`}>
              <h2 className="tareas__columna-titulo" id={`${id}-col-${estado.value}`}>
                {estado.label} <span className="tareas__columna-cuenta">{columna.length}</span>
              </h2>
              <ul className="tareas__lista">
                {columna.map((t) => (
                  <li key={t.id} className={`tareas__tarjeta${t.vencida ? ' tareas__tarjeta--vencida' : ''}`}>
                    <p className="tareas__tarjeta-titulo">{t.titulo}</p>
                    {t.detalle ? <p className="tareas__tarjeta-detalle">{t.detalle}</p> : null}
                    <p className="tareas__tarjeta-meta">
                      {t.responsableNombre ?? 'Sin asignar'}
                      {t.venceTexto ? (
                        <span className={t.vencida ? 'tareas__vence tareas__vence--vencida' : 'tareas__vence'}>
                          {t.vencida ? `Venció el ${t.venceTexto}` : `Vence el ${t.venceTexto}`}
                        </span>
                      ) : null}
                    </p>
                    {t.propiedadId ? (
                      <Link className="tareas__tarjeta-enlace" href={`/panel/propiedades/${t.propiedadId}/seguimiento`}>
                        {t.interesadoNombre ? `${t.interesadoNombre} · ` : ''}
                        {t.propiedadTitulo}
                      </Link>
                    ) : null}
                    <div className="tareas__tarjeta-acciones">
                      <button
                        type="button"
                        className="panel__accion panel__accion--orden"
                        onClick={() => mover(t.id, ESTADOS_TAREA[n - 1].value)}
                        disabled={trabajando || n === 0}
                        aria-label={`Mover a ${ESTADOS_TAREA[n - 1]?.label ?? ''}`}
                      >
                        ←
                      </button>
                      <button type="button" className="panel__accion" onClick={() => setEditando(t.id)}>
                        Editar
                      </button>
                      {esAdmin || t.creadoPor === usuarioId ? (
                        confirmando === t.id ? (
                          <>
                            <button type="button" className="panel__accion panel__accion--peligro" onClick={() => borrar(t.id)} disabled={trabajando}>
                              Confirmar
                            </button>
                            <button type="button" className="panel__accion" onClick={() => setConfirmando(null)}>
                              No
                            </button>
                          </>
                        ) : (
                          <button type="button" className="panel__accion" onClick={() => setConfirmando(t.id)}>
                            Borrar
                          </button>
                        )
                      ) : null}
                      <button
                        type="button"
                        className="panel__accion panel__accion--orden"
                        onClick={() => mover(t.id, ESTADOS_TAREA[n + 1].value)}
                        disabled={trabajando || n === ESTADOS_TAREA.length - 1}
                        aria-label={`Mover a ${ESTADOS_TAREA[n + 1]?.label ?? ''}`}
                      >
                        →
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <dialog ref={dialogo} className="tareas__dialogo" onClose={() => setEditando(null)} aria-label="Editar tarea">
        {actual ? (
          <form className="tareas__nueva tareas__nueva--dialogo" onSubmit={guardar} key={actual.id}>
            <h2 className="panel__subtitulo tareas__campo--ancho">Editar tarea</h2>
            {alerta ? (
              <p className="acceso__alerta tareas__campo--ancho" role="alert">
                {alerta}
              </p>
            ) : null}
            {actual.interesadoNombre ? (
              <p className="panel__intro tareas__campo--ancho">
                Ligada a {actual.interesadoNombre} · {actual.propiedadTitulo}
              </p>
            ) : null}
            <CamposTarea prefijo={`${id}-e`} tarea={actual} usuarios={usuarios} propiedades={propiedades} usuarioId={usuarioId} />
            <div className="tareas__botones tareas__campo--ancho">
              <button type="submit" className="button button--primary button--sm" disabled={trabajando}>
                Guardar
              </button>
              <button type="button" className="button button--outline button--sm" onClick={() => setEditando(null)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : null}
      </dialog>
    </div>
  );
}
