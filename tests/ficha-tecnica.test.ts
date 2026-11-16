import { describe, expect, it } from 'vitest';
import { validarFicha } from '@/lib/ficha-tecnica';

const datosDe = (body: Record<string, unknown>) => {
  const resultado = validarFicha(body);
  if (!resultado.ok) throw new Error(resultado.error);
  return resultado.datos;
};

describe('validación de antecedentes técnicos', () => {
  it('una ficha vacía no inventa revisiones, estado ni datos técnicos', () => {
    expect(datosDe({})).toEqual({});
    expect(datosDe({ fechaRevision: '', estadoAntecedentes: '', revisadoPor: ' ' })).toEqual({});
  });

  it('acepta cero fiscal y agrupación chilena de miles sin confundir decimales', () => {
    expect(datosDe({ avaluoFiscal: '100.000.000', contribuciones: '0', pisos: 2 })).toEqual({ avaluoFiscal: 100000000, contribuciones: 0, pisos: 2 });
    for (const valor of ['1.5', '100.00', '1,5', 1.5, -1, true, '1e6']) {
      expect(validarFicha({ avaluoFiscal: valor }).ok).toBe(false);
    }
  });

  it('rechaza pisos fraccionarios o fuera de rango', () => {
    for (const valor of ['2.5', '0', '201', 2.5]) expect(validarFicha({ pisos: valor }).ok).toBe(false);
  });

  it('valida el calendario real, incluido año bisiesto', () => {
    expect(datosDe({ fechaRevision: '2024-02-29' }).fechaRevision).toBe('2024-02-29');
    for (const fecha of ['2026-02-29', '2026-02-31', '2026-04-31', '2026-13-01', '2026-00-01', '15/11/2026', '2026-1-1', 20261115]) {
      expect(validarFicha({ fechaRevision: fecha }).ok).toBe(false);
    }
  });

  it('acepta los estados declarados y rechaza estados inventados o no textuales', () => {
    for (const estado of ['Informados', 'Revisados documentalmente', 'Pendientes']) {
      expect(datosDe({ estadoAntecedentes: estado, fuenteAntecedentes: 'Documento de prueba', fechaRevision: '2026-11-15', revisadoPor: 'Camila' }).estadoAntecedentes).toBe(estado);
    }
    for (const estado of ['Verificado por IA', true, ['Informados']]) expect(validarFicha({ estadoAntecedentes: estado }).ok).toBe(false);
  });

  it('exige trazabilidad completa solo al declarar una revisión documental', () => {
    const revision = { estadoAntecedentes: 'Revisados documentalmente', fuenteAntecedentes: 'Certificado SII', fechaRevision: '2026-11-15', revisadoPor: 'Camila' };
    expect(datosDe(revision)).toEqual(revision);
    for (const campo of ['fuenteAntecedentes', 'fechaRevision', 'revisadoPor']) {
      expect(validarFicha({ ...revision, [campo]: '' }).ok).toBe(false);
    }
    expect(datosDe({ estadoAntecedentes: 'Pendientes' })).toEqual({ estadoAntecedentes: 'Pendientes' });
  });

  it('normaliza el rol y no recorta textos administrativos en silencio', () => {
    expect(datosDe({ rolSii: ' 01234 - 00056 ', fuenteAntecedentes: '  Certificado SII  ', revisadoPor: '  Camila  ' }))
      .toEqual({ rolSii: '01234-00056', fuenteAntecedentes: 'Certificado SII', revisadoPor: 'Camila' });
    expect(validarFicha({ rolSii: '123456-1' }).ok).toBe(false);
    expect(validarFicha({ fuenteAntecedentes: 'x'.repeat(301) }).ok).toBe(false);
    expect(validarFicha({ revisadoPor: 'x'.repeat(101) }).ok).toBe(false);
    expect(validarFicha({ observaciones: ['nota'] }).ok).toBe(false);
  });
});
