import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pedir, sesionDePrueba } from './sesion';

vi.mock('@/lib/db', () => ({
  obtenerDB: async () => env.DB,
  obtenerFotos: async () => env.FOTOS,
}));

const { POST: subir, PUT: reordenar } = await import('../src/app/api/panel/propiedades/[id]/fotos/route');
const { DELETE: borrarFoto } = await import('../src/app/api/panel/propiedades/[id]/fotos/[fotoId]/route');
const { GET: servirFoto } = await import('../src/app/fotos/[...clave]/route');
const { crearPropiedad, fotosDePropiedad } = await import('@/lib/propiedades');

const ruta = (id: string | number) => ({ params: Promise.resolve({ id: String(id) }) });
const rutaFoto = (id: string | number, fotoId: string | number) => ({
  params: Promise.resolve({ id: String(id), fotoId: String(fotoId) }),
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

const conArchivo = (contenido: Uint8Array, nombre = 'foto.png', tipo = 'image/png'): RequestInit => {
  const form = new FormData();
  form.append('foto', new File([contenido as BufferSource], nombre, { type: tipo }));
  return { method: 'POST', body: form };
};

const ficha = (slug: string) => ({
  slug,
  tipo: 'departamento' as const,
  operacion: 'venta' as const,
  comuna: 'Providencia',
  sector: '',
  precioValor: 7890,
  precioMoneda: 'UF' as const,
  dormitorios: 3,
  banos: 2,
  estacionamientos: 1,
  bodegas: 1,
  superficieUtil: 96,
  superficieTotal: 104,
  terreno: null,
  piso: null,
  orientacion: 'Norte',
  anio: 2016,
  gastosComunes: null,
  etiquetas: [],
  resumen: 'Resumen.',
  descripcion: [],
  caracteristicas: [],
  destacada: false,
  publicada: '2026-11-12',
  estado: 'PUBLICADA' as const,
  ilustracionSeed: 1,
  ilustracionTono: 'dia' as const,
});

let cookie = '';
let id = 0;
beforeEach(async () => {
  cookie = (await sesionDePrueba()).cookie;
  id = await crearPropiedad(ficha('departamento-providencia'));
});

const subirPng = async (propiedadId = id) => {
  const res = await subir(pedir(`/api/panel/propiedades/${propiedadId}/fotos`, cookie, conArchivo(PNG)), ruta(propiedadId));
  const cuerpo = (await res.json()) as { id: number; url: string; error?: string };
  expect(res.status).toBe(201);
  return cuerpo;
};

describe('subir fotos', () => {
  it('guarda el objeto en R2 y la fila en la base', async () => {
    const { id: fotoId, url } = await subirPng();

    const clave = url.replace('/fotos/', '');
    expect(clave).toMatch(new RegExp(`^propiedades/${id}/\\d+-[0-9a-f-]{36}\\.png$`));

    const objeto = await env.FOTOS.get(clave);
    expect(objeto).not.toBeNull();
    expect(objeto!.httpMetadata?.contentType).toBe('image/png');

    const fotos = await fotosDePropiedad(id);
    expect(fotos).toEqual([{ id: fotoId, url }]);
  });

  it('las va numerando, así la primera subida queda de portada', async () => {
    const primera = await subirPng();
    const segunda = await subirPng();
    expect((await fotosDePropiedad(id)).map((f) => f.id)).toEqual([primera.id, segunda.id]);
  });

  it('rechaza un archivo que no es imagen aunque diga serlo, y no deja basura en R2', async () => {
    const texto = new TextEncoder().encode('<?php system($_GET[0]); ?>');
    const res = await subir(pedir(`/api/panel/propiedades/${id}/fotos`, cookie, conArchivo(texto)), ruta(id));
    expect(res.status).toBe(422);

    const { objects } = await env.FOTOS.list();
    expect(objects).toHaveLength(0);
    expect(await fotosDePropiedad(id)).toHaveLength(0);
  });

  it('rechaza el archivo vacío y el que pasa de 5 MB', async () => {
    const vacio = await subir(pedir(`/api/panel/propiedades/${id}/fotos`, cookie, conArchivo(new Uint8Array(0))), ruta(id));
    expect(vacio.status).toBe(400);

    const enorme = new Uint8Array(5 * 1024 * 1024 + 1);
    enorme.set(PNG);
    const grande = await subir(pedir(`/api/panel/propiedades/${id}/fotos`, cookie, conArchivo(enorme)), ruta(id));
    expect(grande.status).toBe(400);
    expect((await grande.json()) as { error: string }).toMatchObject({ error: expect.stringContaining('5 MB') });
  });

  it('rechaza el formulario sin archivo', async () => {
    const res = await subir(pedir(`/api/panel/propiedades/${id}/fotos`, cookie, { method: 'POST', body: new FormData() }), ruta(id));
    expect(res.status).toBe(400);
  });

  it('corta en 20 fotos por propiedad', async () => {
    for (let i = 0; i < 20; i += 1) {
      await env.DB.prepare('INSERT INTO propiedad_fotos (propiedad_id, clave, orden) VALUES (?, ?, ?)')
        .bind(id, `propiedades/${id}/${i}-relleno.png`, i)
        .run();
    }
    const res = await subir(pedir(`/api/panel/propiedades/${id}/fotos`, cookie, conArchivo(PNG)), ruta(id));
    expect(res.status).toBe(409);
  });

  it('404 si la propiedad no existe y 401 sin sesión', async () => {
    expect((await subir(pedir('/api/panel/propiedades/9999/fotos', cookie, conArchivo(PNG)), ruta(9999))).status).toBe(404);
    expect((await subir(pedir(`/api/panel/propiedades/${id}/fotos`, null, conArchivo(PNG)), ruta(id))).status).toBe(401);
  });
});

describe('borrar fotos', () => {
  it('se lleva la fila y el objeto de R2', async () => {
    const { id: fotoId, url } = await subirPng();
    const res = await borrarFoto(pedir(`/api/panel/propiedades/${id}/fotos/${fotoId}`, cookie, { method: 'DELETE' }), rutaFoto(id, fotoId));
    expect(res.status).toBe(200);
    expect(await fotosDePropiedad(id)).toHaveLength(0);
    expect(await env.FOTOS.get(url.replace('/fotos/', ''))).toBeNull();
  });

  it('no deja borrar la foto de otra propiedad pidiéndola con su id', async () => {
    const { id: fotoId } = await subirPng();
    const otra = await crearPropiedad(ficha('casa-la-reina'));

    const res = await borrarFoto(
      pedir(`/api/panel/propiedades/${otra}/fotos/${fotoId}`, cookie, { method: 'DELETE' }),
      rutaFoto(otra, fotoId),
    );
    expect(res.status).toBe(404);
    expect(await fotosDePropiedad(id)).toHaveLength(1);
  });

  it('404 si la foto no existe y 401 sin sesión', async () => {
    expect((await borrarFoto(pedir(`/api/panel/propiedades/${id}/fotos/999`, cookie, { method: 'DELETE' }), rutaFoto(id, 999))).status).toBe(404);
    expect((await borrarFoto(pedir(`/api/panel/propiedades/${id}/fotos/1`, null, { method: 'DELETE' }), rutaFoto(id, 1))).status).toBe(401);
  });
});

describe('reordenar fotos', () => {
  const put = (propiedadId: string | number, cuerpo: unknown, galleta: string | null = cookie) =>
    reordenar(
      pedir(`/api/panel/propiedades/${propiedadId}/fotos`, galleta, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      }),
      ruta(propiedadId),
    );

  const tresFotos = async () => [await subirPng(), await subirPng(), await subirPng()];

  it('cambia la portada por la que se pida', async () => {
    const [a, b, c] = await tresFotos();
    const res = await put(id, { orden: [c.id, a.id, b.id] });
    expect(res.status).toBe(200);
    expect((await fotosDePropiedad(id)).map((f) => f.id)).toEqual([c.id, a.id, b.id]);
  });

  it('rechaza entero el orden que no calza con las fotos de la propiedad', async () => {
    const [a, b, c] = await tresFotos();
    const original = (await fotosDePropiedad(id)).map((f) => f.id);

    const malos = [
      [a.id, a.id, b.id], // repetida
      [a.id, b.id], // falta una
      [a.id, b.id, c.id, 9999], // una que no existe
      ['a', 'b', 'c'], // ni siquiera números
    ];
    for (const orden of malos) {
      const res = await put(id, { orden });
      expect(res.status).toBe(409);
    }

    expect((await fotosDePropiedad(id)).map((f) => f.id)).toEqual(original);
  });

  it('no mezcla fotos entre propiedades', async () => {
    const [a] = await tresFotos();
    const otra = await crearPropiedad(ficha('casa-la-reina'));
    const suya = await subirPng(otra);

    expect((await put(otra, { orden: [a.id] })).status).toBe(409);
    expect((await put(id, { orden: [suya.id] })).status).toBe(409);
    expect((await fotosDePropiedad(otra)).map((f) => f.id)).toEqual([suya.id]);
  });

  it('400 si no viene el orden, 404 si la propiedad no tiene fotos, 401 sin sesión', async () => {
    expect((await put(id, {})).status).toBe(400);
    expect((await put(id, { orden: 'primera' })).status).toBe(400);
    expect((await put(id, { orden: [1] })).status).toBe(404);
    await subirPng();
    expect((await put(id, { orden: [1] }, null)).status).toBe(401);
  });

  it('queda anotado en la bitácora', async () => {
    const [a, b, c] = await tresFotos();
    await put(id, { orden: [c.id, b.id, a.id] });
    const fila = await env.DB.prepare("SELECT COUNT(*) AS n FROM log_eventos WHERE accion = 'FOTOS_REORDENADAS'").first<{ n: number }>();
    expect(fila!.n).toBe(1);
  });
});

describe('entregar las fotos desde R2', () => {
  const get = (clave: string, headers: Record<string, string> = {}) =>
    servirFoto(pedir(`/fotos/${clave}`, null, { headers }), { params: Promise.resolve({ clave: clave.split('/') }) });

  it('las sirve con el tipo que fijó el servidor y sin dejar adivinar otro', async () => {
    const { url } = await subirPng();
    const clave = url.replace('/fotos/', '');

    const res = await get(clave);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Cache-Control')).toContain('immutable');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
  });

  it('responde 304 si el navegador ya la tiene', async () => {
    const { url } = await subirPng();
    const clave = url.replace('/fotos/', '');

    const etag = (await get(clave)).headers.get('ETag')!;
    expect(etag).toBeTruthy();
    const res = await get(clave, { 'If-None-Match': etag });
    expect(res.status).toBe(304);
  });

  it('404 a las claves que no pudo haber generado el sitio', async () => {
    const malas = [
      'propiedades/1/../../etc/passwd',
      'propiedades/1/archivo.png',
      'otra-carpeta/1/1700000000-00000000-0000-0000-0000-000000000000.png',
      'propiedades/1/1700000000-00000000-0000-0000-0000-000000000000.svg',
    ];
    for (const clave of malas) expect((await get(clave)).status).toBe(404);
  });

  it('404 a una clave bien formada que no existe en el bucket', async () => {
    expect((await get('propiedades/1/1700000000-00000000-0000-0000-0000-000000000000.png')).status).toBe(404);
  });

  it('es pública: no pide sesión', async () => {
    const { url } = await subirPng();
    expect((await get(url.replace('/fotos/', ''))).status).toBe(200);
  });
});
