import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { atenderFotoOptimizada } from '@/lib/fotos-optimizadas';

const CLAVE = 'palma-fuentes/202057/001-46fe146278d3.png';
const ORIGINAL = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWPg1vcCAADNAIXGysnDAAAAAElFTkSuQmCC'), (letra) => letra.charCodeAt(0));
const OPTIMIZADA = new Uint8Array([11, 22, 33, 44]);

// R2 sí es real (Miniflare). Se sustituye solo el servicio de transformación:
// consume el stream como el binding y devuelve bytes distintos del original.
function stubImagesBinding(fallar = false) {
  const recibidas: Uint8Array[] = [];
  let entrada: ReadableStream<Uint8Array> | undefined;
  const output = vi.fn<ImageTransformer['output']>(async (opciones) => {
    if (!entrada) throw new Error('Falta el stream de entrada');
    recibidas.push(new Uint8Array(await new Response(entrada).arrayBuffer()));
    if (fallar) throw new Error('Servicio de transformación no disponible');
    return {
      response: (init) => new Response(OPTIMIZADA, { headers: init?.headers }),
      contentType: () => opciones.format,
      image: () => new Response(OPTIMIZADA).body!,
    };
  });
  const transform = vi.fn<ImageTransformer['transform']>(() => cadena);
  const cadena: ImageTransformer = { transform, output, draw: vi.fn(() => cadena) };
  const input = vi.fn<ImagesBinding['input']>((stream) => {
    entrada = stream;
    return cadena;
  });
  return { binding: { input }, input, transform, output, recibidas };
}

function entornoDe(images?: Pick<ImagesBinding, 'input'>) {
  const get = vi.fn((clave: string) => env.FOTOS.get(clave));
  return { entorno: { FOTOS: { get }, ...(images ? { IMAGES: images } : {}) }, get };
}

function solicitud(parametros: Record<string, string> = {}, init: RequestInit = {}) {
  const url = new URL('https://www.cotaclara.cl/_next/image');
  url.search = new URLSearchParams({ url: `/fotos/${CLAVE}`, w: '640', q: '75', ...parametros }).toString();
  return new Request(url, init);
}

beforeEach(async () => {
  await env.FOTOS.put(CLAVE, ORIGINAL, { httpMetadata: { contentType: 'image/png' } });
});

afterEach(() => vi.restoreAllMocks());

describe('el optimizador solo atiende fotos públicas propias', () => {
  it('deja otros recursos a Next sin consultar R2, el binding ni URLs externas', async () => {
    const imagenes = stubImagesBinding();
    const { entorno, get } = entornoDe(imagenes.binding);
    const red = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No debe salir a la red'));

    for (const url of ['https://externo.example/foto.jpg', `https://www.cotaclara.cl/fotos/${CLAVE}`, '//externo.example/foto.jpg', '/drive/archivos/123', '/logo.svg']) {
      expect(await atenderFotoOptimizada(solicitud({ url }), entorno)).toBeNull();
    }
    expect(await atenderFotoOptimizada(new Request(`https://www.cotaclara.cl/fotos/${CLAVE}`), entorno)).toBeNull();
    expect(get).not.toHaveBeenCalled();
    expect(imagenes.input).not.toHaveBeenCalled();
    expect(red).not.toHaveBeenCalled();
  });

  it('rechaza traversal y claves privadas incluso si el archivo existe en el bucket', async () => {
    await env.FOTOS.put('drive/5/documento.png', 'privado');
    const imagenes = stubImagesBinding();
    const { entorno, get } = entornoDe(imagenes.binding);

    for (const url of ['/fotos/drive/5/documento.png', '/fotos/../drive/5/documento.png', '/fotos/palma-fuentes/202057/../001-46fe146278d3.png', '/fotos/%2e%2e/drive/5/documento.png', '/fotos/propiedades/1/archivo.png']) {
      const respuesta = await atenderFotoOptimizada(solicitud({ url }), entorno);
      expect(respuesta?.status).toBe(400);
      expect(respuesta?.headers.get('Cache-Control')).toBe('no-store');
      await respuesta?.text();
    }
    expect(get).not.toHaveBeenCalled();
    expect(imagenes.input).not.toHaveBeenCalled();
  });

  it('limita variantes de tamaño y calidad antes de consumir R2 o Images', async () => {
    const imagenes = stubImagesBinding();
    const { entorno, get } = entornoDe(imagenes.binding);
    for (const w of ['641', '0', '-1', '640.5', '100000', 'NaN', '']) {
      const respuesta = await atenderFotoOptimizada(solicitud({ w }), entorno);
      expect(respuesta?.status).toBe(400);
      await respuesta?.text();
    }
    for (const q of ['1', '100', '075', '75.0', '']) {
      const respuesta = await atenderFotoOptimizada(solicitud({ q }), entorno);
      expect(respuesta?.status).toBe(400);
      await respuesta?.text();
    }
    expect(get).not.toHaveBeenCalled();
    expect(imagenes.input).not.toHaveBeenCalled();
  });

  it('no transforma métodos de escritura y anuncia GET', async () => {
    const imagenes = stubImagesBinding();
    const { entorno, get } = entornoDe(imagenes.binding);
    const respuesta = await atenderFotoOptimizada(solicitud({}, { method: 'POST' }), entorno);
    expect(respuesta?.status).toBe(405);
    expect(respuesta?.headers.get('Allow')).toBe('GET');
    expect(get).not.toHaveBeenCalled();
    expect(imagenes.input).not.toHaveBeenCalled();
  });

  it('responde 404 si la clave válida no existe, sin ejecutar la transformación', async () => {
    const imagenes = stubImagesBinding();
    const { entorno } = entornoDe(imagenes.binding);
    const respuesta = await atenderFotoOptimizada(solicitud({ url: '/fotos/palma-fuentes/999999/001-46fe146278d3.png' }), entorno);
    expect(respuesta?.status).toBe(404);
    expect(imagenes.input).not.toHaveBeenCalled();
    await respuesta?.text();
  });
});

describe('fotos desde R2 y negociación de formato', () => {
  it.each([
    ['image/avif,image/webp,image/*;q=0.8', 'image/avif'],
    ['image/webp,image/jpeg;q=0.8', 'image/webp'],
    ['image/jpeg', 'image/jpeg'],
  ])('entrega el formato compatible con Accept %s usando el stream de la foto', async (accept, formato) => {
    const imagenes = stubImagesBinding();
    const { entorno, get } = entornoDe(imagenes.binding);
    const red = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Debe leer R2 directamente'));
    const respuesta = await atenderFotoOptimizada(solicitud({}, { headers: { Accept: accept } }), entorno);

    expect(respuesta?.status).toBe(200);
    expect(respuesta?.headers.get('Content-Type')).toBe(formato);
    expect(respuesta?.headers.get('Vary')).toBe('Accept');
    expect(respuesta?.headers.get('Cache-Control')).toContain('immutable');
    expect(respuesta?.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(new Uint8Array(await respuesta!.arrayBuffer())).toEqual(OPTIMIZADA);
    expect(get).toHaveBeenCalledExactlyOnceWith(CLAVE);
    expect(imagenes.input).toHaveBeenCalledWith(expect.any(ReadableStream));
    expect(imagenes.recibidas).toEqual([ORIGINAL]);
    expect(imagenes.transform).toHaveBeenCalledWith({ width: 640, fit: 'scale-down' });
    expect(imagenes.output).toHaveBeenCalledWith({ format: formato, quality: 75 });
    expect(red).not.toHaveBeenCalled();
  });

  it.each([
    ['image/avif;q=0,image/webp', 'image/webp'],
    ['image/avif;q=0.2,image/webp;q=0.9', 'image/webp'],
  ])('respeta exclusiones y preferencias de formato en Accept %s', async (accept, formato) => {
    const imagenes = stubImagesBinding();
    const { entorno } = entornoDe(imagenes.binding);
    const respuesta = await atenderFotoOptimizada(solicitud({}, { headers: { Accept: accept } }), entorno);
    await respuesta?.arrayBuffer();
    expect(respuesta?.headers.get('Content-Type')).toBe(formato);
    expect(imagenes.output).toHaveBeenCalledWith({ format: formato, quality: 75 });
  });

  it('entrega el original y su MIME real si no hay binding, con caché corta', async () => {
    const { entorno } = entornoDe();
    const original = await env.FOTOS.head(CLAVE);
    const respuesta = await atenderFotoOptimizada(solicitud({}, { headers: { Accept: 'image/avif' } }), entorno);

    expect(respuesta?.status).toBe(200);
    expect(respuesta?.headers.get('Content-Type')).toBe('image/png');
    expect(respuesta?.headers.get('Cache-Control')).toBe('public, max-age=60');
    expect(respuesta?.headers.get('ETag')).toBe(original!.httpEtag);
    expect(new Uint8Array(await respuesta!.arrayBuffer())).toEqual(ORIGINAL);
  });

  it('recupera el original incluso si Images falló después de consumir su stream', async () => {
    const imagenes = stubImagesBinding(true);
    const { entorno, get } = entornoDe(imagenes.binding);
    const respuesta = await atenderFotoOptimizada(solicitud({}, { headers: { Accept: 'image/webp' } }), entorno);

    expect(respuesta?.status).toBe(200);
    expect(imagenes.recibidas).toEqual([ORIGINAL]);
    expect(respuesta?.headers.get('Content-Type')).toBe('image/png');
    expect(respuesta?.headers.get('Cache-Control')).toBe('public, max-age=60');
    expect(new Uint8Array(await respuesta!.arrayBuffer())).toEqual(ORIGINAL);
    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe('revalidación sin volver a transformar', () => {
  it('devuelve 304 vacío con el ETag de la variante y no vuelve a ejecutar Images', async () => {
    const imagenes = stubImagesBinding();
    const { entorno } = entornoDe(imagenes.binding);
    const inicial = await atenderFotoOptimizada(solicitud({}, { headers: { Accept: 'image/webp' } }), entorno);
    const etag = inicial!.headers.get('ETag')!;
    await inicial!.arrayBuffer();

    const respuesta = await atenderFotoOptimizada(solicitud({}, { headers: { Accept: 'image/webp', 'If-None-Match': etag } }), entorno);
    expect(respuesta?.status).toBe(304);
    expect(await respuesta?.text()).toBe('');
    expect(respuesta?.headers.get('ETag')).toBe(etag);
    expect(respuesta?.headers.get('Vary')).toBe('Accept');
    expect(imagenes.input).toHaveBeenCalledTimes(1);
    expect(imagenes.transform).toHaveBeenCalledTimes(1);
    expect(imagenes.output).toHaveBeenCalledTimes(1);
  });

  it('no confunde el ETag de WebP con una representación AVIF', async () => {
    const imagenes = stubImagesBinding();
    const { entorno } = entornoDe(imagenes.binding);
    const webp = await atenderFotoOptimizada(solicitud({}, { headers: { Accept: 'image/webp' } }), entorno);
    const etag = webp!.headers.get('ETag')!;
    await webp!.arrayBuffer();

    const avif = await atenderFotoOptimizada(solicitud({}, { headers: { Accept: 'image/avif', 'If-None-Match': etag } }), entorno);
    expect(avif?.status).toBe(200);
    expect(avif?.headers.get('Content-Type')).toBe('image/avif');
    expect(avif?.headers.get('ETag')).not.toBe(etag);
    expect(imagenes.input).toHaveBeenCalledTimes(2);
    await avif?.arrayBuffer();
  });
});
