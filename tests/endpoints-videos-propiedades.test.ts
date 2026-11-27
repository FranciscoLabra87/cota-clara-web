import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  obtenerDB: async () => env.DB,
  obtenerFotos: async () => env.FOTOS,
}));

const { GET: servirVideo, HEAD: cabeceraVideo } = await import('../src/app/videos-propiedades/[slug]/route');
const { crearPropiedad, propiedadPorSlug } = await import('@/lib/propiedades');

const SLUG = 'departamento-san-miguel';
const CLAVE = `videos-propiedades/${SLUG}/abc123def456.mp4`;
const MP4 = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);

const ficha = (estado: 'BORRADOR' | 'PUBLICADA' = 'PUBLICADA') => ({
  slug: SLUG,
  tipo: 'departamento' as const,
  operacion: 'arriendo' as const,
  condicion: 'usado' as const,
  comuna: 'San Miguel',
  sector: '',
  precioValor: 350_000,
  precioMoneda: 'CLP' as const,
  dormitorios: 1,
  banos: 1,
  estacionamientos: 1,
  bodegas: 1,
  superficieUtil: 30,
  superficieTotal: 30,
  terreno: null,
  piso: null,
  orientacion: '',
  anio: 0,
  gastosComunes: 95_000,
  etiquetas: [],
  resumen: 'Departamento en arriendo.',
  descripcion: [],
  caracteristicas: [],
  destacada: false,
  publicada: '2026-11-26',
  estado,
  ilustracionSeed: 1,
  ilustracionTono: 'dia' as const,
});

const contexto = (slug = SLUG) => ({ params: Promise.resolve({ slug }) });
const pedir = (headers: Record<string, string> = {}) => new Request(`https://www.cotaclara.cl/videos-propiedades/${SLUG}`, { headers });

beforeEach(async () => {
  const id = await crearPropiedad(ficha());
  await env.DB.prepare('UPDATE propiedades SET video_clave = ? WHERE id = ?').bind(CLAVE, id).run();
  await env.FOTOS.put(CLAVE, MP4, { httpMetadata: { contentType: 'video/mp4' } });
});

describe('video público de una propiedad', () => {
  it('expone una URL por slug, no la clave privada de R2', async () => {
    const propiedad = await propiedadPorSlug(SLUG);
    expect(propiedad?.video).toBe(`/videos-propiedades/${SLUG}`);
    expect(propiedad?.video).not.toContain('abc123def456');
  });

  it('entrega el MP4 completo con cabeceras seguras', async () => {
    const res = await servirVideo(pedir(), contexto());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('video/mp4');
    expect(res.headers.get('Content-Disposition')).toBe('inline');
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Content-Length')).toBe(String(MP4.length));
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(MP4);
  });

  it('sirve rangos cerrados, abiertos y sufijos para reproducción y búsqueda', async () => {
    const casos = [
      { range: 'bytes=2-5', esperado: MP4.slice(2, 6), contentRange: `bytes 2-5/${MP4.length}` },
      { range: 'bytes=8-', esperado: MP4.slice(8), contentRange: `bytes 8-11/${MP4.length}` },
      { range: 'bytes=-3', esperado: MP4.slice(-3), contentRange: `bytes 9-11/${MP4.length}` },
    ];

    for (const caso of casos) {
      const res = await servirVideo(pedir({ Range: caso.range }), contexto());
      expect(res.status).toBe(206);
      expect(res.headers.get('Content-Range')).toBe(caso.contentRange);
      expect(res.headers.get('Content-Length')).toBe(String(caso.esperado.length));
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(caso.esperado);
    }
  });

  it('responde 416 a rangos inválidos o múltiples', async () => {
    for (const range of ['bytes=99-', 'bytes=5-2', 'bytes=0-1,4-5', 'items=0-1']) {
      const res = await servirVideo(pedir({ Range: range }), contexto());
      expect(res.status).toBe(416);
      expect(res.headers.get('Content-Range')).toBe(`bytes */${MP4.length}`);
    }
  });

  it('envía el archivo completo si If-Range pertenece a otra versión', async () => {
    const res = await servirVideo(pedir({ Range: 'bytes=2-5', 'If-Range': '"otra-version"' }), contexto());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Range')).toBeNull();
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(MP4);
  });

  it('permite HEAD y revalidación por ETag', async () => {
    const head = await cabeceraVideo(pedir(), contexto());
    expect(head.status).toBe(200);
    expect(head.headers.get('Content-Length')).toBe(String(MP4.length));
    expect(await head.text()).toBe('');

    const etag = head.headers.get('ETag')!;
    const res = await servirVideo(pedir({ 'If-None-Match': etag }), contexto());
    expect(res.status).toBe(304);
  });

  it('no sirve propiedades despublicadas, claves ajenas al prefijo ni slugs inexistentes', async () => {
    await env.DB.prepare("UPDATE propiedades SET estado = 'BORRADOR' WHERE slug = ?").bind(SLUG).run();
    expect((await servirVideo(pedir(), contexto())).status).toBe(404);

    await env.DB.prepare("UPDATE propiedades SET estado = 'PUBLICADA', video_clave = ? WHERE slug = ?")
      .bind(`drive/${SLUG}/abc123def456.mp4`, SLUG)
      .run();
    expect((await servirVideo(pedir(), contexto())).status).toBe(404);
    expect((await servirVideo(pedir(), contexto('no-existe'))).status).toBe(404);
  });
});
