import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatosPropiedad } from '@/lib/propiedades';
import { pedir, sesionDePrueba } from './sesion';

vi.mock('@/lib/db', () => ({
  obtenerDB: async () => env.DB,
  obtenerFotos: async () => env.FOTOS,
}));

const { POST: avisar } = await import('../src/app/api/visitas/route');
const { contarVisita, diaDeChile, MAX_VISITAS_POR_DIA, visitasPorPropiedad } = await import('@/lib/visitas');
const { crearPropiedad, eliminarPropiedad } = await import('@/lib/propiedades');

const ficha = (slug: string, estado: DatosPropiedad['estado'] = 'PUBLICADA'): DatosPropiedad => ({
  slug,
  tipo: 'casa',
  operacion: 'venta',
  comuna: 'La Reina',
  sector: '',
  latitud: -33.44,
  longitud: -70.52,
  precioValor: 16290,
  precioMoneda: 'UF',
  dormitorios: 4,
  banos: 4,
  estacionamientos: 3,
  bodegas: 0,
  superficieUtil: 352,
  superficieTotal: 352,
  terreno: 352,
  piso: null,
  orientacion: '',
  anio: 0,
  gastosComunes: null,
  etiquetas: [],
  resumen: 'Casa en La Reina Alta.',
  descripcion: [],
  caracteristicas: [],
  destacada: false,
  publicada: '2026-11-12',
  estado,
  ilustracionSeed: 1,
  ilustracionTono: 'dia',
});

const aviso = (body: unknown, headers: Record<string, string> = {}, cookie: string | null = null) =>
  avisar(
    pedir('/api/visitas', cookie, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

const visitasDe = async (id: number) => (await visitasPorPropiedad()).get(id) ?? { total: 0, semana: 0 };

let casa = 0;
beforeEach(async () => {
  casa = await crearPropiedad(ficha('casa-la-reina'));
});

describe('qué cuenta como visita', () => {
  it('cada aviso desde la ficha publicada suma uno', async () => {
    for (let i = 0; i < 3; i += 1) expect((await aviso({ slug: 'casa-la-reina' })).status).toBe(204);
    expect(await visitasDe(casa)).toEqual({ total: 3, semana: 3 });
  });

  it('un borrador no suma: todavía nadie lo puede ver', async () => {
    const borrador = await crearPropiedad(ficha('casa-en-borrador', 'BORRADOR'));
    await aviso({ slug: 'casa-en-borrador' });
    expect(await visitasDe(borrador)).toEqual({ total: 0, semana: 0 });
  });

  it('un slug que no existe no escribe nada, y responde igual que uno real', async () => {
    const res = await aviso({ slug: 'no-existe' });
    expect(res.status).toBe(204);
    const filas = await env.DB.prepare('SELECT COUNT(*) AS n FROM propiedad_visitas').first<{ n: number }>();
    expect(filas!.n).toBe(0);
  });

  it('las visitas del equipo con sesión abierta no cuentan', async () => {
    const { cookie } = await sesionDePrueba({ rol: 'EDITOR' });
    await aviso({ slug: 'casa-la-reina' }, {}, cookie);
    expect(await visitasDe(casa)).toEqual({ total: 0, semana: 0 });
  });

  it('los buscadores y navegadores automatizados no cuentan', async () => {
    for (const agente of ['Googlebot/2.1', 'Mozilla/5.0 (compatible; bingbot/2.0)', 'HeadlessChrome/130', 'Chrome-Lighthouse']) {
      await aviso({ slug: 'casa-la-reina' }, { 'User-Agent': agente });
    }
    expect(await visitasDe(casa)).toEqual({ total: 0, semana: 0 });
  });

  it('rechaza el aviso sin slug o con un cuerpo que no es JSON', async () => {
    expect((await aviso({})).status).toBe(400);
    expect((await aviso({ slug: 'x'.repeat(200) })).status).toBe(400);
    expect((await aviso('esto no es json')).status).toBe(400);
  });
});

describe('cómo se suman', () => {
  it('una fila por propiedad y por día, no una por visita', async () => {
    await contarVisita('casa-la-reina', '2026-11-10');
    await contarVisita('casa-la-reina', '2026-11-10');
    await contarVisita('casa-la-reina', '2026-11-11');
    const { results } = await env.DB.prepare('SELECT dia, total FROM propiedad_visitas ORDER BY dia').all();
    expect(results).toEqual([
      { dia: '2026-11-10', total: 2 },
      { dia: '2026-11-11', total: 1 },
    ]);
  });

  it('la semana son los últimos 7 días, hoy incluido', async () => {
    const hoy = new Date('2026-11-13T15:00:00Z');
    await contarVisita('casa-la-reina', '2026-11-13');
    await contarVisita('casa-la-reina', '2026-11-07');
    await contarVisita('casa-la-reina', '2026-11-06');
    expect((await visitasPorPropiedad(hoy)).get(casa)).toEqual({ total: 3, semana: 2 });
  });

  it('el día se cuenta en hora de Chile, no en UTC', () => {
    // Las 23:00 del 12 en Santiago ya son el 13 en UTC.
    expect(diaDeChile(new Date('2026-11-13T02:00:00Z'))).toBe('2026-11-12');
    expect(diaDeChile(new Date('2026-11-13T15:00:00Z'))).toBe('2026-11-13');
  });

  it('pasado el tope del día deja de sumar, para no gastar la cuota de la base', async () => {
    await env.DB.prepare('INSERT INTO propiedad_visitas (propiedad_id, dia, total) VALUES (?, ?, ?)')
      .bind(casa, '2026-11-13', MAX_VISITAS_POR_DIA)
      .run();
    expect(await contarVisita('casa-la-reina', '2026-11-13')).toBe(false);
    expect(await contarVisita('casa-la-reina', '2026-11-14')).toBe(true);
  });

  it('al borrar la propiedad se van sus visitas', async () => {
    await contarVisita('casa-la-reina', '2026-11-13');
    await eliminarPropiedad(casa);
    const filas = await env.DB.prepare('SELECT COUNT(*) AS n FROM propiedad_visitas').first<{ n: number }>();
    expect(filas!.n).toBe(0);
  });
});
