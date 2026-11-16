import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pedir, sesionDePrueba } from './sesion';

const mundo = vi.hoisted(() => ({ generar: vi.fn(), images: undefined as unknown }));
vi.mock('@/lib/db', () => ({ obtenerDB: async () => env.DB, obtenerFotos: async () => env.FOTOS }));
vi.mock('@/lib/ficha-pdf', () => ({ generarFichaPdf: mundo.generar }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: async () => ({ env: { IMAGES: mundo.images } }) }));

const { GET: descargar } = await import('../src/app/api/panel/propiedades/[id]/ficha/pdf/route');
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 0, 1, 0, 1, 1, 1, 0x11, 0, 0xff, 0xd9]);
const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6i8AAAAASUVORK5CYII='), (letra) => letra.charCodeAt(0));
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1]);
const pdf = new TextEncoder().encode('%PDF-1.7\nprueba');
let propiedadId = 0;
let cookie = '';

beforeEach(async () => {
  mundo.generar.mockReset().mockResolvedValue(pdf);
  mundo.images = undefined;
  cookie = (await sesionDePrueba({ rol: 'EDITOR' })).cookie;
  const fila = await env.DB.prepare(
    `INSERT INTO propiedades (slug, titulo, tipo, operacion, comuna, precio_valor, precio_moneda, publicada)
     VALUES ('casa-prueba', 'Casa de prueba', 'casa', 'venta', 'Providencia', 7890, 'UF', '2026-11-15') RETURNING id`,
  ).first<{ id: number }>();
  propiedadId = fila!.id;
  await env.DB.prepare('INSERT INTO propiedad_ficha (propiedad_id, datos) VALUES (?, ?)')
    .bind(propiedadId, JSON.stringify({ observaciones: 'Nota interna', destino: 'Habitacional' })).run();
});

const obtener = (consulta = '', sesion: string | null = cookie, id: string | number = propiedadId) =>
  descargar(pedir(`/api/panel/propiedades/${id}/ficha/pdf${consulta}`, sesion), { params: Promise.resolve({ id: String(id) }) });

async function foto(orden: number, bytes = jpg, propiedad = propiedadId, extension = 'jpg') {
  const clave = `palma-fuentes/${propiedad}/${String(orden).padStart(3, '0')}-0123456789ab.${extension}`;
  await env.DB.prepare('INSERT INTO propiedad_fotos (propiedad_id, clave, orden) VALUES (?, ?, ?)').bind(propiedad, clave, orden).run();
  await env.FOTOS.put(clave, bytes);
  return clave;
}

describe('descarga privada de fichas PDF', () => {
  it('exige sesión antes de leer o generar, incluso si el id o la versión son inválidos', async () => {
    expect((await obtener('?version=mal', null, 'abc')).status).toBe(401);
    expect(mundo.generar).not.toHaveBeenCalled();
  });

  it('rechaza sesiones temporales, vencidas o de cuenta inactiva', async () => {
    for (const opciones of [{ claveTemporal: true }, { expirada: true }, { activo: false }]) {
      const sesion = await sesionDePrueba(opciones);
      expect((await obtener('', sesion.cookie)).status).toBe('claveTemporal' in opciones ? 403 : 401);
    }
    expect(mundo.generar).not.toHaveBeenCalled();
  });

  it('permite al editor descargar un borrador con cabeceras de PDF y sin caché pública', async () => {
    const res = await obtener();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toBe(`attachment; filename="Ficha_Tecnica_Cota_Clara_CC-${propiedadId}_casa-prueba_cliente.pdf"`);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(pdf);
    expect(mundo.generar).toHaveBeenCalledWith(expect.objectContaining({ id: propiedadId, estado: 'BORRADOR' }),
      expect.objectContaining({ destino: 'Habitacional' }), expect.objectContaining({ interna: false, imagenes: [], fecha: expect.any(String) }));
  });

  it('solo activa versión interna por solicitud explícita válida', async () => {
    expect((await obtener('?version=interna')).status).toBe(200);
    expect(mundo.generar.mock.calls[0][2].interna).toBe(true);
    mundo.generar.mockClear();
    for (const version of ['true', 'INTERNA', '', 'cliente,interna']) expect((await obtener(`?version=${version}`)).status).toBe(400);
    expect(mundo.generar).not.toHaveBeenCalled();
  });

  it('rechaza id no válido y propiedad ausente', async () => {
    for (const id of ['abc', '0', '-1', '1.5']) expect((await obtener('', cookie, id)).status).toBe(400);
    expect((await obtener('', cookie, 999999)).status).toBe(404);
  });

  it('construye un nombre de archivo seguro a partir del slug guardado', async () => {
    await env.DB.prepare('UPDATE propiedades SET slug = ? WHERE id = ?').bind('casa-área"\r\nX-test: sí', propiedadId).run();
    const nombre = (await obtener()).headers.get('Content-Disposition')!;
    expect(nombre).not.toMatch(/[\r\náí]/);
    expect(nombre).toContain('casa-area');
    expect(nombre).not.toContain('"\r');
  });
});

describe('selección y lectura de fotografías propias', () => {
  it('toma solo las primeras seis por defecto y permite omitirlas explícitamente', async () => {
    for (let i = 0; i < 7; i += 1) await foto(i);
    expect((await obtener()).status).toBe(200);
    expect(mundo.generar.mock.calls[0][2].imagenes).toHaveLength(6);
    expect((await obtener('?fotos=ninguna')).status).toBe(200);
    expect(mundo.generar.mock.calls[1][2].imagenes).toEqual([]);
  });

  it('conserva el orden elegido y el formato JPG/PNG real', async () => {
    await foto(0);
    await foto(1, png, propiedadId, 'png');
    expect((await obtener('?fotos=1,0')).status).toBe(200);
    expect(mundo.generar.mock.calls[0][2].imagenes).toEqual([{ bytes: png, formato: 'png' }, { bytes: jpg, formato: 'jpg' }]);
  });

  it('rechaza índices duplicados, fuera de rango, más de seis y URLs o claves externas', async () => {
    await foto(0);
    for (const fotos of ['', '-1', '0,0', '1', '0.5', '0,1,2,3,4,5,6', 'https://evil.test/x.jpg', '/fotos/palma-fuentes/99/000-0123456789ab.jpg']) {
      expect((await obtener(`?fotos=${encodeURIComponent(fotos)}`)).status).toBe(400);
    }
    expect(mundo.generar).not.toHaveBeenCalled();
  });

  it('no permite elegir la foto de otra propiedad mediante su índice global o su clave', async () => {
    await foto(0);
    const otra = await env.DB.prepare(`INSERT INTO propiedades (slug,tipo,operacion,comuna,precio_valor,precio_moneda,publicada)
      VALUES ('otra','casa','venta','Macul',20,'UF','2026-11-15') RETURNING id`).first<{ id: number }>();
    const ajena = await foto(1, png, otra!.id, 'png');
    expect((await obtener('?fotos=1')).status).toBe(400);
    expect((await obtener(`?fotos=${encodeURIComponent(ajena)}`)).status).toBe(400);
    expect((await obtener('?fotos=0')).status).toBe(200);
    expect(mundo.generar.mock.calls[0][2].imagenes).toEqual([{ bytes: jpg, formato: 'jpg' }]);
  });

  it('devuelve error útil si una foto falta o su ubicación guardada no es válida', async () => {
    const clave = await foto(0);
    await env.FOTOS.delete(clave);
    expect((await obtener()).status).toBe(404);
    await env.DB.prepare('UPDATE propiedad_fotos SET clave = ? WHERE propiedad_id = ?').bind('https://externo.test/foto.jpg', propiedadId).run();
    expect((await obtener()).status).toBe(422);
    expect(mundo.generar).not.toHaveBeenCalled();
  });

  it('rechaza un archivo con formato inválido o superior a 4 MB', async () => {
    const clave = await foto(0, new Uint8Array([1, 2, 3]));
    expect((await obtener()).status).toBe(422);
    const grande = new Uint8Array(4 * 1024 * 1024 + 1); grande.set(jpg);
    await env.FOTOS.put(clave, grande);
    expect((await obtener()).status).toBe(422);
    expect(mundo.generar).not.toHaveBeenCalled();
  });

  it('rechaza la selección que supera 16 MB en total', async () => {
    const imagen = new Uint8Array(4 * 1024 * 1024); imagen.set(jpg);
    for (let i = 0; i < 5; i += 1) await foto(i, imagen);
    const respuesta = await obtener();
    expect(respuesta.status).toBe(422);
    expect(await respuesta.text()).toContain('16 MB');
    expect(mundo.generar).not.toHaveBeenCalled();
  });

  it('rechaza dimensiones ausentes o superiores a 16 megapíxeles antes de generar', async () => {
    const clave = await foto(0, new Uint8Array([0xff, 0xd8, 0xff]));
    expect((await obtener()).status).toBe(422);
    const jpgGrande = new Uint8Array(jpg);
    jpgGrande.set([0x10, 0x01], 7); jpgGrande.set([0x10, 0x01], 9);
    await env.FOTOS.put(clave, jpgGrande);
    expect((await obtener()).status).toBe(422);
    const pngGrande = new Uint8Array(png);
    const vista = new DataView(pngGrande.buffer);
    vista.setUint32(16, 4097); vista.setUint32(20, 4097);
    await env.FOTOS.put(clave, pngGrande);
    expect((await obtener()).status).toBe(422);
    expect(mundo.generar).not.toHaveBeenCalled();
  });

  it('convierte WEBP usando el binding propio y devuelve 503 si no está disponible', async () => {
    await foto(0, webp, propiedadId, 'webp');
    expect((await obtener()).status).toBe(503);
    const transform = vi.fn();
    const output = vi.fn().mockResolvedValue({ response: () => new Response(jpg) });
    const cadena = { transform, output }; transform.mockReturnValue(cadena);
    const input = vi.fn().mockReturnValue(cadena);
    mundo.images = { input };
    expect((await obtener()).status).toBe(200);
    expect(transform).toHaveBeenCalledWith({ width: 1600, height: 1200, fit: 'scale-down' });
    expect(output).toHaveBeenCalledWith({ format: 'image/jpeg', quality: 85, anim: false });
    expect(mundo.generar.mock.calls[0][2].imagenes).toEqual([{ bytes: jpg, formato: 'jpg' }]);
  });

  it('no devuelve una descarga vacía o corrupta si la generación falla', async () => {
    mundo.generar.mockRejectedValueOnce(new Error('Error privado de prueba'));
    const respuesta = await obtener('?fotos=ninguna');
    expect(respuesta.status).toBe(503);
    expect(respuesta.headers.get('Content-Disposition')).toBeNull();
    expect(await respuesta.text()).not.toContain('Error privado de prueba');
  });
});
