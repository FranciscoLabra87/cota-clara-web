import { describe, expect, it } from 'vitest';
import { analizarUnidades, ErrorImportacion, medidasDeCodigo, numeroCL } from '@/lib/importar-unidades';

// El lector de planillas es puro: no toca base ni red, así que se prueba solo.

describe('numeroCL', () => {
  it('lee los números como se escriben acá', () => {
    expect(numeroCL('4.500')).toBe(4500);
    expect(numeroCL('4.500,5')).toBe(4500.5);
    expect(numeroCL('68,5')).toBe(68.5);
    expect(numeroCL('1.234.567')).toBe(1234567);
  });

  it('entiende el punto decimal de una planilla exportada en inglés', () => {
    expect(numeroCL('68.5')).toBe(68.5);
  });

  it('ignora la unidad pegada al número', () => {
    expect(numeroCL('UF 4.520')).toBe(4520);
    expect(numeroCL('$ 1.500')).toBe(1500);
  });

  it('devuelve NaN con lo que no es número', () => {
    expect(Number.isNaN(numeroCL(''))).toBe(true);
    expect(Number.isNaN(numeroCL('consultar'))).toBe(true);
  });
});

describe('medidasDeCodigo', () => {
  it('saca dormitorios y baños del código de la tipología', () => {
    expect(medidasDeCodigo('2D/2B')).toEqual({ dormitorios: 2, banos: 2 });
    expect(medidasDeCodigo('3d1b')).toEqual({ dormitorios: 3, banos: 1 });
    expect(medidasDeCodigo('1D + 1B')).toEqual({ dormitorios: 1, banos: 1 });
  });

  it('deja en cero lo que el código no dice', () => {
    expect(medidasDeCodigo('Loft')).toEqual({ dormitorios: 0, banos: 0 });
  });
});

const planilla = [
  'Unidad\tTipología\tPiso\tOrientación\tÚtil\tTotal\tPrecio UF\tEstac.\tBodegas\tEstado',
  '302\t2D/2B\t3\tNorte\t68,5\t78\t4.520\t1\t1\tDisponible',
  '304\t2D/2B\t3\tSur\t68,5\t78\t4.480\t1\t0\tReservado',
  '1201\t3D/2B\t12\tPoniente\t92\t104\t6.100\t2\t1\tVendida',
].join('\n');

describe('analizarUnidades', () => {
  it('lee una planilla con encabezados con tildes y abreviaturas', () => {
    const { filas, errores, columnas } = analizarUnidades(planilla);
    expect(errores).toEqual([]);
    expect(filas).toHaveLength(3);
    expect(columnas).toContain('numero');
    expect(columnas).toContain('precioUF');

    expect(filas[0]).toMatchObject({
      numero: '302',
      tipologia: '2D/2B',
      piso: 3,
      orientacion: 'Norte',
      superficieUtil: 68.5,
      superficieTotal: 78,
      precioUF: 4520,
      estacionamientos: 1,
      bodegas: 1,
      estado: 'disponible',
    });
  });

  it('traduce los estados como los escribe la inmobiliaria', () => {
    const { filas } = analizarUnidades(planilla);
    expect(filas.map((f) => f.estado)).toEqual(['disponible', 'reservada', 'vendida']);
  });

  it('acepta el punto y coma del CSV', () => {
    const { filas } = analizarUnidades(['numero;precio uf;estado', '101;3.900;disponible'].join('\n'));
    expect(filas).toHaveLength(1);
    expect(filas[0].precioUF).toBe(3900);
  });

  it('deja la unidad como disponible si la planilla no trae estado', () => {
    const { filas } = analizarUnidades(['numero\tprecio uf', '101\t3900'].join('\n'));
    expect(filas[0].estado).toBe('disponible');
  });

  it('anota la línea de las filas sin número o sin precio, sin botar el resto', () => {
    const { filas, errores } = analizarUnidades(
      ['numero\tprecio uf', '101\t3900', '\t4000', '103\tconsultar', '104\t4100'].join('\n'),
    );
    expect(filas.map((f) => f.numero)).toEqual(['101', '104']);
    expect(errores).toHaveLength(2);
    expect(errores[0]).toEqual({ linea: 3, error: 'Sin número de unidad' });
    expect(errores[1].error).toContain('precio en UF');
  });

  it('rechaza la unidad repetida dentro de la misma planilla', () => {
    const { filas, errores } = analizarUnidades(['numero\tprecio uf', '101\t3900', '101\t4000'].join('\n'));
    expect(filas).toHaveLength(1);
    expect(errores[0].error).toContain('repetida');
  });

  it('corta si el encabezado no nombra las columnas mínimas', () => {
    expect(() => analizarUnidades(['algo\totra cosa', '1\t2'].join('\n'))).toThrow(ErrorImportacion);
  });

  it('corta si no hay nada pegado', () => {
    expect(() => analizarUnidades('   ')).toThrow(ErrorImportacion);
  });

  it('corta si la planilla trae encabezado y ninguna fila', () => {
    expect(() => analizarUnidades('numero\tprecio uf')).toThrow(ErrorImportacion);
  });
});
