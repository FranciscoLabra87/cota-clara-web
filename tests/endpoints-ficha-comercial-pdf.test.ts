import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { comoJson, pedir, sesionDePrueba } from './sesion';
import { MAX_FOTOS_COMERCIAL_PDF, seleccionarFotosPdf } from '@/lib/ficha-pdf-recursos';

const generar = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db', () => ({ obtenerDB: async () => env.DB, obtenerFotos: async () => env.FOTOS }));
vi.mock('@/lib/ficha-comercial-pdf', () => ({ generarFichaComercialPdf: generar }));

const { GET: descargar, POST: descargarConAjustes } = await import('../src/app/api/panel/propiedades/[id]/ficha/comercial/pdf/route');
const pdf = new TextEncoder().encode('%PDF-1.7\ncomercial');
let propiedadId = 0;
let cookie = '';

beforeEach(async () => {
  generar.mockReset().mockResolvedValue(pdf);
  cookie = (await sesionDePrueba({ rol: 'EDITOR' })).cookie;
  const fila = await env.DB.prepare(
    `INSERT INTO propiedades (slug, titulo, tipo, operacion, comuna, precio_valor, precio_moneda, publicada)
     VALUES ('casa-venta', 'Casa de prueba', 'casa', 'venta', 'Providencia', 7890, 'UF', '2026-11-15') RETURNING id`,
  ).first<{ id: number }>();
  propiedadId = fila!.id;
});

const obtener = (consulta = '', sesion: string | null = cookie, id: string | number = propiedadId) =>
  descargar(pedir(`/api/panel/propiedades/${id}/ficha/comercial/pdf${consulta}`, sesion), { params: Promise.resolve({ id: String(id) }) });

const enviar = (cuerpo: unknown, sesion: string | null = cookie) => descargarConAjustes(
  pedir(`/api/panel/propiedades/${propiedadId}/ficha/comercial/pdf`, sesion, comoJson(cuerpo)),
  { params: Promise.resolve({ id: String(propiedadId) }) },
);

describe('ficha comercial automática', () => {
  it('permite doce fotos solo en la versión comercial', () => {
    const disponibles = Array.from({ length: 13 }, (_, indice) => `foto-${indice}`);
    const doce = Array.from({ length: MAX_FOTOS_COMERCIAL_PDF }, (_, indice) => indice).join(',');
    expect(seleccionarFotosPdf(doce, disponibles, MAX_FOTOS_COMERCIAL_PDF)).toHaveLength(12);
    expect(() => seleccionarFotosPdf(doce, disponibles)).toThrow();
    expect(() => seleccionarFotosPdf(`${doce},12`, disponibles, MAX_FOTOS_COMERCIAL_PDF)).toThrow();
    expect(seleccionarFotosPdf(null, disponibles, MAX_FOTOS_COMERCIAL_PDF)).toHaveLength(6);
  });

  it('exige sesión y valida la propiedad antes de generar', async () => {
    expect((await obtener('', null)).status).toBe(401);
    expect((await obtener('', cookie, 'abc')).status).toBe(400);
    expect((await obtener('', cookie, 999999)).status).toBe(404);
    expect(generar).not.toHaveBeenCalled();
  });

  it('genera un PDF privado para un borrador sin depender de antecedentes legales', async () => {
    const respuesta = await obtener('?fotos=ninguna');
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('Content-Type')).toBe('application/pdf');
    expect(respuesta.headers.get('Cache-Control')).toBe('private, no-store');
    expect(respuesta.headers.get('Content-Disposition')).toBe(
      `attachment; filename="Ficha_Comercial_Cota_Clara_CC-${propiedadId}_casa-venta.pdf"`,
    );
    expect(new Uint8Array(await respuesta.arrayBuffer())).toEqual(pdf);
    expect(generar).toHaveBeenCalledWith(expect.objectContaining({ id: propiedadId, estado: 'BORRADOR' }),
      expect.objectContaining({ fecha: expect.any(String), imagenes: [] }));
  });

  it('acepta solo fotos asociadas a la propiedad y oculta errores internos', async () => {
    expect((await obtener('?fotos=0')).status).toBe(400);
    generar.mockRejectedValueOnce(new Error('detalle privado'));
    const respuesta = await obtener('?fotos=ninguna');
    expect(respuesta.status).toBe(503);
    expect(respuesta.headers.get('Content-Disposition')).toBeNull();
    expect(await respuesta.text()).not.toContain('detalle privado');
  });

  it('recibe los ajustes de la ficha y los pasa al generador sin guardarlos', async () => {
    const respuesta = await enviar({ fotos: [], titulo: 'Casa con patio', bajada: 'Lista para entrar.', mapa: false });
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('Content-Type')).toBe('application/pdf');
    expect(generar).toHaveBeenCalledWith(expect.objectContaining({ id: propiedadId }), expect.objectContaining({
      imagenes: [],
      mapa: null,
      ajustes: { titulo: 'Casa con patio', bajada: 'Lista para entrar.', destacados: [], mapa: false },
    }));
  });

  it('rechaza ajustes fuera de límite y cuerpos que no son un objeto', async () => {
    expect((await enviar({ titulo: 'x'.repeat(200) })).status).toBe(400);
    expect((await enviar({ destacados: [0] })).status).toBe(400);
    expect((await enviar({ fotos: 'todas' })).status).toBe(400);
    expect((await enviar([1, 2])).status).toBe(400);
    expect((await enviar({ fotos: [] }, null)).status).toBe(401);
    expect(generar).not.toHaveBeenCalled();
  });
});
