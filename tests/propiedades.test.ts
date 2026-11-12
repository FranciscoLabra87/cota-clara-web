import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatosPropiedad } from '@/lib/propiedades';

// propiedades.ts pide la base por obtenerDB(), que en producción la saca del
// contexto de Cloudflare. Acá se le entrega la D1 de miniflare: las consultas
// son las mismas, contra SQLite de verdad.
vi.mock('@/lib/db', () => ({
  obtenerDB: async () => env.DB,
  obtenerFotos: async () => {
    throw new Error('las pruebas no tocan R2');
  },
}));

const {
  actualizarPropiedad,
  cambiarEstado,
  crearPropiedad,
  eliminarPropiedad,
  fotosDePropiedad,
  propiedadPorId,
  propiedadPorSlug,
  propiedadesDelPanel,
  propiedadesDestacadas,
  propiedadesPublicadas,
  slugEnUso,
  slugificar,
  slugsPublicados,
} = await import('@/lib/propiedades');

const datos = (p: Partial<DatosPropiedad> = {}): DatosPropiedad => ({
  slug: 'departamento-providencia',
  tipo: 'departamento',
  operacion: 'venta',
  comuna: 'Providencia',
  sector: 'Pedro de Valdivia',
  precioValor: 7890,
  precioMoneda: 'UF',
  dormitorios: 3,
  banos: 2,
  estacionamientos: 1,
  bodegas: 1,
  superficieUtil: 96,
  superficieTotal: 104,
  terreno: null,
  piso: 8,
  orientacion: 'Nororiente',
  anio: 2016,
  gastosComunes: 185000,
  etiquetas: ['Con informe de valor'],
  resumen: 'Luminoso, con terraza.',
  descripcion: ['Primer párrafo.', 'Segundo párrafo.'],
  caracteristicas: ['Piso flotante', 'Cocina equipada'],
  destacada: false,
  publicada: '2026-11-12',
  estado: 'BORRADOR',
  ilustracionSeed: 4,
  ilustracionTono: 'dia',
  ...p,
});

const agregarFoto = (propiedadId: number, clave: string, orden: number) =>
  env.DB.prepare('INSERT INTO propiedad_fotos (propiedad_id, clave, alt, orden) VALUES (?, ?, ?, ?)')
    .bind(propiedadId, clave, '', orden)
    .run();

// La base se arma de cero en cada prueba (ver tests/esquema.ts), así que los
// ids vuelven a partir de 1 y nada queda colgando entre una y otra.
let id = 0;
beforeEach(async () => {
  id = await crearPropiedad(datos());
});

describe('crear y leer', () => {
  it('guarda y devuelve la propiedad con sus listas', async () => {
    const p = await propiedadPorId(id);
    expect(p).not.toBeNull();
    expect(p!.slug).toBe('departamento-providencia');
    expect(p!.precio).toEqual({ valor: 7890, moneda: 'UF' });
    expect(p!.descripcion).toEqual(['Primer párrafo.', 'Segundo párrafo.']);
    expect(p!.caracteristicas).toEqual(['Piso flotante', 'Cocina equipada']);
    expect(p!.etiquetas).toEqual(['Con informe de valor']);
    expect(p!.estado).toBe('BORRADOR');
    expect(p!.imagenes).toBeUndefined();
  });

  it('guarda el título propio cuando el aviso lo tiene', async () => {
    const otro = await crearPropiedad(datos({ slug: 'casa-pena-blanca', titulo: 'Casa en Peña Blanca' }));
    expect((await propiedadPorId(otro))!.titulo).toBe('Casa en Peña Blanca');
  });

  it('deriva el periodo mensual del arriendo, no se pide', async () => {
    const arriendo = await crearPropiedad(datos({ slug: 'oficina-arriendo', operacion: 'arriendo', precioMoneda: 'CLP', precioValor: 1200000 }));
    expect((await propiedadPorId(arriendo))!.precio).toEqual({ valor: 1200000, moneda: 'CLP', periodo: 'mes' });
  });

  it('deja fuera los campos opcionales que vienen vacíos', async () => {
    const otro = await crearPropiedad(datos({ slug: 'casa-sin-datos', terreno: null, piso: null, gastosComunes: null }));
    const p = await propiedadPorId(otro);
    expect(p).not.toHaveProperty('terreno');
    expect(p).not.toHaveProperty('piso');
    expect(p).not.toHaveProperty('gastosComunes');
  });

  it('devuelve null cuando el id no existe', async () => {
    expect(await propiedadPorId(9999)).toBeNull();
  });
});

describe('borrador y publicada', () => {
  it('el borrador no se ve en el sitio público', async () => {
    expect(await propiedadesPublicadas()).toHaveLength(0);
    expect(await propiedadPorSlug('departamento-providencia')).toBeNull();
    expect(await slugsPublicados()).toHaveLength(0);
  });

  it('pero sí en el panel', async () => {
    expect(await propiedadesDelPanel()).toHaveLength(1);
  });

  it('al publicarla aparece de inmediato', async () => {
    await cambiarEstado(id, 'PUBLICADA');
    expect(await propiedadesPublicadas()).toHaveLength(1);
    expect(await propiedadPorSlug('departamento-providencia')).not.toBeNull();
    expect(await slugsPublicados()).toEqual([{ slug: 'departamento-providencia', publicada: '2026-11-12' }]);
  });

  it('destacadas son solo las publicadas y marcadas', async () => {
    await cambiarEstado(id, 'PUBLICADA');
    expect(await propiedadesDestacadas()).toHaveLength(0);

    const destacada = await crearPropiedad(datos({ slug: 'casa-destacada', destacada: true }));
    expect(await propiedadesDestacadas()).toHaveLength(0); // sigue en borrador

    await cambiarEstado(destacada, 'PUBLICADA');
    const lista = await propiedadesDestacadas();
    expect(lista.map((p) => p.slug)).toEqual(['casa-destacada']);
  });
});

describe('orden de las fotos', () => {
  it('la primera foto es la portada: salen en el orden guardado, no por id', async () => {
    await agregarFoto(id, 'propiedades/1/300-c.png', 2);
    await agregarFoto(id, 'propiedades/1/100-a.png', 0);
    await agregarFoto(id, 'propiedades/1/200-b.png', 1);

    expect((await propiedadPorId(id))!.imagenes).toEqual([
      '/fotos/propiedades/1/100-a.png',
      '/fotos/propiedades/1/200-b.png',
      '/fotos/propiedades/1/300-c.png',
    ]);
  });

  it('el panel ve el mismo orden, con el id de cada foto para poder moverla', async () => {
    await agregarFoto(id, 'propiedades/1/300-c.png', 2);
    await agregarFoto(id, 'propiedades/1/100-a.png', 0);

    const fotos = await fotosDePropiedad(id);
    expect(fotos.map((f) => f.url)).toEqual(['/fotos/propiedades/1/100-a.png', '/fotos/propiedades/1/300-c.png']);
    expect(fotos.every((f) => Number.isInteger(f.id))).toBe(true);
  });

  it('cada propiedad trae solo sus fotos aunque se lean todas juntas', async () => {
    const otra = await crearPropiedad(datos({ slug: 'casa-con-fotos', estado: 'PUBLICADA' }));
    await cambiarEstado(id, 'PUBLICADA');
    await agregarFoto(id, 'propiedades/1/100-a.png', 0);
    await agregarFoto(otra, 'propiedades/2/100-z.png', 0);

    const porSlug = Object.fromEntries((await propiedadesPublicadas()).map((p) => [p.slug, p.imagenes]));
    expect(porSlug['departamento-providencia']).toEqual(['/fotos/propiedades/1/100-a.png']);
    expect(porSlug['casa-con-fotos']).toEqual(['/fotos/propiedades/2/100-z.png']);
  });
});

describe('editar y borrar', () => {
  it('actualizar cambia los campos y mantiene el id', async () => {
    await actualizarPropiedad(id, datos({ slug: 'departamento-providencia', precioValor: 8500, resumen: 'Otro resumen.', destacada: true }));
    const p = await propiedadPorId(id);
    expect(p!.precio.valor).toBe(8500);
    expect(p!.resumen).toBe('Otro resumen.');
    expect(p!.destacada).toBe(true);
  });

  it('borrar devuelve las claves de R2 y se lleva las fotos de la tabla', async () => {
    await agregarFoto(id, 'propiedades/1/100-a.png', 0);
    await agregarFoto(id, 'propiedades/1/200-b.png', 1);

    const claves = await eliminarPropiedad(id);
    expect(claves.sort()).toEqual(['propiedades/1/100-a.png', 'propiedades/1/200-b.png']);
    expect(await propiedadPorId(id)).toBeNull();

    const quedan = await env.DB.prepare('SELECT COUNT(*) AS n FROM propiedad_fotos').first<{ n: number }>();
    expect(quedan!.n).toBe(0);
  });
});

describe('enlaces', () => {
  it('avisa si el enlace ya está tomado, salvo por la misma propiedad', async () => {
    expect(await slugEnUso('departamento-providencia')).toBe(true);
    expect(await slugEnUso('departamento-providencia', id)).toBe(false);
    expect(await slugEnUso('no-existe')).toBe(false);
  });

  it('slugificar saca tildes, símbolos y espacios', () => {
    expect(slugificar('Departamento Ñuñoa · Plaza')).toBe('departamento-nunoa-plaza');
    expect(slugificar('  ¡Casa en La Reina!  ')).toBe('casa-en-la-reina');
    expect(slugificar('a'.repeat(150))).toHaveLength(100);
  });
});
