import { ATRIBUCION_MAPA, cuadriculaMapa, urlTesela, type CuadriculaMapa } from './ficha-mapa-cuadricula';
import { detectarMime } from './imagenes';

/**
 * El mapa de ubicación de la ficha comercial: teselas de OpenStreetMap pegadas
 * una al lado de otra dentro del PDF. No hay composición de imágenes ni clave de
 * API; cada tesela se dibuja en su celda y el pin se dibuja encima con vectores.
 *
 * El uso es el del panel —unas pocas fichas al día—, dentro de la política de
 * teselas de OSM, y la ficha muestra siempre `ATRIBUCION_MAPA`.
 */

export { ATRIBUCION_MAPA, cuadriculaMapa, teselaDePunto, urlTesela } from './ficha-mapa-cuadricula';
export type { CuadriculaMapa } from './ficha-mapa-cuadricula';

const MAX_TESELA_BYTES = 300 * 1024;
const MAX_TOTAL_BYTES = 1_500 * 1024;
const ESPERA_MS = 6000;

export type TeselaMapa = { columna: number; fila: number; bytes: Uint8Array };

export type MapaFicha = CuadriculaMapa & {
  teselas: TeselaMapa[];
  atribucion: string;
  latitud: number;
  longitud: number;
};

/**
 * Baja las teselas del mapa. Nunca lanza: si el servidor de teselas falla, la
 * ficha se genera igual y sale sin la página de ubicación.
 */
export async function cargarMapaFicha(
  latitud: number | undefined,
  longitud: number | undefined,
  opciones: { zoom?: number; columnas?: number; filas?: number } = {},
): Promise<MapaFicha | null> {
  if (latitud == null || longitud == null) return null;
  const cuadricula = cuadriculaMapa(latitud, longitud, opciones.zoom ?? 16, opciones.columnas ?? 3, opciones.filas ?? 3);
  if (!cuadricula) return null;
  try {
    const descargas = await Promise.all(cuadricula.claves.map(async (clave) => {
      const respuesta = await fetch(urlTesela(cuadricula.zoom, clave.x, clave.y), {
        headers: { Accept: 'image/png', 'User-Agent': 'ficha-pdf/1.0' },
        signal: AbortSignal.timeout(ESPERA_MS),
        cf: { cacheTtl: 86400, cacheEverything: true },
      } as RequestInit);
      if (!respuesta.ok) return null;
      const bytes = new Uint8Array(await respuesta.arrayBuffer());
      // Bytes de un tercero: se aceptan solo si la firma real es PNG y pesan poco.
      if (!bytes.length || bytes.length > MAX_TESELA_BYTES || detectarMime(bytes) !== 'image/png') return null;
      return { columna: clave.columna, fila: clave.fila, bytes };
    }));
    const teselas: TeselaMapa[] = [];
    let total = 0;
    for (const tesela of descargas) {
      if (!tesela || total + tesela.bytes.length > MAX_TOTAL_BYTES) continue;
      total += tesela.bytes.length;
      teselas.push(tesela);
    }
    // Con menos de la mitad del mapa cubierto se ve peor que sin mapa.
    if (teselas.length * 2 < cuadricula.claves.length) return null;
    return { ...cuadricula, teselas, atribucion: ATRIBUCION_MAPA, latitud, longitud };
  } catch {
    console.error('[ficha-mapa] No se pudieron obtener las teselas del mapa');
    return null;
  }
}
