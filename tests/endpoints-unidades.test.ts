import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { comoJson, pedir, sesionDePrueba } from './sesion';
import type { DatosPropiedad } from '@/lib/propiedades';

vi.mock('@/lib/db', () => ({
  obtenerDB: async () => env.DB,
  obtenerFotos: async () => env.FOTOS,
}));

const unidades = await import('../src/app/api/panel/propiedades/[id]/unidades/route');
const unidad = await import('../src/app/api/panel/propiedades/[id]/unidades/[unidadId]/route');
const tipologias = await import('../src/app/api/panel/propiedades/[id]/tipologias/route');
const tipologia = await import('../src/app/api/panel/propiedades/[id]/tipologias/[tipologiaId]/route');
const importar = await import('../src/app/api/panel/propiedades/[id]/unidades/importar/route');
const { crearPropiedad, propiedadPorId } = await import('@/lib/propiedades');
const { unidadesDeProyecto } = await import('@/lib/unidades');

const ruta = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });
const rutaUnidad = (id: number, unidadId: number) => ({ params: Promise.resolve({ id: String(id), unidadId: String(unidadId) }) });
const rutaTipologia = (id: number, tipologiaId: number) => ({
  params: Promise.resolve({ id: String(id), tipologiaId: String(tipologiaId) }),
});

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
  resumen: 'Proyecto nuevo.',
  descripcion: ['Primer párrafo.'],
  caracteristicas: [],
  destacada: false,
  publicada: '2026-11-20',
  estado: 'PUBLICADA',
  ilustracionSeed: 1,
  ilustracionTono: 'dia',
  ...p,
});

const cuerpoUnidad = (extra: Record<string, unknown> = {}) => ({
  numero: '302',
  precioUF: '4520',
  superficieUtil: '68,5',
  superficieTotal: '78',
  piso: '3',
  orientacion: 'Norte',
  estado: 'disponible',
  ...extra,
});

let cookie = '';
let proyecto = 0;

beforeEach(async () => {
  cookie = (await sesionDePrueba()).cookie;
  proyecto = await crearPropiedad(datos());
});

const crearUnidadPor = async (id = proyecto, extra: Record<string, unknown> = {}) => {
  const res = await unidades.POST(pedir(`/api/panel/propiedades/${id}/unidades`, cookie, comoJson(cuerpoUnidad(extra))), ruta(id));
  const cuerpo = (await res.json()) as { id: number; error?: string };
  expect(res.status, cuerpo.error).toBe(201);
  return cuerpo.id;
};

describe('sesión', () => {
  it('sin cookie no se puede leer ni escribir el stock', async () => {
    const lectura = await unidades.GET(pedir(`/api/panel/propiedades/${proyecto}/unidades`, null), ruta(proyecto));
    expect(lectura.status).toBe(401);

    const escritura = await unidades.POST(
      pedir(`/api/panel/propiedades/${proyecto}/unidades`, null, comoJson(cuerpoUnidad())),
      ruta(proyecto),
    );
    expect(escritura.status).toBe(401);
    expect(await unidadesDeProyecto(proyecto)).toHaveLength(0);
  });

  it('con clave temporal tampoco', async () => {
    const temporal = await sesionDePrueba({ claveTemporal: true });
    const res = await unidades.POST(
      pedir(`/api/panel/propiedades/${proyecto}/unidades`, temporal.cookie, comoJson(cuerpoUnidad())),
      ruta(proyecto),
    );
    expect(res.status).toBe(403);
  });
});

describe('alta de unidades', () => {
  it('crea la unidad y la devuelve en el stock', async () => {
    const id = await crearUnidadPor();

    const res = await unidades.GET(pedir(`/api/panel/propiedades/${proyecto}/unidades`, cookie), ruta(proyecto));
    const cuerpo = (await res.json()) as { unidades: { id: number; numero: string; superficieUtil: number }[] };
    expect(res.status).toBe(200);
    expect(cuerpo.unidades).toHaveLength(1);
    expect(cuerpo.unidades[0]).toMatchObject({ id, numero: '302', superficieUtil: 68.5 });
  });

  it('deja el precio desde en el aviso', async () => {
    await crearUnidadPor();
    await crearUnidadPor(proyecto, { numero: '304', precioUF: '4480' });
    expect((await propiedadPorId(proyecto))?.precio.valor).toBe(4480);
  });

  it('rechaza la unidad repetida', async () => {
    await crearUnidadPor();
    const res = await unidades.POST(
      pedir(`/api/panel/propiedades/${proyecto}/unidades`, cookie, comoJson(cuerpoUnidad())),
      ruta(proyecto),
    );
    expect(res.status).toBe(409);
  });

  it('rechaza el stock en una propiedad usada', async () => {
    const retail = await crearPropiedad(datos({ slug: 'retail', condicion: 'usado' }));
    const res = await unidades.POST(
      pedir(`/api/panel/propiedades/${retail}/unidades`, cookie, comoJson(cuerpoUnidad())),
      ruta(retail),
    );
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toContain('proyectos de inversión');
  });

  it('pide número y precio', async () => {
    const sinPrecio = await unidades.POST(
      pedir(`/api/panel/propiedades/${proyecto}/unidades`, cookie, comoJson(cuerpoUnidad({ precioUF: '' }))),
      ruta(proyecto),
    );
    expect(sinPrecio.status).toBe(422);

    const sinNumero = await unidades.POST(
      pedir(`/api/panel/propiedades/${proyecto}/unidades`, cookie, comoJson(cuerpoUnidad({ numero: '' }))),
      ruta(proyecto),
    );
    expect(sinNumero.status).toBe(422);
  });
});

describe('edición y borrado', () => {
  it('edita la unidad', async () => {
    const id = await crearUnidadPor();
    const res = await unidad.PUT(
      pedir(`/api/panel/propiedades/${proyecto}/unidades/${id}`, cookie, {
        ...comoJson(cuerpoUnidad({ precioUF: '4700', estado: 'reservada' })),
        method: 'PUT',
      }),
      rutaUnidad(proyecto, id),
    );
    expect(res.status).toBe(200);

    const guardada = (await unidadesDeProyecto(proyecto))[0];
    expect(guardada).toMatchObject({ precioUF: 4700, estado: 'reservada' });
  });

  it('no deja tocar la unidad de otro proyecto', async () => {
    const id = await crearUnidadPor();
    const otro = await crearPropiedad(datos({ slug: 'otro-proyecto' }));

    const editar = await unidad.PUT(
      pedir(`/api/panel/propiedades/${otro}/unidades/${id}`, cookie, { ...comoJson(cuerpoUnidad()), method: 'PUT' }),
      rutaUnidad(otro, id),
    );
    expect(editar.status).toBe(404);

    const borrar = await unidad.DELETE(
      pedir(`/api/panel/propiedades/${otro}/unidades/${id}`, cookie, { method: 'DELETE' }),
      rutaUnidad(otro, id),
    );
    expect(borrar.status).toBe(404);
    expect(await unidadesDeProyecto(proyecto)).toHaveLength(1);
  });

  it('borra la unidad', async () => {
    const id = await crearUnidadPor();
    const res = await unidad.DELETE(
      pedir(`/api/panel/propiedades/${proyecto}/unidades/${id}`, cookie, { method: 'DELETE' }),
      rutaUnidad(proyecto, id),
    );
    expect(res.status).toBe(200);
    expect(await unidadesDeProyecto(proyecto)).toHaveLength(0);
  });
});

describe('cambio de estado en lote', () => {
  it('marca varias como vendidas', async () => {
    const a = await crearUnidadPor();
    const b = await crearUnidadPor(proyecto, { numero: '304', precioUF: '4480' });

    const res = await unidades.PATCH(
      pedir(`/api/panel/propiedades/${proyecto}/unidades`, cookie, {
        ...comoJson({ ids: [a, b], estado: 'vendida' }),
        method: 'PATCH',
      }),
      ruta(proyecto),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { cambiadas: number }).cambiadas).toBe(2);
    expect((await unidadesDeProyecto(proyecto)).every((u) => u.estado === 'vendida')).toBe(true);
  });

  it('rechaza un estado que no existe', async () => {
    const id = await crearUnidadPor();
    const res = await unidades.PATCH(
      pedir(`/api/panel/propiedades/${proyecto}/unidades`, cookie, {
        ...comoJson({ ids: [id], estado: 'regalada' }),
        method: 'PATCH',
      }),
      ruta(proyecto),
    );
    expect(res.status).toBe(422);
  });

  it('rechaza el lote si una unidad no es del proyecto', async () => {
    const id = await crearUnidadPor();
    const res = await unidades.PATCH(
      pedir(`/api/panel/propiedades/${proyecto}/unidades`, cookie, {
        ...comoJson({ ids: [id, id + 500], estado: 'vendida' }),
        method: 'PATCH',
      }),
      ruta(proyecto),
    );
    expect(res.status).toBe(409);
    expect((await unidadesDeProyecto(proyecto))[0].estado).toBe('disponible');
  });
});

describe('tipologías', () => {
  const cuerpo = (extra: Record<string, unknown> = {}) => ({
    codigo: '2D/2B',
    dormitorios: '2',
    banos: '2',
    superficieUtil: '68,5',
    superficieTerraza: '9,5',
    ...extra,
  });

  it('crea, edita y borra', async () => {
    const creada = await tipologias.POST(
      pedir(`/api/panel/propiedades/${proyecto}/tipologias`, cookie, comoJson(cuerpo())),
      ruta(proyecto),
    );
    expect(creada.status).toBe(201);
    const { id } = (await creada.json()) as { id: number };

    const editada = await tipologia.PUT(
      pedir(`/api/panel/propiedades/${proyecto}/tipologias/${id}`, cookie, {
        ...comoJson(cuerpo({ codigo: '2D/1B', banos: '1' })),
        method: 'PUT',
      }),
      rutaTipologia(proyecto, id),
    );
    expect(editada.status).toBe(200);

    const borrada = await tipologia.DELETE(
      pedir(`/api/panel/propiedades/${proyecto}/tipologias/${id}`, cookie, { method: 'DELETE' }),
      rutaTipologia(proyecto, id),
    );
    expect(borrada.status).toBe(200);
  });

  it('pide el código', async () => {
    const res = await tipologias.POST(
      pedir(`/api/panel/propiedades/${proyecto}/tipologias`, cookie, comoJson(cuerpo({ codigo: '' }))),
      ruta(proyecto),
    );
    expect(res.status).toBe(422);
  });
});

describe('importación', () => {
  const planilla = [
    'numero\ttipologia\tpiso\tutil\tprecio uf\testado',
    '302\t2D/2B\t3\t68,5\t4.520\tdisponible',
    '304\t2D/2B\t3\t68,5\t4.480\treservada',
  ].join('\n');

  const pedirImportacion = (body: Record<string, unknown>, id = proyecto) =>
    importar.POST(pedir(`/api/panel/propiedades/${id}/unidades/importar`, cookie, comoJson(body)), ruta(id));

  it('la vista previa no escribe nada', async () => {
    const res = await pedirImportacion({ texto: planilla });
    const cuerpo = (await res.json()) as {
      confirmado: boolean;
      nuevas: { numero: string }[];
      tipologiasNuevas: string[];
    };
    expect(res.status).toBe(200);
    expect(cuerpo.confirmado).toBe(false);
    expect(cuerpo.nuevas.map((n) => n.numero)).toEqual(['302', '304']);
    expect(cuerpo.tipologiasNuevas).toEqual(['2D/2B']);
    expect(await unidadesDeProyecto(proyecto)).toHaveLength(0);
  });

  it('al confirmar carga el stock y deja el precio desde', async () => {
    const res = await pedirImportacion({ texto: planilla, confirmar: true });
    const cuerpo = (await res.json()) as { creadas: number; tipologiasCreadas: number };
    expect(res.status).toBe(200);
    expect(cuerpo).toMatchObject({ creadas: 2, tipologiasCreadas: 1 });
    expect(await unidadesDeProyecto(proyecto)).toHaveLength(2);
    expect((await propiedadPorId(proyecto))?.precio.valor).toBe(4520);
  });

  it('informa las filas con problemas sin botar la carga', async () => {
    const res = await pedirImportacion({
      texto: ['numero\tprecio uf', '302\t4.520', '\t4.000'].join('\n'),
      confirmar: true,
    });
    const cuerpo = (await res.json()) as { creadas: number; errores: { linea: number }[] };
    expect(cuerpo.creadas).toBe(1);
    expect(cuerpo.errores).toHaveLength(1);
  });

  it('rechaza la planilla vacía y la que no nombra las columnas', async () => {
    expect((await pedirImportacion({ texto: '   ' })).status).toBe(400);
    expect((await pedirImportacion({ texto: 'algo\totra\n1\t2' })).status).toBe(422);
  });

  it('no deja importar a una propiedad usada', async () => {
    const retail = await crearPropiedad(datos({ slug: 'retail', condicion: 'usado' }));
    const res = await pedirImportacion({ texto: planilla, confirmar: true }, retail);
    expect(res.status).toBe(409);
  });
});
