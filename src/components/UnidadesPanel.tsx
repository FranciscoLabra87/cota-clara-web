'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { estadosUnidad, nombreEstadoUnidad, type EstadoUnidad, type TipologiaConStock, type Unidad } from '@/data/properties';
import { formatNumero } from '@/lib/format';
import { PLANTILLA_IMPORTACION } from '@/lib/importar-unidades';

// El stock de un proyecto: tipologías, unidades y la carga desde la planilla
// de la inmobiliaria. Corre en el navegador, así que importa solo tipos y
// constantes puras: nada de @/lib/unidades, que abre la base.

type Props = {
  propiedadId: number;
  tipologias: TipologiaConStock[];
  unidades: Unidad[];
};

type Campos = Record<string, string>;

const unidadVacia: Campos = {
  numero: '',
  tipologiaId: '',
  piso: '',
  orientacion: '',
  superficieUtil: '',
  superficieTotal: '',
  precioUF: '',
  descuentoPct: '',
  estacionamientos: '',
  bodegas: '',
  estado: 'disponible',
};

const tipologiaVacia: Campos = { codigo: '', dormitorios: '', banos: '', superficieUtil: '', superficieTerraza: '' };

const aCampos = (u: Unidad): Campos => ({
  numero: u.numero,
  tipologiaId: u.tipologiaId ? String(u.tipologiaId) : '',
  piso: u.piso == null ? '' : String(u.piso),
  orientacion: u.orientacion,
  superficieUtil: u.superficieUtil ? String(u.superficieUtil) : '',
  superficieTotal: u.superficieTotal ? String(u.superficieTotal) : '',
  precioUF: String(u.precioUF),
  descuentoPct: u.descuentoPct ? String(u.descuentoPct) : '',
  estacionamientos: String(u.estacionamientos),
  bodegas: String(u.bodegas),
  estado: u.estado,
});

type Plan = {
  columnas: string[];
  errores: { linea: number; error: string }[];
  tipologiasNuevas: string[];
  iguales: number;
  nuevas: { numero: string; precioUF: number; estado: EstadoUnidad; tipologia: string }[];
  cambian: {
    numero: string;
    antes: { precioUF: number; estado: EstadoUnidad };
    ahora: { precioUF: number; estado: EstadoUnidad };
  }[];
  sobran: string[];
};

export function UnidadesPanel({ propiedadId, tipologias, unidades }: Props) {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [nuevaUnidad, setNuevaUnidad] = useState<Campos | null>(null);
  const [editandoUnidad, setEditandoUnidad] = useState<number | null>(null);
  const [camposUnidad, setCamposUnidad] = useState<Campos>(unidadVacia);

  const [nuevaTipologia, setNuevaTipologia] = useState<Campos | null>(null);
  const [seleccion, setSeleccion] = useState<number[]>([]);
  const [estadoMasivo, setEstadoMasivo] = useState<EstadoUnidad>('vendida');

  const [texto, setTexto] = useState('');
  const [reemplazar, setReemplazar] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);

  const base = `/api/panel/propiedades/${propiedadId}`;

  async function pedir(url: string, init: RequestInit): Promise<unknown | null> {
    setAlerta(null);
    setAviso(null);
    setTrabajando(true);
    try {
      const res = await fetch(url, init);
      const cuerpo = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setAlerta(cuerpo.error ?? 'No pudimos completar la acción.');
        return null;
      }
      return cuerpo;
    } catch {
      setAlerta('No pudimos conectar. Intenta de nuevo.');
      return null;
    } finally {
      setTrabajando(false);
    }
  }

  const json = (body: unknown, method = 'POST'): RequestInit => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  async function guardarUnidad() {
    const cuerpo = { ...camposUnidad, tipologiaId: camposUnidad.tipologiaId || null };
    const url = editandoUnidad ? `${base}/unidades/${editandoUnidad}` : `${base}/unidades`;
    const hecho = await pedir(url, json(cuerpo, editandoUnidad ? 'PUT' : 'POST'));
    if (!hecho) return;
    setNuevaUnidad(null);
    setEditandoUnidad(null);
    setCamposUnidad(unidadVacia);
    router.refresh();
  }

  async function borrarUnidad(id: number) {
    if (await pedir(`${base}/unidades/${id}`, { method: 'DELETE' })) router.refresh();
  }

  async function guardarTipologia() {
    if (!(await pedir(`${base}/tipologias`, json(nuevaTipologia)))) return;
    setNuevaTipologia(null);
    router.refresh();
  }

  async function borrarTipologia(id: number) {
    if (await pedir(`${base}/tipologias/${id}`, { method: 'DELETE' })) router.refresh();
  }

  async function aplicarEstado() {
    const hecho = (await pedir(`${base}/unidades`, json({ ids: seleccion, estado: estadoMasivo }, 'PATCH'))) as {
      cambiadas?: number;
    } | null;
    if (!hecho) return;
    setAviso(`${hecho.cambiadas ?? 0} unidades quedaron como ${nombreEstadoUnidad(estadoMasivo).toLowerCase()}.`);
    setSeleccion([]);
    router.refresh();
  }

  async function previsualizar() {
    const hecho = (await pedir(`${base}/unidades/importar`, json({ texto, reemplazar }))) as Plan | null;
    if (hecho) setPlan(hecho);
  }

  async function confirmarImportacion() {
    const hecho = (await pedir(`${base}/unidades/importar`, json({ texto, reemplazar, confirmar: true }))) as {
      creadas?: number;
      actualizadas?: number;
      borradas?: number;
      tipologiasCreadas?: number;
    } | null;
    if (!hecho) return;
    setAviso(
      `${hecho.creadas ?? 0} nuevas, ${hecho.actualizadas ?? 0} actualizadas, ${hecho.borradas ?? 0} borradas y ` +
        `${hecho.tipologiasCreadas ?? 0} tipologías creadas.`,
    );
    setPlan(null);
    setTexto('');
    router.refresh();
  }

  const campo = (nombre: string, etiqueta: string, tipo = 'text') => (
    <label className="field field--compacto">
      <span className="field__label">{etiqueta}</span>
      <input
        className="field__control"
        type={tipo}
        value={camposUnidad[nombre] ?? ''}
        onChange={(e) => setCamposUnidad({ ...camposUnidad, [nombre]: e.target.value })}
      />
    </label>
  );

  const formularioUnidad = (
    <div className="unidades__formulario">
      {campo('numero', 'Número')}
      <label className="field field--compacto">
        <span className="field__label">Tipología</span>
        <select
          className="field__control field__control--select"
          value={camposUnidad.tipologiaId}
          onChange={(e) => setCamposUnidad({ ...camposUnidad, tipologiaId: e.target.value })}
        >
          <option value="">Sin tipología</option>
          {tipologias.map((t) => (
            <option key={t.id} value={t.id}>
              {t.codigo}
            </option>
          ))}
        </select>
      </label>
      {campo('piso', 'Piso')}
      {campo('orientacion', 'Orientación')}
      {campo('superficieUtil', 'm² útiles')}
      {campo('superficieTotal', 'm² totales')}
      {campo('precioUF', 'Precio UF')}
      {campo('descuentoPct', 'Dcto. %')}
      {campo('estacionamientos', 'Estac.')}
      {campo('bodegas', 'Bodegas')}
      <label className="field field--compacto">
        <span className="field__label">Estado</span>
        <select
          className="field__control field__control--select"
          value={camposUnidad.estado}
          onChange={(e) => setCamposUnidad({ ...camposUnidad, estado: e.target.value })}
        >
          {estadosUnidad.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>
      </label>
      <div className="unidades__formulario-acciones">
        <button type="button" className="button button--primary button--sm" onClick={guardarUnidad} disabled={trabajando}>
          Guardar unidad
        </button>
        <button
          type="button"
          className="button button--outline button--sm"
          onClick={() => {
            setNuevaUnidad(null);
            setEditandoUnidad(null);
            setCamposUnidad(unidadVacia);
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );

  return (
    <>
      {alerta ? (
        <p className="acceso__alerta" role="alert">
          {alerta}
        </p>
      ) : null}
      {aviso ? <p className="panel__aviso">{aviso}</p> : null}

      <section className="unidades__bloque" aria-labelledby="tipologias-titulo">
        <div className="panel__cabecera">
          <h2 className="unidades__titulo" id="tipologias-titulo">
            Tipologías
          </h2>
          <button
            type="button"
            className="button button--outline button--sm"
            onClick={() => setNuevaTipologia(nuevaTipologia ? null : { ...tipologiaVacia })}
          >
            {nuevaTipologia ? 'Cancelar' : 'Agregar tipología'}
          </button>
        </div>

        {nuevaTipologia ? (
          <div className="unidades__formulario">
            {(
              [
                ['codigo', 'Código'],
                ['dormitorios', 'Dormitorios'],
                ['banos', 'Baños'],
                ['superficieUtil', 'm² útiles'],
                ['superficieTerraza', 'm² terraza'],
              ] as const
            ).map(([nombre, etiqueta]) => (
              <label key={nombre} className="field field--compacto">
                <span className="field__label">{etiqueta}</span>
                <input
                  className="field__control"
                  value={nuevaTipologia[nombre] ?? ''}
                  onChange={(e) => setNuevaTipologia({ ...nuevaTipologia, [nombre]: e.target.value })}
                />
              </label>
            ))}
            <div className="unidades__formulario-acciones">
              <button type="button" className="button button--primary button--sm" onClick={guardarTipologia} disabled={trabajando}>
                Guardar tipología
              </button>
            </div>
          </div>
        ) : null}

        {tipologias.length === 0 ? (
          <p className="panel__intro">
            Todavía no hay tipologías. Si las nombra, la planilla las crea sola al importar el stock.
          </p>
        ) : (
          <div className="panel__tabla-envoltorio">
            <table className="panel__tabla">
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Dorm.</th>
                  <th scope="col">Baños</th>
                  <th scope="col">m² útiles</th>
                  <th scope="col">Unidades</th>
                  <th scope="col">Disponibles</th>
                  <th scope="col">Desde</th>
                  <th scope="col">
                    <span className="visually-hidden">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tipologias.map((t) => (
                  <tr key={t.id}>
                    <td>{t.codigo}</td>
                    <td>{t.dormitorios || '—'}</td>
                    <td>{t.banos || '—'}</td>
                    <td>{t.superficieUtil ? `${formatNumero(t.superficieUtil, 2)} m²` : '—'}</td>
                    <td>{t.total}</td>
                    <td>{t.disponibles}</td>
                    <td>{t.desdeUF ? `UF ${formatNumero(t.desdeUF)}` : '—'}</td>
                    <td className="panel__acciones">
                      <button type="button" className="panel__accion panel__accion--peligro" onClick={() => borrarTipologia(t.id)} disabled={trabajando}>
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="unidades__bloque" aria-labelledby="unidades-titulo">
        <div className="panel__cabecera">
          <h2 className="unidades__titulo" id="unidades-titulo">
            Unidades ({unidades.length})
          </h2>
          <button
            type="button"
            className="button button--outline button--sm"
            onClick={() => {
              setEditandoUnidad(null);
              setCamposUnidad({ ...unidadVacia });
              setNuevaUnidad(nuevaUnidad ? null : { ...unidadVacia });
            }}
          >
            {nuevaUnidad ? 'Cancelar' : 'Agregar unidad'}
          </button>
        </div>

        {nuevaUnidad || editandoUnidad ? formularioUnidad : null}

        {seleccion.length ? (
          <div className="unidades__masivo">
            <span>{seleccion.length} seleccionadas</span>
            <select className="field__control field__control--select" value={estadoMasivo} onChange={(e) => setEstadoMasivo(e.target.value as EstadoUnidad)}>
              {estadosUnidad.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
            <button type="button" className="button button--primary button--sm" onClick={aplicarEstado} disabled={trabajando}>
              Cambiar estado
            </button>
            <button type="button" className="button button--outline button--sm" onClick={() => setSeleccion([])}>
              Quitar selección
            </button>
          </div>
        ) : null}

        {unidades.length === 0 ? (
          <p className="panel__intro">Sin unidades cargadas. Pega la planilla más abajo o agrégalas una a una.</p>
        ) : (
          <div className="panel__tabla-envoltorio">
            <table className="panel__tabla">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="visually-hidden">Seleccionar</span>
                  </th>
                  <th scope="col">Unidad</th>
                  <th scope="col">Tipología</th>
                  <th scope="col">Piso</th>
                  <th scope="col">m² útiles</th>
                  <th scope="col">Precio</th>
                  <th scope="col">Estado</th>
                  <th scope="col">
                    <span className="visually-hidden">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {unidades.map((u) => (
                  <tr key={u.id} className={u.estado === 'disponible' ? undefined : 'panel__fila--inactiva'}>
                    <td>
                      <input
                        type="checkbox"
                        checked={seleccion.includes(u.id)}
                        aria-label={`Seleccionar la unidad ${u.numero}`}
                        onChange={(e) =>
                          setSeleccion(e.target.checked ? [...seleccion, u.id] : seleccion.filter((id) => id !== u.id))
                        }
                      />
                    </td>
                    <td>{u.numero}</td>
                    <td>{tipologias.find((t) => t.id === u.tipologiaId)?.codigo ?? '—'}</td>
                    <td>{u.piso ?? '—'}</td>
                    <td>{u.superficieUtil ? formatNumero(u.superficieUtil, 2) : '—'}</td>
                    <td>UF {formatNumero(u.precioUF)}</td>
                    <td>{nombreEstadoUnidad(u.estado)}</td>
                    <td className="panel__acciones">
                      <button
                        type="button"
                        className="panel__accion"
                        onClick={() => {
                          setNuevaUnidad(null);
                          setEditandoUnidad(u.id);
                          setCamposUnidad(aCampos(u));
                        }}
                      >
                        Editar
                      </button>
                      <button type="button" className="panel__accion panel__accion--peligro" onClick={() => borrarUnidad(u.id)} disabled={trabajando}>
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="unidades__bloque" aria-labelledby="importar-titulo">
        <h2 className="unidades__titulo" id="importar-titulo">
          Cargar desde la planilla
        </h2>
        <p className="panel__intro">
          Pega las filas desde Excel con la primera fila nombrando las columnas. Se reconocen al menos
          «numero» y «precio uf»; el resto es opcional. Una unidad que ya existe se actualiza por su número, no se duplica.
        </p>
        <details className="unidades__plantilla">
          <summary>Ver el formato</summary>
          <pre>{PLANTILLA_IMPORTACION}</pre>
        </details>
        <label className="field">
          <span className="field__label">Planilla</span>
          <textarea
            className="field__control field__control--textarea"
            rows={8}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setPlan(null);
            }}
          />
        </label>
        <label className="unidades__casilla">
          <input type="checkbox" checked={reemplazar} onChange={(e) => setReemplazar(e.target.checked)} />
          Borrar las unidades que la planilla no mencione
        </label>
        <div className="unidades__formulario-acciones">
          <button type="button" className="button button--outline button--sm" onClick={previsualizar} disabled={trabajando || !texto.trim()}>
            Previsualizar
          </button>
          {plan ? (
            <button type="button" className="button button--primary button--sm" onClick={confirmarImportacion} disabled={trabajando}>
              Confirmar la carga
            </button>
          ) : null}
        </div>

        {plan ? (
          <div className="unidades__plan">
            <ul className="unidades__plan-resumen">
              <li>{plan.nuevas.length} nuevas</li>
              <li>{plan.cambian.length} con cambios</li>
              <li>{plan.iguales} sin cambios</li>
              <li>
                {plan.sobran.length} guardadas que no vienen en la planilla
                {reemplazar && plan.sobran.length ? ' (se borrarán)' : ''}
              </li>
              {plan.tipologiasNuevas.length ? <li>Tipologías nuevas: {plan.tipologiasNuevas.join(', ')}</li> : null}
            </ul>
            {plan.cambian.length ? (
              <table className="panel__tabla">
                <thead>
                  <tr>
                    <th scope="col">Unidad</th>
                    <th scope="col">Antes</th>
                    <th scope="col">Ahora</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.cambian.slice(0, 50).map((c) => (
                    <tr key={c.numero}>
                      <td>{c.numero}</td>
                      <td>
                        UF {formatNumero(c.antes.precioUF)} · {nombreEstadoUnidad(c.antes.estado)}
                      </td>
                      <td>
                        UF {formatNumero(c.ahora.precioUF)} · {nombreEstadoUnidad(c.ahora.estado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {plan.errores.length ? (
              <ul className="unidades__errores">
                {plan.errores.slice(0, 20).map((e) => (
                  <li key={e.linea}>
                    Línea {e.linea}: {e.error}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
    </>
  );
}
