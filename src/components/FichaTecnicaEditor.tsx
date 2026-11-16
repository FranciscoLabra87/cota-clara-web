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
  const [guardados, setGuardados] = useState(antecedentes);
  const [interna, setInterna] = useState(false);
  const [sucio, setSucio] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [errorPdf, setErrorPdf] = useState('');
  const [mensajePdf, setMensajePdf] = useState('');
  const [fotosPdf, setFotosPdf] = useState<number[]>(() => (propiedad.imagenes ?? []).slice(0, 6).map((_, i) => i));
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

  async function descargar() {
    if (sucio) return;
    setOcupado(true);
    setErrorPdf('');
    setMensajePdf('');
    try {
      const parametros = new URLSearchParams({ version: interna ? 'interna' : 'cliente', fotos: fotosPdf.length ? fotosPdf.join(',') : 'ninguna' });
      const respuesta = await fetch(`/api/panel/propiedades/${propiedad.id}/ficha/pdf?${parametros}`);
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => ({})) as { error?: string };
        setErrorPdf(datos.error || 'No pudimos generar el PDF. Intenta de nuevo.');
        return;
      }
      if (!respuesta.headers.get('Content-Type')?.includes('application/pdf')) {
        setErrorPdf('La respuesta no es un PDF. Vuelve a iniciar sesión e intenta de nuevo.');
        return;
      }
      const archivo = await respuesta.blob();
      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = respuesta.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || `Ficha_Cota_Clara_CC-${propiedad.id}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMensajePdf('PDF listo. La descarga se inició; puedes abrirlo e imprimirlo en tamaño A4.');
    } catch {
      setErrorPdf('No pudimos conectar para descargar la ficha. Tus antecedentes siguen guardados.');
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
          <select id="ficha-version" className="field__control" disabled={ocupado} value={interna ? 'interna' : 'cliente'} onChange={(e) => setInterna(e.target.value === 'interna')}>
            <option value="cliente">Para cliente · sin observaciones internas</option>
            <option value="interna">Uso interno · incluye observaciones</option>
          </select>
          <p>Descarga una ficha A4 con portada, fotos, características y antecedentes, lista para imprimir y llevar a tus visitas.</p>
          <p className="field__hint">El PDF para clientes muestra los antecedentes disponibles. El resumen inferior también señala los datos que falta confirmar.</p>
          {propiedad.imagenes?.length ? <fieldset className="ficha-tool__fieldset" disabled={ocupado}>
            <legend>Fotografías del PDF · {fotosPdf.length}/6</legend>
            <p className="field__hint">La primera seleccionada se usa en la portada. Puedes incluir hasta 6 fotos.</p>
            <div className="ficha-tool__photos">{propiedad.imagenes.map((foto, i) => <label className="ficha-tool__photo" key={foto}>
              <img src={foto} alt={`Fotografía ${i + 1}`} loading="lazy" />
              <span><input type="checkbox" checked={fotosPdf.includes(i)} disabled={!fotosPdf.includes(i) && fotosPdf.length >= 6} onChange={(e) => setFotosPdf((actual) => e.target.checked ? [...actual, i] : actual.filter((n) => n !== i))} /> Foto {i + 1}</span>
            </label>)}</div>
          </fieldset> : null}
          <button className="button button--primary" type="button" onClick={descargar} disabled={ocupado || sucio}>{ocupado ? 'Preparando…' : 'Descargar PDF para imprimir'}</button>
          {sucio ? <p className="field__hint">Guarda los cambios antes de descargar.</p> : null}
          {errorPdf ? <p className="acceso__alerta" role="alert">{errorPdf}</p> : null}
          <p role="status">{mensajePdf}</p>
          {propiedad.estado !== 'PUBLICADA' ? <p>Propiedad en borrador: el documento queda marcado y no incluye enlace público.</p> : null}
        </div>
      </div>

      <article className="ficha-document" aria-label="Resumen de los datos de la ficha">
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
