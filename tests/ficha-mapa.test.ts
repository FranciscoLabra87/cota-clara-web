import { afterEach, describe, expect, it, vi } from 'vitest';
import { cargarMapaFicha, cuadriculaMapa, teselaDePunto, urlTesela } from '@/lib/ficha-mapa';

// Mesa de Aragón, Viña del Mar: una de las propiedades del inventario.
const LAT = -33.0245;
const LON = -71.5518;

const png = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMr8AAAAASUVORK5CYII='),
  (caracter) => caracter.charCodeAt(0),
);
const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);

const respuestaPng = () => new Response(new Uint8Array(png).buffer, { headers: { 'Content-Type': 'image/png' } });

afterEach(() => vi.unstubAllGlobals());

describe('mapa de la ficha comercial', () => {
  it('ubica el punto en la cuadrícula de teselas', () => {
    const punto = teselaDePunto(LAT, LON, 16);
    expect(Math.floor(punto.x)).toBe(19742);
    expect(Math.floor(punto.y)).toBe(39143);

    expect(cuadriculaMapa(LAT, LON)!.claves).toHaveLength(9);
    const cuadricula = cuadriculaMapa(LAT, LON, 16, 3, 2)!;
    expect(cuadricula.claves).toHaveLength(6);
    expect(cuadricula.zoom).toBe(16);
    expect(new Set(cuadricula.claves.map((clave) => clave.x))).toEqual(new Set([19741, 19742, 19743]));
    // El pin queda en el tercio central, nunca pegado a un borde del marco.
    expect(cuadricula.pinX).toBeGreaterThan(0.33);
    expect(cuadricula.pinX).toBeLessThan(0.67);
    expect(cuadricula.pinY).toBeGreaterThan(0.2);
    expect(cuadricula.pinY).toBeLessThan(0.8);
  });

  it('acota el zoom y descarta coordenadas imposibles', () => {
    expect(cuadriculaMapa(LAT, LON, 99)!.zoom).toBe(18);
    expect(cuadriculaMapa(LAT, LON, 0)!.zoom).toBe(1);
    expect(cuadriculaMapa(91, LON)).toBeNull();
    expect(cuadriculaMapa(LAT, 181)).toBeNull();
    expect(cuadriculaMapa(Number.NaN, LON)).toBeNull();
    expect(urlTesela(16, 19825, 38117)).toBe('https://tile.openstreetmap.org/16/19825/38117.png');
  });

  it('descarga las teselas y las devuelve con su posición', async () => {
    const fetchFalso = vi.fn(async (_url: string) => respuestaPng());
    vi.stubGlobal('fetch', fetchFalso);
    const mapa = await cargarMapaFicha(LAT, LON);
    expect(mapa!.teselas).toHaveLength(9);
    expect(mapa!.atribucion).toContain('OpenStreetMap');
    expect(mapa!.latitud).toBe(LAT);
    expect(fetchFalso).toHaveBeenCalledTimes(9);
    expect(String(fetchFalso.mock.calls[0]?.[0])).toContain('tile.openstreetmap.org');
  });

  it('se queda sin mapa antes que mostrarlo a medias o con bytes ajenos', async () => {
    let llamadas = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      llamadas += 1;
      return llamadas > 4 ? new Response('no', { status: 500 }) : respuestaPng();
    }));
    expect(await cargarMapaFicha(LAT, LON)).toBeNull();

    // Un servidor que responde otra cosa, aunque diga que es PNG, no entra al PDF.
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(jpg).buffer, { headers: { 'Content-Type': 'image/png' } })));
    expect(await cargarMapaFicha(LAT, LON)).toBeNull();

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('sin red'); }));
    expect(await cargarMapaFicha(LAT, LON)).toBeNull();
  });

  it('no sale a la red sin coordenadas', async () => {
    const fetchFalso = vi.fn(async () => respuestaPng());
    vi.stubGlobal('fetch', fetchFalso);
    expect(await cargarMapaFicha(undefined, LON)).toBeNull();
    expect(await cargarMapaFicha(LAT, undefined)).toBeNull();
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
