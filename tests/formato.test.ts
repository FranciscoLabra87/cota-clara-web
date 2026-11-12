import { describe, expect, it } from 'vitest';
import { formatNumero, formatPrecio, periodoPrecio } from '@/lib/format';

// Estas pruebas corren en workerd, así que también confirman que el runtime
// del deploy trae el ICU de es-CL: punto para los miles y coma decimal.
describe('números en es-CL', () => {
  it('usa punto para los miles', () => {
    expect(formatNumero(7890)).toBe('7.890');
    expect(formatNumero(1234567)).toBe('1.234.567');
    expect(formatNumero(999)).toBe('999');
  });

  it('redondea a entero salvo que se pidan decimales', () => {
    expect(formatNumero(96.4)).toBe('96');
    expect(formatNumero(96.4, 1)).toBe('96,4');
  });
});

describe('precios', () => {
  it('escribe UF y pesos como corresponde', () => {
    expect(formatPrecio({ valor: 7890, moneda: 'UF' })).toBe('UF 7.890');
    expect(formatPrecio({ valor: 1200000, moneda: 'CLP' })).toBe('$1.200.000');
  });

  it('el periodo solo aparece en arriendo', () => {
    expect(periodoPrecio({ valor: 1200000, moneda: 'CLP', periodo: 'mes' })).toBe('/ mes');
    expect(periodoPrecio({ valor: 7890, moneda: 'UF' })).toBeNull();
  });
});
