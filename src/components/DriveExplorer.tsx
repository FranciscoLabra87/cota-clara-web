'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import type { ArchivoDrive, CarpetaDrive, SubidaIniciada } from '@/lib/drive';

export type ArchivoVista = Omit<ArchivoDrive, 'creadoEn'> & { fecha: string };
export type CarpetaVista = Omit<CarpetaDrive, 'archivos'> & { archivos: ArchivoVista[] };

type Props = {
  carpetas: CarpetaVista[];
  usado: number;
  cuota: number;
  yo: { id: number; admin: boolean };
  extensiones: string[];
  maxArchivo: number;
};

type EstadoSubida = 'esperando' | 'subiendo' | 'listo' | 'error' | 'cancelado';

type ItemCola = {
  clave: string;
  archivo: File;
  nombre: string;
  estado: EstadoSubida;
  /** De 0 a 1. */
  progreso: number;
  error?: string;
};

/** Archivos que se suben al mismo tiempo. Las partes de cada uno van en orden. */
const EN_PARALELO = 3;
const REINTENTOS = 3;

const UNIDADES = ['B', 'KB', 'MB', 'GB', 'TB'];
const numero = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });
function tamano(bytes: number) {
  let valor = bytes;
  let i = 0;
  while (valor >= 1024 && i < UNIDADES.length - 1) {
    valor /= 1024;
    i += 1;
  }
  return `${numero.format(valor)} ${UNIDADES[i]}`;
}

const extension = (nombre: string) => nombre.split('.').pop()?.toLowerCase() ?? '';

class Cancelada extends Error {}

/** Sube una parte con XMLHttpRequest, que a diferencia de fetch informa el avance. */
function subirParte(url: string, cuerpo: Blob, alAvanzar: (bytes: number) => void, registrar: (xhr: XMLHttpRequest) => void) {
  return new Promise<{ partNumber: number; etag: string }>((resolver, rechazar) => {
    const xhr = new XMLHttpRequest();
    registrar(xhr);
    xhr.open('PUT', url);
    xhr.upload.onprogress = (e) => alAvanzar(e.loaded);
    xhr.onload = () => {
      let cuerpoRespuesta: { partNumber?: number; etag?: string; error?: string } = {};
      try {
        cuerpoRespuesta = JSON.parse(xhr.responseText);
      } catch {
        // Sin JSON: se informa con el código.
      }
      if (xhr.status === 200 && cuerpoRespuesta.etag && cuerpoRespuesta.partNumber) {
        resolver({ partNumber: cuerpoRespuesta.partNumber, etag: cuerpoRespuesta.etag });
      } else {
        const error = new Error(cuerpoRespuesta.error ?? `Error ${xhr.status}`) as Error & { status?: number };
        error.status = xhr.status;
        rechazar(error);
      }
    };
    xhr.onerror = () => rechazar(Object.assign(new Error('Se cortó la conexión'), { status: 0 }));
    xhr.onabort = () => rechazar(new Cancelada());
    xhr.send(cuerpo);
  });
}

async function pedirJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
  const cuerpo = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(cuerpo.error ?? `Error ${res.status}`);
  return cuerpo;
}

export function DriveExplorer({ carpetas, usado, cuota, yo, extensiones, maxArchivo }: Props) {
  const router = useRouter();
  const [carpetaId, setCarpetaId] = useState(yo.id);
  const [cola, setCola] = useState<ItemCola[]>([]);
  const [filtro, setFiltro] = useState<'todo' | 'imagen' | 'video' | 'documento'>('todo');
  const [busqueda, setBusqueda] = useState('');
  const [arrastrando, setArrastrando] = useState(false);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [alerta, setAlerta] = useState<string | null>(null);

  const solicitudes = useRef(new Map<string, XMLHttpRequest>());
  const subidas = useRef(new Map<string, number>());
  const cancelados = useRef(new Set<string>());
  const entradaArchivos = useRef<HTMLInputElement>(null);
  const entradaCarpeta = useRef<HTMLInputElement>(null);

  const actualizar = useCallback((clave: string, cambios: Partial<ItemCola>) => {
    setCola((actual) => actual.map((item) => (item.clave === clave ? { ...item, ...cambios } : item)));
  }, []);

  // El atributo no estándar para elegir una carpeta entera no está en los
  // tipos de React: se pone a mano.
  useEffect(() => {
    entradaCarpeta.current?.setAttribute('webkitdirectory', '');
  }, []);

  const subir = useCallback(
    async (item: ItemCola) => {
      const { archivo, clave } = item;
      actualizar(clave, { estado: 'subiendo', progreso: 0, error: undefined });
      try {
        const subida = await pedirJson<SubidaIniciada>('/api/panel/drive/subidas', {
          method: 'POST',
          body: JSON.stringify({ nombre: item.nombre, tamano: archivo.size }),
        });
        subidas.current.set(clave, subida.id);

        const partes: { partNumber: number; etag: string }[] = [];
        let enviados = 0;
        let ultimoAviso = 0;

        for (let n = 1; n <= subida.partes; n += 1) {
          if (cancelados.current.has(clave)) throw new Cancelada();
          const trozo = archivo.slice((n - 1) * subida.tamanoParte, Math.min(n * subida.tamanoParte, archivo.size));

          for (let intento = 1; ; intento += 1) {
            try {
              const parte = await subirParte(
                `/drive/subidas/${subida.id}/partes/${n}`,
                trozo,
                (bytes) => {
                  const progreso = (enviados + bytes) / archivo.size;
                  // Sin actualizar la pantalla en cada evento: basta cada 1 %.
                  if (progreso - ultimoAviso >= 0.01) {
                    ultimoAviso = progreso;
                    actualizar(clave, { progreso });
                  }
                },
                (xhr) => solicitudes.current.set(clave, xhr),
              );
              partes.push(parte);
              break;
            } catch (e) {
              const status = (e as { status?: number }).status ?? 0;
              const reintentable = !(e instanceof Cancelada) && (status === 0 || status >= 500 || status === 409);
              if (!reintentable || intento >= REINTENTOS) throw e;
              await new Promise((r) => setTimeout(r, 1000 * intento));
            }
          }
          enviados += trozo.size;
        }

        await pedirJson(`/api/panel/drive/subidas/${subida.id}`, { method: 'POST', body: JSON.stringify({ partes }) });
        subidas.current.delete(clave);
        actualizar(clave, { estado: 'listo', progreso: 1 });
      } catch (e) {
        const id = subidas.current.get(clave);
        subidas.current.delete(clave);
        // Lo que quedó a medias se cancela para liberar la cuota reservada.
        if (id) fetch(`/api/panel/drive/subidas/${id}`, { method: 'DELETE' }).catch(() => {});
        if (e instanceof Cancelada) actualizar(clave, { estado: 'cancelado' });
        else actualizar(clave, { estado: 'error', error: e instanceof Error ? e.message : 'No se pudo subir' });
      } finally {
        solicitudes.current.delete(clave);
      }
    },
    [actualizar],
  );

  // Arranca subidas mientras haya cupo.
  useEffect(() => {
    const enCurso = cola.filter((i) => i.estado === 'subiendo').length;
    const siguientes = cola.filter((i) => i.estado === 'esperando').slice(0, Math.max(0, EN_PARALELO - enCurso));
    for (const item of siguientes) void subir(item);
  }, [cola, subir]);

  const activas = cola.some((i) => i.estado === 'esperando' || i.estado === 'subiendo');
  const terminadas = cola.filter((i) => i.estado === 'listo').length;

  // Cuando la cola se vacía, la lista se recarga con lo recién subido.
  const habiaActivas = useRef(false);
  useEffect(() => {
    if (habiaActivas.current && !activas && terminadas) router.refresh();
    habiaActivas.current = activas;
  }, [activas, terminadas, router]);

  // Cerrar la pestaña corta las subidas: se avisa antes.
  useEffect(() => {
    if (!activas) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [activas]);

  function agregar(archivos: FileList | File[]) {
    setAlerta(null);
    setCarpetaId(yo.id);
    const nuevos: ItemCola[] = [...archivos].map((archivo) => {
      const nombre = (archivo as File & { webkitRelativePath?: string }).webkitRelativePath || archivo.name;
      let error: string | undefined;
      if (!extensiones.includes(extension(nombre))) error = 'Tipo de archivo no aceptado';
      else if (archivo.size === 0) error = 'Archivo vacío (las carpetas se suben con «Subir carpeta»)';
      else if (archivo.size > maxArchivo) error = `Pasa del máximo de ${tamano(maxArchivo)}`;
      return {
        clave: crypto.randomUUID(),
        archivo,
        nombre,
        estado: error ? 'error' : 'esperando',
        progreso: 0,
        error,
      };
    });
    setCola((actual) => [...actual, ...nuevos]);
  }

  function cancelar(item: ItemCola) {
    cancelados.current.add(item.clave);
    if (item.estado === 'esperando') actualizar(item.clave, { estado: 'cancelado' });
    solicitudes.current.get(item.clave)?.abort();
  }

  function soltar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastrando(false);
    if (e.dataTransfer.files.length) agregar(e.dataTransfer.files);
  }

  async function borrar(id: number) {
    setAlerta(null);
    try {
      await pedirJson(`/api/panel/drive/archivos/${id}`, { method: 'DELETE' });
      setConfirmando(null);
      router.refresh();
    } catch (e) {
      setAlerta(e instanceof Error ? e.message : 'No pudimos borrar el archivo.');
    }
  }

  const carpeta = carpetas.find((c) => c.usuarioId === carpetaId) ?? carpetas[0];
  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return (carpeta?.archivos ?? []).filter(
      (a) => (filtro === 'todo' || a.categoria === filtro) && (!texto || a.nombre.toLowerCase().includes(texto)),
    );
  }, [carpeta, filtro, busqueda]);

  const porcentaje = Math.min(100, (usado / cuota) * 100);
  const pendientes = cola.filter((i) => i.estado !== 'cancelado');

  return (
    <>
      <div className="panel__cabecera">
        <h1 className="panel__title">Drive</h1>
      </div>
      <p className="panel__intro">
        Fotos, videos y documentos del equipo. Cada uno sube a su carpeta y todos ven todas. Hasta {tamano(maxArchivo)} por
        archivo.
      </p>

      <div className="drive__uso" role="group" aria-label="Espacio usado">
        <div className="drive__uso-barra">
          <span className={`drive__uso-relleno${porcentaje > 90 ? ' drive__uso-relleno--lleno' : ''}`} style={{ width: `${porcentaje}%` }} />
        </div>
        <p className="drive__uso-texto">
          {tamano(usado)} de {tamano(cuota)} usados
        </p>
      </div>

      {alerta ? (
        <p className="acceso__alerta" role="alert">
          {alerta}
        </p>
      ) : null}

      <div
        className={`drive__zona${arrastrando ? ' drive__zona--activa' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={soltar}
      >
        <p className="drive__zona-titulo">Arrastra archivos aquí</p>
        <p className="drive__zona-texto">Se suben a tu carpeta, de a {EN_PARALELO} a la vez.</p>
        <div className="drive__zona-botones">
          <button type="button" className="button button--primary button--sm" onClick={() => entradaArchivos.current?.click()}>
            Elegir archivos
          </button>
          <button type="button" className="button button--outline button--sm" onClick={() => entradaCarpeta.current?.click()}>
            Subir carpeta
          </button>
        </div>
        <input
          ref={entradaArchivos}
          className="visually-hidden"
          type="file"
          multiple
          accept={extensiones.map((e) => `.${e}`).join(',')}
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files?.length) agregar(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={entradaCarpeta}
          className="visually-hidden"
          type="file"
          multiple
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files?.length) agregar(e.target.files);
            e.target.value = '';
          }}
        />
        <p className="drive__zona-nota">Tipos aceptados: {extensiones.join(', ')}.</p>
      </div>

      {pendientes.length ? (
        <section className="drive__cola" aria-label="Subidas">
          <div className="drive__cola-cabecera">
            <h2 className="drive__cola-titulo">
              Subidas: {terminadas} de {pendientes.length} listas
            </h2>
            {!activas ? (
              <button type="button" className="panel__accion" onClick={() => setCola([])}>
                Limpiar lista
              </button>
            ) : null}
          </div>
          <ul className="drive__cola-lista">
            {pendientes.map((item) => (
              <li key={item.clave} className={`drive__subida drive__subida--${item.estado}`}>
                <span className="drive__subida-nombre" title={item.nombre}>
                  {item.nombre}
                </span>
                <span className="drive__subida-tamano">{tamano(item.archivo.size)}</span>
                <span className="drive__subida-barra" aria-hidden="true">
                  <span className="drive__subida-relleno" style={{ width: `${Math.round(item.progreso * 100)}%` }} />
                </span>
                <span className="drive__subida-estado" role={item.estado === 'error' ? 'alert' : undefined}>
                  {item.estado === 'esperando'
                    ? 'En espera'
                    : item.estado === 'subiendo'
                      ? `${Math.round(item.progreso * 100)} %`
                      : item.estado === 'listo'
                        ? 'Listo'
                        : item.error}
                </span>
                {item.estado === 'esperando' || item.estado === 'subiendo' ? (
                  <button type="button" className="panel__accion" onClick={() => cancelar(item)}>
                    Cancelar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="drive__carpetas" role="tablist" aria-label="Carpetas">
        {carpetas.map((c) => (
          <button
            key={c.usuarioId}
            type="button"
            role="tab"
            aria-selected={c.usuarioId === carpeta?.usuarioId}
            className={`drive__carpeta${c.usuarioId === carpeta?.usuarioId ? ' drive__carpeta--activa' : ''}`}
            onClick={() => setCarpetaId(c.usuarioId)}
          >
            <span className="drive__carpeta-nombre">{c.usuarioId === yo.id ? 'Mi carpeta' : c.nombre}</span>
            <span className="drive__carpeta-dato">
              {c.archivos.length} · {tamano(c.tamano)}
            </span>
          </button>
        ))}
      </div>

      <div className="drive__filtros">
        <select className="field__control field__control--select drive__filtro" value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} aria-label="Tipo">
          <option value="todo">Todo</option>
          <option value="imagen">Fotos</option>
          <option value="video">Videos</option>
          <option value="documento">Documentos</option>
        </select>
        <input
          className="field__control drive__busqueda"
          type="search"
          placeholder="Buscar por nombre"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar por nombre"
        />
      </div>

      {visibles.length ? (
        <ul className="drive__grilla">
          {visibles.map((a) => {
            const puedeBorrar = a.usuarioId === yo.id || yo.admin;
            const base = a.nombre.split('/').pop() ?? a.nombre;
            const ruta = a.nombre.includes('/') ? a.nombre.slice(0, a.nombre.lastIndexOf('/')) : '';
            return (
              <li key={a.id} className="drive__archivo">
                <a className="drive__vista" href={`/drive/archivos/${a.id}`} target="_blank" rel="noopener noreferrer">
                  {a.categoria === 'imagen' && !/hei[cf]$/.test(a.tipo) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="drive__miniatura" src={`/drive/archivos/${a.id}`} alt="" loading="lazy" />
                  ) : (
                    <span className={`drive__icono drive__icono--${a.categoria}`}>{extension(a.nombre).toUpperCase()}</span>
                  )}
                </a>
                <div className="drive__archivo-cuerpo">
                  <span className="drive__archivo-nombre" title={a.nombre}>
                    {base}
                  </span>
                  {ruta ? <span className="drive__archivo-ruta">{ruta}</span> : null}
                  <span className="drive__archivo-dato">
                    {tamano(a.tamano)} · {a.fecha}
                  </span>
                  <span className="panel__acciones drive__archivo-acciones">
                    <a className="panel__accion" href={`/drive/archivos/${a.id}?descargar=1`}>
                      Descargar
                    </a>
                    {puedeBorrar ? (
                      confirmando === a.id ? (
                        <>
                          <button type="button" className="panel__accion panel__accion--peligro" onClick={() => borrar(a.id)}>
                            Confirmar
                          </button>
                          <button type="button" className="panel__accion" onClick={() => setConfirmando(null)}>
                            No
                          </button>
                        </>
                      ) : (
                        <button type="button" className="panel__accion" onClick={() => setConfirmando(a.id)}>
                          Borrar
                        </button>
                      )
                    ) : null}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="panel__intro">
          {carpeta?.archivos.length ? 'Ningún archivo calza con ese filtro.' : 'Esta carpeta todavía está vacía.'}
        </p>
      )}
    </>
  );
}
