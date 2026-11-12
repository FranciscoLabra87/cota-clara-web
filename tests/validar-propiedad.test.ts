import { describe, expect, it } from 'vitest';
import { validarPropiedad } from '@/lib/validar-propiedad';

// Lo mínimo que el formulario del panel tiene que mandar para que pase.
const base = () => ({
  tipo: 'departamento',
  operacion: 'venta',
  comuna: 'Providencia',
  precioMoneda: 'UF',
  precioValor: '7890',
  publicada: '2026-11-12',
  resumen: 'Luminoso, con terraza y vista despejada.',
  dormitorios: '3',
  banos: '2',
  estacionamientos: '1',
  bodegas: '1',
  superficieUtil: '96',
  superficieTotal: '104',
  anio: '2016',
});

const datosDe = (body: Record<string, unknown>) => {
  const r = validarPropiedad(body);
  if (!r.ok) throw new Error(`esperaba que pasara: ${r.error}`);
  return r.datos;
};

const errorDe = (body: Record<string, unknown>) => {
  const r = validarPropiedad(body);
  if (r.ok) throw new Error('esperaba que fallara');
  return r.error;
};

describe('lo que acepta', () => {
  it('pasa con lo mínimo y rellena lo demás', () => {
    const datos = datosDe(base());
    expect(datos.estado).toBe('BORRADOR');
    expect(datos.ilustracionTono).toBe('dia');
    // Sin semilla queda en 0, no en el 1 que pone la base: el formulario
    // siempre manda una, y el dibujo sale igual con cualquier número.
    expect(datos.ilustracionSeed).toBe(0);
    expect(datos.destacada).toBe(false);
    expect(datos.terreno).toBeNull();
    expect(datos.etiquetas).toEqual([]);
  });

  it('arma el enlace con el tipo, la comuna y el sector cuando no viene', () => {
    expect(datosDe({ ...base(), sector: 'Pedro de Valdivia' }).slug).toBe('departamento-providencia-pedro-de-valdivia');
  });

  it('limpia el enlace que escriben a mano', () => {
    expect(datosDe({ ...base(), slug: '  Casa Ñuñoa / Plaza!!  ' }).slug).toBe('casa-nunoa-plaza');
  });

  it('parte la descripción por líneas y descarta las vacías', () => {
    const datos = datosDe({ ...base(), descripcion: 'Primer párrafo.\n\n  \nSegundo párrafo.' });
    expect(datos.descripcion).toEqual(['Primer párrafo.', 'Segundo párrafo.']);
  });

  it('acepta la lista ya partida en arreglo', () => {
    expect(datosDe({ ...base(), caracteristicas: ['Piso flotante', '  Cocina equipada  '] }).caracteristicas).toEqual([
      'Piso flotante',
      'Cocina equipada',
    ]);
  });

  it('marca destacada con lo que mandan el formulario y el JSON', () => {
    expect(datosDe({ ...base(), destacada: 'on' }).destacada).toBe(true);
    expect(datosDe({ ...base(), destacada: true }).destacada).toBe(true);
    expect(datosDe({ ...base(), destacada: 'true' }).destacada).toBe(true);
    expect(datosDe({ ...base(), destacada: 'no' }).destacada).toBe(false);
  });

  it('deja vacíos terreno, piso y gastos comunes', () => {
    const datos = datosDe({ ...base(), terreno: '', piso: '   ', gastosComunes: null });
    expect([datos.terreno, datos.piso, datos.gastosComunes]).toEqual([null, null, null]);
  });
});

describe('lo que corta', () => {
  it('no deja pasar textos más largos que la columna', () => {
    const datos = datosDe({ ...base(), resumen: 'a'.repeat(500), comuna: 'b'.repeat(200) });
    expect(datos.resumen).toHaveLength(300);
    expect(datos.comuna).toHaveLength(60);
  });

  it('corta las listas al máximo de elementos', () => {
    const muchas = Array.from({ length: 20 }, (_, i) => `Etiqueta ${i}`);
    expect(datosDe({ ...base(), etiquetas: muchas }).etiquetas).toHaveLength(8);
  });
});

describe('lo que rechaza', () => {
  it('pide tipo, operación, comuna, moneda y precio', () => {
    expect(errorDe({ ...base(), tipo: 'bodega' })).toMatch(/tipo/i);
    expect(errorDe({ ...base(), operacion: 'permuta' })).toMatch(/venta o arriendo/i);
    expect(errorDe({ ...base(), comuna: '   ' })).toMatch(/comuna/i);
    expect(errorDe({ ...base(), precioMoneda: 'USD' })).toMatch(/moneda/i);
  });

  it('rechaza precios que no sirven', () => {
    for (const precio of ['0', '-100', 'mucho', '', '9999999999']) {
      expect(errorDe({ ...base(), precioValor: precio })).toMatch(/precio/i);
    }
  });

  it('exige la fecha como AAAA-MM-DD', () => {
    for (const fecha of ['12-11-2026', '2026/11/12', '2026-13-40', 'hoy', '']) {
      expect(errorDe({ ...base(), publicada: fecha })).toMatch(/AAAA-MM-DD/);
    }
  });

  it('exige que los números sean números', () => {
    expect(errorDe({ ...base(), dormitorios: 'tres' })).toMatch(/dormitorios/);
    expect(errorDe({ ...base(), superficieUtil: '-5' })).toMatch(/superficieUtil/);
    expect(errorDe({ ...base(), terreno: 'grande' })).toMatch(/terreno, piso o gastos comunes/);
  });

  it('exige el resumen, que es lo que se ve en la tarjeta', () => {
    expect(errorDe({ ...base(), resumen: '   ' })).toMatch(/resumen/i);
  });

  it('rechaza estados y tonos inventados', () => {
    expect(errorDe({ ...base(), estado: 'ARCHIVADA' })).toMatch(/estado/i);
    expect(errorDe({ ...base(), ilustracionTono: 'noche' })).toMatch(/tono/i);
  });

  it('no deja un enlace vacío', () => {
    expect(errorDe({ ...base(), slug: '!!!', comuna: '¿?', sector: '' })).toMatch(/enlace/i);
  });
});
