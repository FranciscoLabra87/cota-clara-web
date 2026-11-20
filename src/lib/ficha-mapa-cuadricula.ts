/**
 * La geometría del mapa de la ficha comercial: proyección, qué teselas pedir y
 * dónde cae el pin. Va aparte de `ficha-mapa.ts`, que hace la descarga, para que
 * la vista previa del panel —que corre en el navegador— use los mismos números
 * sin arrastrar la validación de bytes ni el `fetch` del servidor.
 *
 * Las teselas son de OpenStreetMap: su licencia obliga a mostrar
 * `ATRIBUCION_MAPA` junto al mapa, en el PDF y en la vista previa.
 */

export const ATRIBUCION_MAPA = 'Mapa © OpenStreetMap contributors (ODbL)';
export const PIXELES_TESELA = 256;

export type CuadriculaMapa = {
  zoom: number;
  columnas: number;
  filas: number;
  /** Teselas a pedir, ya acotadas al mundo. */
  claves: { columna: number; fila: number; x: number; y: number }[];
  /** Dónde cae la propiedad dentro de la cuadrícula, en fracciones de 0 a 1. */
  pinX: number;
  pinY: number;
};

/** Proyección Web Mercator en teselas de 256 px: la misma que usa Leaflet en la portada. */
export function teselaDePunto(latitud: number, longitud: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const radianes = (latitud * Math.PI) / 180;
  const x = ((longitud + 180) / 360) * n;
  const y = ((1 - Math.log(Math.tan(radianes) + 1 / Math.cos(radianes)) / Math.PI) / 2) * n;
  return { x, y };
}

/**
 * Qué teselas pedir para que la propiedad quede lo más centrada posible usando
 * teselas completas: así no hay que recortar imágenes dentro del Worker.
 */
export function cuadriculaMapa(
  latitud: number,
  longitud: number,
  zoom = 16,
  columnas = 3,
  filas = 3,
): CuadriculaMapa | null {
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return null;
  if (Math.abs(latitud) > 85 || Math.abs(longitud) > 180) return null;
  if (columnas < 1 || filas < 1) return null;
  const nivel = Math.min(18, Math.max(1, Math.round(zoom)));
  const n = 2 ** nivel;
  const punto = teselaDePunto(latitud, longitud, nivel);
  // Con un número par de columnas o filas, el arranque se corre según de qué
  // lado de su tesela cae el punto; así el pin nunca queda pegado a un borde.
  const inicioX = Math.floor(punto.x) - Math.floor((columnas - 1) / 2) - (columnas % 2 === 0 && punto.x % 1 < 0.5 ? 1 : 0);
  const inicioY = Math.floor(punto.y) - Math.floor((filas - 1) / 2) - (filas % 2 === 0 && punto.y % 1 < 0.5 ? 1 : 0);
  const claves: CuadriculaMapa['claves'] = [];
  for (let fila = 0; fila < filas; fila += 1) {
    const y = inicioY + fila;
    // En longitud el mundo da la vuelta; en latitud no hay nada tras el borde.
    if (y < 0 || y >= n) continue;
    for (let columna = 0; columna < columnas; columna += 1) {
      claves.push({ columna, fila, x: ((inicioX + columna) % n + n) % n, y });
    }
  }
  if (!claves.length) return null;
  return {
    zoom: nivel,
    columnas,
    filas,
    claves,
    pinX: (punto.x - inicioX) / columnas,
    pinY: (punto.y - inicioY) / filas,
  };
}

export const urlTesela = (zoom: number, x: number, y: number) => `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
