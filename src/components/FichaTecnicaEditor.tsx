'use client';

import { useRef, useState } from 'react';
import { Logo } from './Logo';
import { site } from '@/data/site';
import { presentarFicha } from '@/lib/ficha-presentacion';
import type { FichaTecnica } from '@/lib/ficha-tecnica';
import type { PropiedadAdmin } from '@/lib/propiedades';

const campos = [
  ['rolSii', 'Rol de avalúo SII', 'Ej. 1234-56'],
  ['destino', 'Destino según SII', 'Ej. Habitacional'],
  ['materialidad', 'Materialidad', 'Ej. Hormigón armado'],
  ['calefaccion', 'Calefacción', 'Ej. Central por radiadores'],
  ['inscripcion', 'Inscripción CBR', 'Fojas, número, año y Conservador competente'],
  ['fuenteAntecedentes', 'Fuente de los antecedentes', 'Documento, emisor y fecha; no incluyas datos personales'],
  ['revisadoPor', 'Revisado por', 'Nombre del responsable de revisión'],
] as const;

export function FichaTecnicaEditor({ propiedad, antecedentes, emitida }: { propiedad: PropiedadAdmin; antecedentes: FichaTecnica; emitida: string }) {
  const formulario = useRef<HTMLFormElement>(null);
  const documento = useRef<HTMLElement>(null);
  const [guardados, setGuardados] = useState(antecedentes);
  const [interna, setInterna] = useState(false);
  const [sucio, setSucio] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const ficha = presentarFicha(propiedad, guardados, interna);

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = Object.fromEntries(new FormData(evento.currentTarget));
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      const respuesta = await fetch(`/api/panel/propiedades/${propiedad.id}/ficha`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
      });
      const cuerpo = await respuesta.json() as { error?: string; datos?: FichaTecnica };
      if (!respuesta.ok) {
        setError(cuerpo.error || 'No pudimos guardar los antecedentes.');
        return;
      }
      setGuardados(cuerpo.datos ?? antecedentes);
      setSucio(false);
      setMensaje('Antecedentes guardados. La ficha está lista para generar.');
    } catch {
      setError('No pudimos conectar. Tus cambios siguen en el formulario.');
    } finally { setOcupado(false); }
  }

  async function imprimir() {
    if (sucio) return;
    setOcupado(true);
    try {
      await document.fonts.ready;
      await Promise.all(Array.from(documento.current?.querySelectorAll('img') ?? []).map((img) => img.decode().catch(() => undefined)));
      window.print();
    } finally { setOcupado(false); }
  }

  return (
    <div className="ficha-tool">
      <div className="ficha-tool__workspace">
        <form ref={formulario} className="ficha-tool__form" onSubmit={guardar} onChange={() => { setSucio(true); setMensaje(''); }}>
          <h2>Antecedentes de la ficha</h2>
          <p>Los datos del aviso se incorporan automáticamente. Completa los antecedentes disponibles; los campos vacíos se muestran como «No informado».</p>
          <fieldset className="ficha-tool__fieldset" disabled={ocupado}>
          <legend className="visually-hidden">Datos técnicos y documentales</legend>
          <div className="ficha-tool__fields">
            {campos.map(([nombre, etiqueta, ayuda]) => (
              <div className="field" key={nombre}>
                <label className="field__label" htmlFor={`ficha-${nombre}`}>{etiqueta}</label>
                <input className="field__control" id={`ficha-${nombre}`} name={nombre} defaultValue={antecedentes[nombre] || ''} placeholder={ayuda} maxLength={nombre === 'fuenteAntecedentes' ? 300 : nombre === 'inscripcion' ? 200 : nombre === 'revisadoPor' ? 100 : 80} />
              </div>
            ))}
            {([['avaluoFiscal', 'Avalúo fiscal (CLP)'], ['contribuciones', 'Contribuciones por cuota (CLP)'], ['pisos', 'Número de pisos']] as const).map(([nombre, etiqueta]) => (
              <div className="field" key={nombre}>
                <label className="field__label" htmlFor={`ficha-${nombre}`}>{etiqueta}</label>
                <input className="field__control" id={`ficha-${nombre}`} name={nombre} type="number" step="1" min={nombre === 'pisos' ? 1 : 0} max={nombre === 'pisos' ? 200 : nombre === 'avaluoFiscal' ? 100000000000 : 1000000000} defaultValue={antecedentes[nombre] ?? ''} />
              </div>
            ))}
            {([
              ['estadoConservacion', 'Estado de conservación', ['Nuevo', 'Excelente', 'Bueno', 'Regular', 'Para remodelar']],
              ['recepcionFinal', 'Recepción final municipal', ['Sí', 'No', 'En trámite']],
              ['estadoAntecedentes', 'Estado de revisión', ['Pendientes', 'Informados', 'Revisados documentalmente']],
            ] as const).map(([nombre, etiqueta, opciones]) => (
              <div className="field" key={nombre}>
                <label className="field__label" htmlFor={`ficha-${nombre}`}>{etiqueta}</label>
                <select className="field__control" id={`ficha-${nombre}`} name={nombre} defaultValue={antecedentes[nombre] || (nombre === 'estadoAntecedentes' ? 'Pendientes' : '')}>
                  <option value="">No informado</option>
                  {opciones.map((opcion) => <option key={opcion}>{opcion}</option>)}
                </select>
              </div>
            ))}
            <div className="field">
              <label className="field__label" htmlFor="ficha-fechaRevision">Fecha de revisión documental</label>
              <input className="field__control" id="ficha-fechaRevision" name="fechaRevision" type="date" defaultValue={antecedentes.fechaRevision || ''} />
            </div>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="ficha-observaciones">Observaciones internas</label>
            <textarea className="field__control" id="ficha-observaciones" name="observaciones" maxLength={1000} rows={4} defaultValue={antecedentes.observaciones || ''} />
            <p className="field__hint">Solo se incluyen al elegir la versión interna.</p>
          </div>
          </fieldset>
          <button className="button button--primary" type="submit" disabled={ocupado}>{ocupado ? 'Procesando…' : 'Guardar antecedentes'}</button>
          {error ? <p role="alert" className="acceso__alerta">{error}</p> : null}
          <p role="status">{mensaje || (sucio ? 'Cambios sin guardar. Guarda para actualizar la vista previa.' : '')}</p>
        </form>

        <div className="ficha-tool__export">
          <h2>Generar ficha técnica</h2>
          <label htmlFor="ficha-version">Versión del documento</label>
          <select id="ficha-version" className="field__control" value={interna ? 'interna' : 'cliente'} onChange={(e) => setInterna(e.target.value === 'interna')}>
            <option value="cliente">Para cliente · sin observaciones internas</option>
            <option value="interna">Uso interno · incluye observaciones</option>
          </select>
          <p>La impresión abre el diálogo del navegador. Elige «Guardar como PDF» para descargar la ficha.</p>
          <button className="button button--primary" type="button" onClick={imprimir} disabled={ocupado || sucio}>Imprimir / guardar PDF</button>
          {propiedad.estado !== 'PUBLICADA' ? <p>Propiedad en borrador: el documento queda marcado y no incluye enlace público.</p> : null}
        </div>
      </div>

      <article ref={documento} className="ficha-document" aria-label="Vista previa de la ficha técnica">
        <header className="ficha-document__header">
          <Logo />
          <div><p>Ficha técnica · CC-{propiedad.id}</p><p>{emitida}</p></div>
        </header>
        <p className="ficha-document__version">{interna ? 'Uso interno · confidencial' : 'Información para clientes'}{propiedad.estado === 'PUBLICADA' ? '' : ' · BORRADOR'}</p>
        <h2 className="ficha-document__title">{ficha.titulo}</h2>
        <p className="ficha-document__location">{[propiedad.sector, propiedad.comuna].filter(Boolean).join(', ')}</p>
        {propiedad.imagenes?.[0] ? <img className="ficha-document__photo" src={propiedad.imagenes[0]} alt={ficha.titulo} /> : null}
        {ficha.secciones.map((seccion) => (
          <section className="ficha-document__section" key={seccion.titulo}>
            <h3>{seccion.titulo}</h3>
            <dl>{seccion.filas.map((fila) => <div key={fila.etiqueta}><dt>{fila.etiqueta}</dt><dd>{fila.valor}</dd></div>)}</dl>
          </section>
        ))}
        <section className="ficha-document__section">
          <h3>Descripción y equipamiento</h3>
          {(propiedad.descripcion.length ? propiedad.descripcion : [propiedad.resumen]).map((parrafo, i) => <p key={i}>{parrafo}</p>)}
          {propiedad.caracteristicas.length ? <p>{propiedad.caracteristicas.join(' · ')}</p> : null}
        </section>
        <p className="ficha-document__note">Antecedentes según la información disponible a la fecha indicada. El avalúo fiscal no es una tasación comercial. Esta ficha no reemplaza certificados oficiales ni el estudio de títulos. Confirma vigencia, superficies y condiciones antes de contratar.</p>
        <footer className="ficha-document__footer">
          <strong>{site.nombre} · {site.lema}</strong>
          <span>{site.telefono} · {site.email}</span>
          {ficha.enlace ? <a href={ficha.enlace}>{ficha.enlace}</a> : null}
        </footer>
      </article>
    </div>
  );
}
