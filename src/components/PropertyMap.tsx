'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LayerGroup, Map as LeafletMap, Marker } from 'leaflet';
// Acá y no en el layout: el mapa vive solo en la portada, y desde el layout
// estos estilos se bajaban en todas las páginas del sitio.
import 'leaflet/dist/leaflet.css';

export type MapProperty = {
  slug: string;
  titulo: string;
  comuna: string;
  sector: string;
  latitud: number;
  longitud: number;
  precio: string;
  operacion: 'venta' | 'arriendo';
};

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function popupDe(propiedad: MapProperty): HTMLElement {
  const contenido = document.createElement('div');
  contenido.className = 'property-map__popup';

  const ubicacion = document.createElement('span');
  ubicacion.className = 'property-map__popup-location';
  ubicacion.textContent = propiedad.sector ? `${propiedad.sector} · ${propiedad.comuna}` : propiedad.comuna;

  const titulo = document.createElement('strong');
  titulo.className = 'property-map__popup-title';
  titulo.textContent = propiedad.titulo;

  const precio = document.createElement('span');
  precio.className = 'property-map__popup-price';
  precio.textContent = `${propiedad.precio}${propiedad.operacion === 'arriendo' ? ' / mes' : ''}`;

  const enlace = document.createElement('a');
  enlace.className = 'property-map__popup-link';
  enlace.href = `/propiedades/${encodeURIComponent(propiedad.slug)}`;
  enlace.textContent = 'Abrir ficha →';

  contenido.appendChild(ubicacion);
  contenido.appendChild(titulo);
  contenido.appendChild(precio);
  contenido.appendChild(enlace);
  return contenido;
}

export function PropertyMap({ propiedades }: { propiedades: MapProperty[] }) {
  const mapaElemento = useRef<HTMLDivElement>(null);
  const visorElemento = useRef<HTMLDivElement>(null);
  const mapa = useRef<LeafletMap | null>(null);
  const capaMarcadores = useRef<LayerGroup | null>(null);
  const marcadores = useRef<Map<string, Marker>>(new Map());
  const [visible, setVisible] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState(false);
  const [comuna, setComuna] = useState('');
  const [seleccionada, setSeleccionada] = useState<string | null>(null);

  const comunas = useMemo(
    () => [...new Set(propiedades.map((p) => p.comuna))].sort((a, b) => a.localeCompare(b, 'es-CL')),
    [propiedades],
  );
  const filtradas = useMemo(
    () => (comuna ? propiedades.filter((p) => p.comuna === comuna) : propiedades),
    [comuna, propiedades],
  );

  useEffect(() => {
    const elemento = visorElemento.current;
    if (!elemento) return;
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { rootMargin: '240px' },
    );
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !mapaElemento.current) return;
    let cancelado = false;
    let instancia: LeafletMap | null = null;

    import('leaflet')
      .then((L) => {
        if (cancelado || !mapaElemento.current) return;
        instancia = L.map(mapaElemento.current, {
          zoomControl: false,
          scrollWheelZoom: false,
        });
        mapa.current = instancia;
        L.tileLayer(TILE_URL, {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(instancia);
        L.control.zoom({ position: 'bottomright' }).addTo(instancia);
        capaMarcadores.current = L.layerGroup().addTo(instancia);

        const icono = L.divIcon({
          className: 'property-map__pin',
          html: '<span aria-hidden="true"></span>',
          iconSize: [24, 30],
          iconAnchor: [12, 28],
          popupAnchor: [0, -25],
        });

        for (const propiedad of propiedades) {
          const marcador = L.marker([propiedad.latitud, propiedad.longitud], {
            icon: icono,
            title: propiedad.titulo,
            keyboard: true,
            alt: `Ver ${propiedad.titulo}`,
          });
          marcador.bindPopup(popupDe(propiedad), { maxWidth: 260, minWidth: 210 });
          marcador.on('click', () => setSeleccionada(propiedad.slug));
          marcadores.current.set(propiedad.slug, marcador);
        }
        setListo(true);
      })
      .catch(() => {
        if (!cancelado) setError(true);
      });

    return () => {
      cancelado = true;
      instancia?.remove();
      mapa.current = null;
      capaMarcadores.current = null;
      marcadores.current.clear();
      setListo(false);
    };
  }, [visible, propiedades]);

  useEffect(() => {
    const instancia = mapa.current;
    const capa = capaMarcadores.current;
    if (!listo || !instancia || !capa || !filtradas.length) return;

    capa.clearLayers();
    instancia.closePopup();
    for (const propiedad of filtradas) {
      const marcador = marcadores.current.get(propiedad.slug);
      if (marcador) capa.addLayer(marcador);
    }

    const movimiento = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const puntos = filtradas.map((p) => [p.latitud, p.longitud] as [number, number]);
    if (puntos.length === 1) {
      instancia.setView(puntos[0], 14, { animate: movimiento });
    } else {
      instancia.fitBounds(puntos, { padding: [40, 40], maxZoom: 14, animate: movimiento, duration: 0.84 });
    }
    instancia.invalidateSize();
  }, [comuna, filtradas, listo]);

  function enfocar(propiedad: MapProperty) {
    setSeleccionada(propiedad.slug);
    const instancia = mapa.current;
    const marcador = marcadores.current.get(propiedad.slug);
    if (!instancia || !marcador) return;
    const movimiento = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (movimiento) instancia.flyTo([propiedad.latitud, propiedad.longitud], Math.max(instancia.getZoom(), 14), { duration: 0.84 });
    else instancia.setView([propiedad.latitud, propiedad.longitud], Math.max(instancia.getZoom(), 14), { animate: false });
    marcador.openPopup();
  }

  return (
    <div className="property-map" ref={visorElemento}>
      <div className="property-map__toolbar">
        <div>
          <p className="property-map__eyebrow">Mapa de propiedades</p>
          <p className="property-map__summary">
            {filtradas.length} {filtradas.length === 1 ? 'propiedad' : 'propiedades'} {comuna ? `en ${comuna}` : 'disponibles'}
          </p>
        </div>
        <label className="property-map__filter">
          <span>Explorar comuna</span>
          <select
            value={comuna}
            onChange={(evento) => {
              setComuna(evento.target.value);
              setSeleccionada(null);
            }}
          >
            <option value="">Todas las comunas</option>
            {comunas.map((nombre) => (
              <option key={nombre} value={nombre}>{nombre}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="property-map__layout">
        <div className="property-map__canvas-wrap" role="region" aria-label="Mapa interactivo de propiedades">
          <div className="property-map__canvas" ref={mapaElemento} />
          {!listo ? (
            <div className="property-map__loading" role="status">
              {error ? 'El mapa no está disponible en este momento. Puedes abrir las fichas desde la lista.' : 'Cargando mapa…'}
            </div>
          ) : null}
          <span className="property-map__hint">Usa los controles para acercar el mapa</span>
        </div>

        <div className="property-map__results" aria-label="Propiedades en el mapa">
          <ul className="property-map__list">
            {filtradas.map((propiedad) => (
              <li key={propiedad.slug} className={`property-map__item${seleccionada === propiedad.slug ? ' property-map__item--selected' : ''}`}>
                <button className="property-map__focus" type="button" onClick={() => enfocar(propiedad)} aria-label={`Ubicar ${propiedad.titulo} en el mapa`}>
                  <span className="property-map__item-dot" aria-hidden="true" />
                  <span className="property-map__item-body">
                    <span className="property-map__item-location">{propiedad.sector || propiedad.comuna}</span>
                    <span className="property-map__item-title">{propiedad.titulo}</span>
                    <span className="property-map__item-price">{propiedad.precio}{propiedad.operacion === 'arriendo' ? ' / mes' : ''}</span>
                  </span>
                </button>
                <Link className="property-map__item-link" href={`/propiedades/${propiedad.slug}`} aria-label={`Abrir ficha de ${propiedad.titulo}`}>Ver ficha →</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="property-map__credit">Mapa: © OpenStreetMap contributors. Desplázate por el mapa con los controles o selecciona una propiedad de la lista.</p>
    </div>
  );
}
