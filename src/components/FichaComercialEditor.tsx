'use client';

import { useState } from 'react';
import { Logo } from './Logo';
import { site } from '@/data/site';
import {
  avisosFicha, bloquesDescripcion, candidatosDestacados, perfilFicha,
  MAX_BAJADA_FICHA, MAX_DESTACADOS_FICHA, MAX_TITULO_FICHA,
} from '@/lib/ficha-comercial-contenido';
import { ATRIBUCION_MAPA, cuadriculaMapa, urlTesela } from '@/lib/ficha-mapa-cuadricula';
import { MAX_FOTOS_COMERCIAL_PDF } from '@/lib/ficha-limites';
import { formatNumero } from '@/lib/format';
import type { PropiedadAdmin } from '@/lib/propiedades';

export function FichaComercialEditor({ propiedad }: { propiedad: PropiedadAdmin }) {
  const fotos = propiedad.imagenes ?? [];
  const [elegidas, setElegidas] = useState<number[]>(() => fotos.slice(0, 6).map((_, indice) => indice));
  const [titulo, setTitulo] = useState('');
  const [bajada, setBajada] = useState('');
  const [destacados, setDestacados] = useState<number[]>([]);
  const [conMapa, setConMapa] = useState(true);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const candidatos = candidatosDestacados(propiedad);
  const avisos = avisosFicha(propiedad);
  const perfil = perfilFicha(propiedad, { titulo, bajada, destacados, mapa: conMapa });
  const bloques = bloquesDescripcion(propiedad, perfil.bajada);
  const otrosDestacados = candidatos.filter((candidato) => !perfil.destacados.includes(candidato));
  const seleccionadas = elegidas.map((indice) => fotos[indice]);
  const tieneCoordenadas = propiedad.latitud != null && propiedad.longitud != null;
  const cuadricula = conMapa && tieneCoordenadas ? cuadriculaMapa(propiedad.latitud!, propiedad.longitud!) : null;

  function limpiarAvisos() {
    setError('');
    setMensaje('');
  }

  function alternarFoto(indice: number) {
    setElegidas((actual) => actual.includes(indice)
      ? actual.filter((n) => n !== indice)
      : actual.length < MAX_FOTOS_COMERCIAL_PDF ? [...actual, indice] : actual);
    limpiarAvisos();
  }

  function alternarDestacado(indice: number) {
    setDestacados((actual) => actual.includes(indice)
      ? actual.filter((n) => n !== indice)
      : actual.length < MAX_DESTACADOS_FICHA ? [...actual, indice] : actual);
    limpiarAvisos();
  }

  async function descargar() {
    setDescargando(true);
    limpiarAvisos();
    try {
      const respuesta = await fetch(`/api/panel/propiedades/${propiedad.id}/ficha/comercial/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fotos: elegidas, titulo, bajada, destacados, mapa: conMapa }),
      });
      if (!respuesta.ok) {
        const cuerpo = await respuesta.json().catch(() => ({})) as { error?: string };
        setError(cuerpo.error || 'No pudimos generar la ficha comercial. Intenta de nuevo.');
        return;
      }
      if (!respuesta.headers.get('Content-Type')?.includes('application/pdf')) {
        setError('La respuesta no es un PDF. Vuelve a iniciar sesión e intenta de nuevo.');
        return;
      }
      const url = URL.createObjectURL(await respuesta.blob());
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = respuesta.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]
        || `Ficha_Comercial_Cota_Clara_CC-${propiedad.id}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMensaje('La descarga de la ficha comercial se inició.');
    } catch {
      setError('No pudimos conectar para descargar la ficha. Intenta de nuevo.');
    } finally {
      setDescargando(false);
    }
  }

  return <div className="ficha-comercial">
    <aside className="ficha-comercial__controls" aria-label="Opciones de la ficha comercial">
      <div className="ficha-comercial__control-head">
        <span className="ficha-comercial__step">01 / Revisar</span>
        <h2>Ficha comercial</h2>
        <p>La ficha se arma con los datos del aviso y se adapta al tipo de propiedad y a su operación. Acá ajustas lo que la distingue.</p>
      </div>

      {avisos.length ? <ul className="ficha-comercial__avisos">
        {avisos.map((aviso, indice) => <li
          className={`ficha-comercial__aviso ficha-comercial__aviso--${aviso.nivel}`}
          key={`${aviso.nivel}-${indice}`}
        >{aviso.texto}</li>)}
      </ul> : <p className="ficha-comercial__aviso ficha-comercial__aviso--ok">El aviso tiene todos los datos que usa la ficha.</p>}

      <fieldset className="ficha-comercial__field" disabled={descargando}>
        <legend>02 / Ajustar el mensaje</legend>
        <p>Solo para esta descarga: no cambia el aviso publicado. Si los dejas vacíos, se usan el título y el resumen del aviso.</p>
        <label className="field">
          <span className="field__label">Titular de la ficha</span>
          <input
            className="field__control"
            type="text"
            maxLength={MAX_TITULO_FICHA}
            value={titulo}
            placeholder={perfil.titulo}
            onChange={(evento) => { setTitulo(evento.target.value); limpiarAvisos(); }}
          />
          <span className="ficha-comercial__contador">{titulo.length}/{MAX_TITULO_FICHA}</span>
        </label>
        <label className="field">
          <span className="field__label">Bajada</span>
          <textarea
            className="field__control field__control--textarea"
            rows={3}
            maxLength={MAX_BAJADA_FICHA}
            value={bajada}
            placeholder={propiedad.resumen || 'Una o dos frases sobre lo que hace distinta a esta propiedad.'}
            onChange={(evento) => { setBajada(evento.target.value); limpiarAvisos(); }}
          />
          <span className="ficha-comercial__contador">{bajada.length}/{MAX_BAJADA_FICHA}</span>
        </label>
      </fieldset>

      {candidatos.length ? <fieldset className="ficha-comercial__field" disabled={descargando}>
        <legend>Destacados de la portada · {destacados.length || 'automáticos'}</legend>
        <p>Elige hasta {MAX_DESTACADOS_FICHA} en el orden que quieras mostrarlos. Sin elegir ninguno van los primeros del aviso; el resto aparece igual en «Características».</p>
        <div className="ficha-comercial__chips">
          {candidatos.map((candidato, indice) => {
            const orden = destacados.indexOf(indice);
            return <button
              className={`ficha-comercial__chip${orden >= 0 ? ' ficha-comercial__chip--on' : ''}`}
              type="button"
              key={`${candidato}-${indice}`}
              aria-pressed={orden >= 0}
              disabled={descargando || (orden < 0 && destacados.length >= MAX_DESTACADOS_FICHA)}
              onClick={() => alternarDestacado(indice)}
            >{orden >= 0 ? <b>{orden + 1}</b> : null}{candidato}</button>;
          })}
        </div>
        {destacados.length ? <button className="ficha-comercial__photo-reset" type="button" onClick={() => { setDestacados([]); limpiarAvisos(); }}>Volver a los automáticos</button> : null}
      </fieldset> : null}

      <fieldset className="ficha-comercial__field" disabled={descargando || !tieneCoordenadas}>
        <legend>Página de ubicación</legend>
        <label className="ficha-comercial__check">
          <input
            type="checkbox"
            checked={conMapa && tieneCoordenadas}
            disabled={descargando || !tieneCoordenadas}
            onChange={(evento) => { setConMapa(evento.target.checked); limpiarAvisos(); }}
          />
          <span>Incluir el mapa con la ubicación</span>
        </label>
        <p>{tieneCoordenadas
          ? 'Una página con el mapa del sector y el punto de la propiedad. Si el mapa no se puede obtener, la ficha sale igual sin esa página.'
          : 'Esta propiedad no tiene latitud ni longitud: agrégalas en el aviso para incluir el mapa.'}</p>
      </fieldset>

      {fotos.length ? <fieldset className="ficha-comercial__field" disabled={descargando}>
        <legend>03 / Fotografías · {elegidas.length}/{MAX_FOTOS_COMERCIAL_PDF}</legend>
        <p>Se preseleccionan seis fotos. Puedes incluir hasta doce; la primera irá en la portada y las demás aparecerán en el orden elegido. El PDF admite 4 MB por foto y 16 MB en total.</p>
        <button className="ficha-comercial__photo-reset" type="button" onClick={() => { setElegidas(elegidas.length ? [] : fotos.slice(0, 6).map((_, indice) => indice)); limpiarAvisos(); }}>
          {elegidas.length ? 'Desmarcar todas' : 'Usar primeras seis'}
        </button>
        <div className="ficha-comercial__photos">
          {fotos.map((foto, indice) => {
            const orden = elegidas.indexOf(indice);
            return <label className={`ficha-comercial__photo${orden >= 0 ? ' ficha-comercial__photo--selected' : ''}`} key={`${foto}-${indice}`}>
              <img src={foto} alt={`Fotografía ${indice + 1} de ${perfil.titulo}`} loading="lazy" />
              <span className="ficha-comercial__photo-check"><input type="checkbox" checked={orden >= 0} disabled={descargando || (orden < 0 && elegidas.length >= MAX_FOTOS_COMERCIAL_PDF)} onChange={() => alternarFoto(indice)} /><span>{orden >= 0 ? `${orden + 1}. Incluida` : `Foto ${indice + 1}`}</span></span>
            </label>;
          })}
        </div>
      </fieldset> : <p className="ficha-comercial__empty">Esta propiedad todavía no tiene fotos. Puedes descargar la ficha con sus datos; agrega imágenes en el aviso para una presentación más visual.</p>}

      <div className="ficha-comercial__download">
        <span className="ficha-comercial__step">04 / Descargar</span>
        <button className="button button--primary button--block" type="button" onClick={descargar} disabled={descargando}>{descargando ? 'Preparando PDF…' : 'Descargar ficha comercial'}</button>
        <p>PDF A4 listo para compartir o imprimir.</p>
        {propiedad.estado !== 'PUBLICADA' ? <p className="ficha-comercial__draft-note">Propiedad en borrador: la ficha se marcará como borrador y no tendrá enlace público.</p> : null}
        {error ? <p className="acceso__alerta" role="alert">{error}</p> : null}
        <p role="status">{mensaje}</p>
      </div>
    </aside>

    <section className="ficha-comercial__preview-area" aria-labelledby="ficha-comercial-preview-title">
      <div className="ficha-comercial__preview-heading"><h2 id="ficha-comercial-preview-title">Vista previa del contenido</h2><span>Presentación comercial</span></div>
      <article className="ficha-comercial__sheet">
        <header className="ficha-comercial__sheet-header"><Logo /><div><strong>CC-{propiedad.id}</strong><span>{perfil.ubicacion}</span></div></header>
        <div className="ficha-comercial__hero-copy">
          <p className="ficha-comercial__eyebrow">{perfil.encabezado}</p>
          {perfil.segmento ? <p className="ficha-comercial__segment">{perfil.segmento}</p> : null}
          <h3>{perfil.titulo}</h3>
          {perfil.bajada ? <p className="ficha-comercial__summary">{perfil.bajada}</p> : null}
        </div>
        {seleccionadas.length ? <div className={`ficha-comercial__mosaic${seleccionadas.length === 1 ? ' ficha-comercial__mosaic--single' : seleccionadas.length === 2 ? ' ficha-comercial__mosaic--duo' : ''}`}>
          <img className="ficha-comercial__hero-photo" src={seleccionadas[0]} alt={`Foto principal de ${perfil.titulo}`} />
          {seleccionadas.slice(1, 3).map((foto, indice) => <img className="ficha-comercial__secondary-photo" src={foto} alt={`Foto adicional ${indice + 1} de ${perfil.titulo}`} key={`${foto}-${indice}`} />)}
        </div> : <div className="ficha-comercial__photo-placeholder">Fotografías disponibles al incorporarlas al aviso</div>}
        {perfil.pilares.length ? <dl className="ficha-comercial__stats" style={{ gridTemplateColumns: `repeat(${perfil.pilares.length}, minmax(0, 1fr))` }}>{perfil.pilares.map(({ valor, etiqueta }) => <div key={etiqueta}><dd>{valor}</dd><dt>{etiqueta}</dt></div>)}</dl> : null}
        {perfil.destacados.length ? <section className="ficha-comercial__features"><h4>Destacados de la portada</h4><ul>{perfil.destacados.map((destacado, indice) => <li key={`${destacado}-${indice}`}>{destacado}</li>)}</ul></section> : null}
        <section className="ficha-comercial__price" aria-label="Precio de la propiedad">
          {perfil.precios.map(([etiqueta, valor]) => <div key={etiqueta}><span>{etiqueta}</span><strong>{valor}</strong></div>)}
          <p className="ficha-comercial__price-note">{perfil.notaPrecio}</p>
        </section>
        {cuadricula ? <section className="ficha-comercial__map" aria-label="Ubicación de la propiedad">
          <h4>Dónde está</h4>
          <div className="ficha-comercial__map-frame">
            <div className="ficha-comercial__map-grid" style={{ gridTemplateColumns: `repeat(${cuadricula.columnas}, 1fr)` }}>
              {cuadricula.claves.map((clave) => <img
                src={urlTesela(cuadricula.zoom, clave.x, clave.y)}
                alt=""
                loading="lazy"
                key={`${clave.x}-${clave.y}`}
                style={{ gridColumn: clave.columna + 1, gridRow: clave.fila + 1 }}
              />)}
            </div>
            <span className="ficha-comercial__map-pin" style={{ left: `${cuadricula.pinX * 100}%`, top: `${cuadricula.pinY * 100}%` }} />
          </div>
          <p className="ficha-comercial__map-note">
            Ubicación referencial del sector · {formatNumero(propiedad.latitud!, 5)}, {formatNumero(propiedad.longitud!, 5)} · {ATRIBUCION_MAPA}
          </p>
        </section> : null}
        {bloques.length ? <section className="ficha-comercial__description">
          <h4>Conoce la propiedad</h4>
          {bloques.map((bloque, indice) => {
            if (bloque.tipo === 'subtitulo') return <h5 key={indice}>{bloque.texto}</h5>;
            if (bloque.tipo === 'item') return <p className="ficha-comercial__item" key={indice}>{bloque.texto}</p>;
            if (bloque.tipo === 'dato') return <p className="ficha-comercial__inline-dato" key={indice}><strong>{bloque.etiqueta}</strong> {bloque.valor}</p>;
            return <p key={indice}>{bloque.texto}</p>;
          })}
        </section> : null}
        {otrosDestacados.length ? <section className="ficha-comercial__features"><h4>{perfil.destacados.length ? 'Más características' : 'Características'}</h4><ul>{otrosDestacados.map((item, indice) => <li key={`${item}-${indice}`}>{item}</li>)}</ul></section> : null}
        {perfil.datos.length ? <dl className="ficha-comercial__data">{perfil.datos.map(([etiqueta, valor]) => <div key={etiqueta}><dt>{etiqueta}</dt><dd>{valor}</dd></div>)}</dl> : null}
        {seleccionadas.length > 3 ? <div className="ficha-comercial__gallery" aria-label="Más fotos seleccionadas">{seleccionadas.slice(3).map((foto, indice) => <img src={foto} alt={`Otra fotografía ${indice + 4} de ${perfil.titulo}`} key={`${foto}-${indice}`} />)}</div> : null}
        <footer className="ficha-comercial__sheet-footer"><div><strong>{perfil.cierre.titulo}</strong><span>{perfil.cierre.texto}</span></div><span>{site.telefono}<br />{site.email}</span></footer>
        {propiedad.estado !== 'PUBLICADA' ? <span className="ficha-comercial__draft-mark">BORRADOR</span> : null}
      </article>
      <p className="ficha-comercial__preview-note">La vista previa muestra los datos disponibles. El diseño y la distribución final de páginas se ajustan en el PDF.</p>
    </section>
  </div>;
}
