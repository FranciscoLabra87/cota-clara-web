import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { comoJson, pedir, sesionDePrueba } from './sesion';

vi.mock('@/lib/db', () => ({
  obtenerDB: async () => env.DB,
  obtenerFotos: async () => env.FOTOS,
}));

// Los route handlers se importan y se llaman directo, con un Request armado a
// mano. No hace falta levantar Next: son funciones que reciben un Request y
// devuelven un Response.
const { POST: crear } = await import('../src/app/api/panel/propiedades/route');
const { POST: editar, DELETE: borrar } = await import('../src/app/api/panel/propiedades/[id]/route');
const { POST: cambiarEstado } = await import('../src/app/api/panel/propiedades/[id]/estado/route');
const { propiedadPorId, propiedadesPublicadas } = await import('@/lib/propiedades');

const ruta = (id: string | number) => ({ params: Promise.resolve({ id: String(id) }) });

const ficha = (extra: Record<string, unknown> = {}) => ({
  tipo: 'departamento',
  operacion: 'venta',
  comuna: 'Providencia',
  sector: 'Pedro de Valdivia',
  latitud: '-33.4290625',
  longitud: '-70.6080233',
  precioMoneda: 'UF',
  precioValor: '7890',
  publicada: '2026-11-12',
  resumen: 'Luminoso, con terraza.',
  dormitorios: '3',
  banos: '2',
  estacionamientos: '1',
  bodegas: '1',
  superficieUtil: '96',
  superficieTotal: '104',
  anio: '2016',
  ...extra,
});

let cookie = '';
beforeEach(async () => {
  cookie = (await sesionDePrueba()).cookie;
});

const crearFicha = async (extra: Record<string, unknown> = {}) => {
  const res = await crear(pedir('/api/panel/propiedades', cookie, comoJson(ficha(extra))));
  const cuerpo = (await res.json()) as { id: number; slug: string };
  expect(res.status).toBe(201);
  return cuerpo;
};

describe('quién puede entrar', () => {
  it('sin cookie no se puede hacer nada', async () => {
    const llamadas = [
      crear(pedir('/api/panel/propiedades', null, comoJson(ficha()))),
      editar(pedir('/api/panel/propiedades/1', null, comoJson(ficha())), ruta(1)),
      borrar(pedir('/api/panel/propiedades/1', null, { method: 'DELETE' }), ruta(1)),
      cambiarEstado(pedir('/api/panel/propiedades/1/estado', null, comoJson({ estado: 'PUBLICADA' })), ruta(1)),
    ];
    for (const res of await Promise.all(llamadas)) expect(res.status).toBe(401);
  });

  it('con la clave temporal sin cambiar se corta con 403', async () => {
    const { cookie: temporal } = await sesionDePrueba({ claveTemporal: true });
    const res = await crear(pedir('/api/panel/propiedades', temporal, comoJson(ficha())));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
  });

  it('una sesión vencida ya no sirve', async () => {
    const { cookie: vencida } = await sesionDePrueba({ expirada: true });
    expect((await crear(pedir('/api/panel/propiedades', vencida, comoJson(ficha())))).status).toBe(401);
  });

  it('desactivar la cuenta deja fuera a quien tenía la sesión abierta', async () => {
    const { cookie: suya, usuarioId } = await sesionDePrueba();
    await env.DB.prepare('UPDATE usuarios SET activo = 0 WHERE id = ?').bind(usuarioId).run();
    expect((await crear(pedir('/api/panel/propiedades', suya, comoJson(ficha())))).status).toBe(401);
  });

  it('un token inventado no entra', async () => {
    const res = await crear(pedir('/api/panel/propiedades', 'cota_sesion=' + 'a'.repeat(64), comoJson(ficha())));
    expect(res.status).toBe(401);
  });

  it('el editor puede cargar propiedades: no es cosa de administradores', async () => {
    const { cookie: editor } = await sesionDePrueba({ rol: 'EDITOR' });
    const res = await crear(pedir('/api/panel/propiedades', editor, comoJson(ficha())));
    expect(res.status).toBe(201);
  });
});

describe('crear', () => {
  it('crea en borrador y no la publica sola', async () => {
    const { id, slug } = await crearFicha();
    expect(slug).toBe('departamento-providencia-pedro-de-valdivia');
    expect((await propiedadPorId(id))!.estado).toBe('BORRADOR');
    expect(await propiedadesPublicadas()).toHaveLength(0);
  });

  it('devuelve 422 con el mensaje de lo que falta', async () => {
    const res = await crear(pedir('/api/panel/propiedades', cookie, comoJson(ficha({ precioValor: '0' }))));
    expect(res.status).toBe(422);
    expect((await res.json()) as { error: string }).toMatchObject({ error: expect.stringMatching(/precio/i) });
  });

  it('no crea una propiedad publicada sin ubicación para el mapa', async () => {
    const res = await crear(pedir('/api/panel/propiedades', cookie, comoJson(ficha({ estado: 'PUBLICADA', latitud: '', longitud: '' }))));
    expect(res.status).toBe(422);
    expect(await propiedadesPublicadas()).toHaveLength(0);
  });

  it('devuelve 400 si el cuerpo no es JSON', async () => {
    const res = await crear(
      pedir('/api/panel/propiedades', cookie, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'esto no es json' }),
    );
    expect(res.status).toBe(400);
  });

  it('no deja dos propiedades con el mismo enlace', async () => {
    await crearFicha();
    const res = await crear(pedir('/api/panel/propiedades', cookie, comoJson(ficha())));
    expect(res.status).toBe(409);
  });

  it('queda anotado en la bitácora con quién lo hizo', async () => {
    const { usuarioId, cookie: suya } = await sesionDePrueba();
    await crear(pedir('/api/panel/propiedades', suya, comoJson(ficha())));
    const fila = await env.DB.prepare("SELECT usuario_id FROM log_eventos WHERE accion = 'PROPIEDAD_CREADA'").first<{
      usuario_id: number;
    }>();
    expect(fila!.usuario_id).toBe(usuarioId);
  });
});

describe('editar', () => {
  it('guarda los cambios', async () => {
    const { id } = await crearFicha();
    const res = await editar(pedir(`/api/panel/propiedades/${id}`, cookie, comoJson(ficha({ precioValor: '8500' }))), ruta(id));
    expect(res.status).toBe(200);
    expect((await propiedadPorId(id))!.precio.valor).toBe(8500);
  });

  it('deja conservar el propio enlace, pero no robarle el de otra', async () => {
    const primera = await crearFicha();
    const segunda = await crearFicha({ slug: 'casa-la-reina' });

    const propio = await editar(
      pedir(`/api/panel/propiedades/${segunda.id}`, cookie, comoJson(ficha({ slug: 'casa-la-reina' }))),
      ruta(segunda.id),
    );
    expect(propio.status).toBe(200);

    const ajeno = await editar(
      pedir(`/api/panel/propiedades/${segunda.id}`, cookie, comoJson(ficha({ slug: primera.slug }))),
      ruta(segunda.id),
    );
    expect(ajeno.status).toBe(409);
  });

  it('404 si no existe y 400 si el id no es un número', async () => {
    expect((await editar(pedir('/api/panel/propiedades/9999', cookie, comoJson(ficha())), ruta(9999))).status).toBe(404);
    expect((await editar(pedir('/api/panel/propiedades/abc', cookie, comoJson(ficha())), ruta('abc'))).status).toBe(400);
    expect((await editar(pedir('/api/panel/propiedades/-1', cookie, comoJson(ficha())), ruta(-1))).status).toBe(400);
  });
});

describe('publicar y despublicar', () => {
  it('publicar la hace visible al tiro', async () => {
    const { id } = await crearFicha();
    const res = await cambiarEstado(pedir(`/api/panel/propiedades/${id}/estado`, cookie, comoJson({ estado: 'PUBLICADA' })), ruta(id));
    expect(res.status).toBe(200);
    expect(await propiedadesPublicadas()).toHaveLength(1);
  });

  it('despublicar la saca del sitio sin borrarla', async () => {
    const { id } = await crearFicha();
    await cambiarEstado(pedir(`/api/panel/propiedades/${id}/estado`, cookie, comoJson({ estado: 'PUBLICADA' })), ruta(id));
    await cambiarEstado(pedir(`/api/panel/propiedades/${id}/estado`, cookie, comoJson({ estado: 'BORRADOR' })), ruta(id));
    expect(await propiedadesPublicadas()).toHaveLength(0);
    expect(await propiedadPorId(id)).not.toBeNull();
  });

  it('rechaza publicar un borrador sin coordenadas', async () => {
    const { id } = await crearFicha({ latitud: '', longitud: '' });
    const res = await cambiarEstado(pedir(`/api/panel/propiedades/${id}/estado`, cookie, comoJson({ estado: 'PUBLICADA' })), ruta(id));
    expect(res.status).toBe(422);
    expect(await propiedadesPublicadas()).toHaveLength(0);
  });

  it('rechaza un estado inventado', async () => {
    const { id } = await crearFicha();
    const res = await cambiarEstado(pedir(`/api/panel/propiedades/${id}/estado`, cookie, comoJson({ estado: 'ARCHIVADA' })), ruta(id));
    expect(res.status).toBe(422);
  });
});

describe('borrar', () => {
  it('borra la ficha y también sus fotos de R2', async () => {
    const { id } = await crearFicha();
    const claves = [`propiedades/${id}/100-a.png`, `propiedades/${id}/200-b.png`];
    for (const [i, clave] of claves.entries()) {
      await env.FOTOS.put(clave, new Uint8Array([1, 2, 3]));
      await env.DB.prepare('INSERT INTO propiedad_fotos (propiedad_id, clave, orden) VALUES (?, ?, ?)').bind(id, clave, i).run();
    }

    const res = await borrar(pedir(`/api/panel/propiedades/${id}`, cookie, { method: 'DELETE' }), ruta(id));
    expect(res.status).toBe(200);
    expect(await propiedadPorId(id)).toBeNull();
    for (const clave of claves) expect(await env.FOTOS.get(clave)).toBeNull();
  });

  it('404 si ya no está', async () => {
    expect((await borrar(pedir('/api/panel/propiedades/9999', cookie, { method: 'DELETE' }), ruta(9999))).status).toBe(404);
  });
});
