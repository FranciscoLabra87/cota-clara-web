import { env } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';
import type { DatosPropiedad } from '@/lib/propiedades';

// Igual que propiedades.test.ts: obtenerDB() recibe la D1 de miniflare, así
// que las consultas y el ON DELETE CASCADE se prueban contra SQLite de verdad.
vi.mock('@/lib/db', () => ({
  obtenerDB: async () => env.DB,
  obtenerFotos: async () => {
    throw new Error('las pruebas no tocan R2');
  },
}));

const { crearPropiedad, eliminarPropiedad, propiedadPorId, propiedadPorSlug } = await import('@/lib/propiedades');
const {
  actualizarUnidad,
  aplicarImportacion,
  asegurarProyecto,
  cambiarEstadoUnidades,
  crearTipologia,
  crearUnidad,
  eliminarTipologia,
  eliminarUnidad,
  ErrorUnidad,
  planearImportacion,
  resumenesStock,
  stockDeProyecto,
  stockPublicoPorSlug,
  unidadesDeProyecto,
} = await import('@/lib/unidades');
const { analizarUnidades } = await import('@/lib/importar-unidades');

const datos = (p: Partial<DatosPropiedad> = {}): DatosPropiedad => ({
  slug: 'eco-estacion',
  tipo: 'departamento',
  operacion: 'venta',
  condicion: 'nuevo',
  comuna: 'Estación Central',
  sector: 'Eco Estación',
  latitud: -33.45,
  longitud: -70.68,
  precioValor: 9999,
  precioMoneda: 'UF',
  dormitorios: 0,
  banos: 0,
  estacionamientos: 0,
  bodegas: 0,
  superficieUtil: 0,
  superficieTotal: 0,
  terreno: null,
  piso: null,
  orientacion: '',
  anio: 2027,
  gastosComunes: null,
  etiquetas: [],
  resumen: 'Proyecto nuevo con unidades.',
  descripcion: ['Primer párrafo.'],
  caracteristicas: [],
  destacada: false,
  publicada: '2026-11-20',
  estado: 'PUBLICADA',
  ilustracionSeed: 1,
  ilustracionTono: 'dia',
  ...p,
});

const unidad = (numero: string, precioUF: number, extra: Record<string, unknown> = {}) => ({
  tipologiaId: null,
  numero,
  piso: null,
  orientacion: '',
  superficieUtil: 68.5,
  superficieTotal: 78,
  precioUF,
  descuentoPct: 0,
  estacionamientos: 0,
  bodegas: 0,
  estado: 'disponible' as const,
  ...extra,
});

describe('asegurarProyecto', () => {
  it('acepta un proyecto nuevo en venta', async () => {
    const id = await crearPropiedad(datos());
    await expect(asegurarProyecto(id)).resolves.toBeUndefined();
  });

  it('rechaza una propiedad usada', async () => {
    const id = await crearPropiedad(datos({ condicion: 'usado' }));
    await expect(crearUnidad(id, unidad('302', 4520))).rejects.toThrow(ErrorUnidad);
  });

  it('rechaza un arriendo', async () => {
    const id = await crearPropiedad(datos({ operacion: 'arriendo' }));
    await expect(crearUnidad(id, unidad('302', 4520))).rejects.toThrow(/en venta/);
  });

  it('rechaza una propiedad que no existe', async () => {
    await expect(asegurarProyecto(9999)).rejects.toThrow(/No existe/);
  });
});

describe('tipologías', () => {
  const tipologia = (codigo: string) => ({
    codigo,
    dormitorios: 2,
    banos: 2,
    superficieUtil: 68.5,
    superficieTerraza: 9.5,
    orden: 0,
  });

  it('no deja repetir el código dentro del mismo proyecto', async () => {
    const id = await crearPropiedad(datos());
    await crearTipologia(id, tipologia('2D/2B'));
    await expect(crearTipologia(id, tipologia('2D/2B'))).rejects.toThrow(/ya tiene una tipología/);
  });

  it('deja el mismo código en dos proyectos distintos', async () => {
    const uno = await crearPropiedad(datos());
    const otro = await crearPropiedad(datos({ slug: 'otro-proyecto' }));
    await crearTipologia(uno, tipologia('2D/2B'));
    await expect(crearTipologia(otro, tipologia('2D/2B'))).resolves.toBeGreaterThan(0);
  });

  it('al borrarla, sus unidades quedan sin tipología en vez de borrarse', async () => {
    const id = await crearPropiedad(datos());
    const tipologiaId = await crearTipologia(id, tipologia('2D/2B'));
    await crearUnidad(id, unidad('302', 4520, { tipologiaId }));

    await eliminarTipologia(id, tipologiaId);
    const unidades = await unidadesDeProyecto(id);
    expect(unidades).toHaveLength(1);
    expect(unidades[0].tipologiaId).toBeNull();
  });

  it('no deja borrar la tipología de otro proyecto', async () => {
    const uno = await crearPropiedad(datos());
    const otro = await crearPropiedad(datos({ slug: 'otro-proyecto' }));
    const tipologiaId = await crearTipologia(uno, tipologia('2D/2B'));
    await expect(eliminarTipologia(otro, tipologiaId)).rejects.toThrow(/no es de este proyecto/);
  });

  it('no deja poner en una unidad la tipología de otro proyecto', async () => {
    const uno = await crearPropiedad(datos());
    const otro = await crearPropiedad(datos({ slug: 'otro-proyecto' }));
    const tipologiaId = await crearTipologia(uno, tipologia('2D/2B'));
    await expect(crearUnidad(otro, unidad('302', 4520, { tipologiaId }))).rejects.toThrow(/no es de este proyecto/);
  });
});

describe('precio desde', () => {
  it('deja en el aviso el mínimo de las unidades disponibles', async () => {
    const id = await crearPropiedad(datos());
    await crearUnidad(id, unidad('302', 4520));
    await crearUnidad(id, unidad('304', 4480));

    const propiedad = await propiedadPorId(id);
    expect(propiedad?.precio).toEqual({ valor: 4480, moneda: 'UF' });
  });

  it('no cuenta las que no están disponibles', async () => {
    const id = await crearPropiedad(datos());
    await crearUnidad(id, unidad('302', 4520));
    await crearUnidad(id, unidad('304', 3900, { estado: 'vendida' }));

    expect((await propiedadPorId(id))?.precio.valor).toBe(4520);
  });

  it('conserva el último precio cuando no queda stock', async () => {
    const id = await crearPropiedad(datos());
    const unidadId = await crearUnidad(id, unidad('302', 4520));
    await cambiarEstadoUnidades(id, [unidadId], 'vendida');

    const propiedad = await propiedadPorId(id);
    expect(propiedad?.precio.valor).toBe(4520);
    expect(propiedad?.stock).toMatchObject({ total: 1, disponibles: 0, desdeUF: null });
  });

  it('se recalcula al editar y al borrar una unidad', async () => {
    const id = await crearPropiedad(datos());
    await crearUnidad(id, unidad('302', 4520));
    const barata = await crearUnidad(id, unidad('304', 4100));
    expect((await propiedadPorId(id))?.precio.valor).toBe(4100);

    await actualizarUnidad(id, barata, unidad('304', 4700));
    expect((await propiedadPorId(id))?.precio.valor).toBe(4520);

    await eliminarUnidad(id, barata);
    expect((await propiedadPorId(id))?.precio.valor).toBe(4520);
  });

  it('pasa el aviso a UF en cuanto hay unidades', async () => {
    const id = await crearPropiedad(datos({ precioMoneda: 'CLP', precioValor: 150_000_000 }));
    await crearUnidad(id, unidad('302', 4520));
    expect((await propiedadPorId(id))?.precio.moneda).toBe('UF');
  });
});

describe('resumen del stock', () => {
  it('cuenta disponibles, desde y los rangos de dormitorios y superficie', async () => {
    const id = await crearPropiedad(datos());
    const dos = await crearTipologia(id, {
      codigo: '2D/2B',
      dormitorios: 2,
      banos: 2,
      superficieUtil: 68.5,
      superficieTerraza: 0,
      orden: 0,
    });
    const tres = await crearTipologia(id, {
      codigo: '3D/2B',
      dormitorios: 3,
      banos: 2,
      superficieUtil: 92,
      superficieTerraza: 0,
      orden: 1,
    });
    await crearUnidad(id, unidad('302', 4520, { tipologiaId: dos, superficieUtil: 68.5 }));
    await crearUnidad(id, unidad('1201', 6100, { tipologiaId: tres, superficieUtil: 92 }));
    await crearUnidad(id, unidad('1202', 3000, { tipologiaId: tres, superficieUtil: 92, estado: 'vendida' }));

    const resumen = (await resumenesStock([id])).get(id);
    expect(resumen).toEqual({
      total: 3,
      disponibles: 2,
      desdeUF: 4520,
      dormitoriosMin: 2,
      dormitoriosMax: 3,
      superficieMin: 68.5,
      superficieMax: 92,
    });
  });

  it('no trae las propiedades sin unidades', async () => {
    const id = await crearPropiedad(datos());
    expect((await resumenesStock([id])).size).toBe(0);
    expect((await propiedadPorId(id))?.stock).toBeUndefined();
  });

  it('reparte el resumen por propiedad en una sola consulta', async () => {
    const uno = await crearPropiedad(datos());
    const otro = await crearPropiedad(datos({ slug: 'otro-proyecto' }));
    await crearUnidad(uno, unidad('302', 4520));
    await crearUnidad(otro, unidad('101', 2500));

    const mapa = await resumenesStock([uno, otro]);
    expect(mapa.get(uno)?.desdeUF).toBe(4520);
    expect(mapa.get(otro)?.desdeUF).toBe(2500);
  });
});

describe('cambio de estado en lote', () => {
  it('cambia varias de una vez', async () => {
    const id = await crearPropiedad(datos());
    const a = await crearUnidad(id, unidad('302', 4520));
    const b = await crearUnidad(id, unidad('304', 4480));

    expect(await cambiarEstadoUnidades(id, [a, b], 'vendida')).toBe(2);
    expect((await unidadesDeProyecto(id)).every((u) => u.estado === 'vendida')).toBe(true);
  });

  it('rechaza el lote entero si una unidad es de otro proyecto', async () => {
    const uno = await crearPropiedad(datos());
    const otro = await crearPropiedad(datos({ slug: 'otro-proyecto' }));
    const mia = await crearUnidad(uno, unidad('302', 4520));
    const ajena = await crearUnidad(otro, unidad('101', 2500));

    await expect(cambiarEstadoUnidades(uno, [mia, ajena], 'vendida')).rejects.toThrow(/no es de este proyecto/);
    expect((await unidadesDeProyecto(uno))[0].estado).toBe('disponible');
  });

  it('pide al menos una unidad', async () => {
    const id = await crearPropiedad(datos());
    await expect(cambiarEstadoUnidades(id, [], 'vendida')).rejects.toThrow(/al menos una/);
  });
});

describe('importación', () => {
  const planilla = [
    'numero\ttipologia\tpiso\tutil\ttotal\tprecio uf\testado',
    '302\t2D/2B\t3\t68,5\t78\t4.520\tdisponible',
    '304\t2D/2B\t3\t68,5\t78\t4.480\treservada',
    '1201\t3D/2B\t12\t92\t104\t6.100\tdisponible',
  ].join('\n');

  const filas = () => analizarUnidades(planilla).filas;

  it('crea las tipologías que nombra la planilla, con sus dormitorios', async () => {
    const id = await crearPropiedad(datos());
    const resultado = await aplicarImportacion(id, filas());
    expect(resultado).toMatchObject({ creadas: 3, actualizadas: 0, borradas: 0, tipologiasCreadas: 2 });

    const { tipologias } = await stockDeProyecto(id);
    expect(tipologias.map((t) => [t.codigo, t.dormitorios, t.banos])).toEqual([
      ['2D/2B', 2, 2],
      ['3D/2B', 3, 2],
    ]);
  });

  it('la misma planilla dos veces actualiza en vez de duplicar', async () => {
    const id = await crearPropiedad(datos());
    await aplicarImportacion(id, filas());
    const segunda = await aplicarImportacion(id, filas());

    expect(segunda).toMatchObject({ creadas: 0, actualizadas: 3, tipologiasCreadas: 0 });
    expect(await unidadesDeProyecto(id)).toHaveLength(3);
  });

  it('deja las unidades que la planilla no menciona', async () => {
    const id = await crearPropiedad(datos());
    await aplicarImportacion(id, filas());
    await aplicarImportacion(id, analizarUnidades(['numero\tprecio uf', '302\t4.600'].join('\n')).filas);

    expect(await unidadesDeProyecto(id)).toHaveLength(3);
    expect((await unidadesDeProyecto(id)).find((u) => u.numero === '302')?.precioUF).toBe(4600);
  });

  it('con reemplazar, borra las que ya no vienen', async () => {
    const id = await crearPropiedad(datos());
    await aplicarImportacion(id, filas());
    const resultado = await aplicarImportacion(id, analizarUnidades(['numero\tprecio uf', '302\t4.600'].join('\n')).filas, true);

    expect(resultado.borradas).toBe(2);
    expect((await unidadesDeProyecto(id)).map((u) => u.numero)).toEqual(['302']);
  });

  it('el plan dice qué cambiaría sin escribir nada', async () => {
    const id = await crearPropiedad(datos());
    await aplicarImportacion(id, filas());

    const plan = await planearImportacion(
      id,
      analizarUnidades(['numero\tprecio uf\testado', '302\t4.600\tdisponible', '999\t5.000\tdisponible'].join('\n')).filas,
    );

    expect(plan.nuevas.map((f) => f.numero)).toEqual(['999']);
    expect(plan.cambian).toHaveLength(1);
    expect(plan.cambian[0].antes.precioUF).toBe(4520);
    expect(plan.cambian[0].fila.precioUF).toBe(4600);
    expect(plan.sobran.map((u) => u.numero)).toEqual(['304', '1201']);
    // Nada de esto se guardó: el precio sigue siendo el de antes.
    expect((await unidadesDeProyecto(id)).find((u) => u.numero === '302')?.precioUF).toBe(4520);
  });

  it('una fila idéntica no cuenta como cambio', async () => {
    const id = await crearPropiedad(datos());
    await aplicarImportacion(id, filas());
    const plan = await planearImportacion(id, filas());
    expect(plan.iguales).toBe(3);
    expect(plan.cambian).toHaveLength(0);
  });

  it('deja el precio desde al terminar', async () => {
    const id = await crearPropiedad(datos());
    await aplicarImportacion(id, filas());
    expect((await propiedadPorId(id))?.precio.valor).toBe(4520);
  });
});

describe('stock público', () => {
  it('no muestra lo vendido ni lo bloqueado', async () => {
    const id = await crearPropiedad(datos());
    await crearUnidad(id, unidad('302', 4520));
    await crearUnidad(id, unidad('304', 4480, { estado: 'reservada' }));
    await crearUnidad(id, unidad('306', 3900, { estado: 'vendida' }));
    await crearUnidad(id, unidad('308', 3800, { estado: 'bloqueada' }));

    const stock = await stockPublicoPorSlug('eco-estacion');
    expect(stock?.unidades.map((u) => u.numero)).toEqual(['302', '304']);
    // El resumen sí cuenta todo: es el total del proyecto.
    expect(stock?.resumen.total).toBe(4);
    expect(stock?.resumen.disponibles).toBe(1);
  });

  it('no entrega el stock de un borrador ni de una propiedad usada', async () => {
    await crearPropiedad(datos({ slug: 'borrador', estado: 'BORRADOR' }));
    await crearPropiedad(datos({ slug: 'retail', condicion: 'usado' }));
    expect(await stockPublicoPorSlug('borrador')).toBeNull();
    expect(await stockPublicoPorSlug('retail')).toBeNull();
    expect(await stockPublicoPorSlug('no-existe')).toBeNull();
  });

  it('la ficha pública llega con el resumen del stock', async () => {
    const id = await crearPropiedad(datos());
    await crearUnidad(id, unidad('302', 4520));
    expect((await propiedadPorSlug('eco-estacion'))?.stock).toMatchObject({ total: 1, disponibles: 1, desdeUF: 4520 });
  });
});

describe('borrado en cascada', () => {
  it('borrar la propiedad se lleva sus tipologías y unidades', async () => {
    const id = await crearPropiedad(datos());
    const tipologiaId = await crearTipologia(id, {
      codigo: '2D/2B',
      dormitorios: 2,
      banos: 2,
      superficieUtil: 68.5,
      superficieTerraza: 0,
      orden: 0,
    });
    await crearUnidad(id, unidad('302', 4520, { tipologiaId }));

    await eliminarPropiedad(id);

    const unidades = await env.DB.prepare(`SELECT COUNT(*) AS cuantas FROM unidades`).first<{ cuantas: number }>();
    const tipologias = await env.DB.prepare(`SELECT COUNT(*) AS cuantas FROM tipologias`).first<{ cuantas: number }>();
    expect(unidades?.cuantas).toBe(0);
    expect(tipologias?.cuantas).toBe(0);
  });
});
