import { describe, expect, it } from 'vitest';
import { fechaLeadValida, validarLead } from '@/lib/validar-lead';

const consulta = {
  variante: 'contacto', nombre: 'José Muñoz', email: 'jose@example.com', mensaje: 'Quisiera conocer sus servicios.', acepto: 'si',
};

describe('validación compartida del formulario público', () => {
  it('permite consultas con teléfono y fecha vacíos y normaliza espacios', () => {
    const resultado = validarLead({ ...consulta, nombre: '  José Muñoz  ', telefono: '', fecha: '' });
    expect(resultado).toMatchObject({ ok: true, lead: { nombre: 'José Muñoz', telefono: '', fecha: '' } });
  });

  it('una variante desconocida debe cumplir también los requisitos de contacto', () => {
    expect(validarLead({ ...consulta, variante: 'inventada', mensaje: '' })).toMatchObject({ ok: false, errores: { mensaje: expect.any(String) } });
    expect(validarLead({ ...consulta, variante: 'inventada' })).toMatchObject({ ok: true, lead: { variante: 'contacto' } });
  });

  it('acepta teléfonos chilenos e internacionales, rechaza datos sin dígitos o excesivos', () => {
    for (const telefono of ['+56 9 1234 5678', '(02) 2345-6789', '+1 (212) 555-1234']) {
      expect(validarLead({ ...consulta, telefono }).ok).toBe(true);
    }
    for (const telefono of ['abcdefghi', '9123456', '1234567890123456', '++56912345678', '+56\n912345678']) {
      expect(validarLead({ ...consulta, telefono })).toMatchObject({ ok: false, errores: { telefono: expect.any(String) } });
    }
  });

  it('conserva saltos de línea en el mensaje, pero no los permite en datos de una línea', () => {
    expect(validarLead({ ...consulta, mensaje: 'Buenos días.\nQuiero coordinar una asesoría.' }).ok).toBe(true);
    expect(validarLead({ ...consulta, nombre: 'José\r\nOtro' })).toMatchObject({ ok: false, errores: { nombre: expect.any(String) } });
    expect(validarLead({ ...consulta, mensaje: 'Quisiera\u0000asesoría' })).toMatchObject({ ok: false, errores: { mensaje: expect.any(String) } });
  });

  it('no confunde fechas imposibles con el día siguiente ni exige una fecha opcional', () => {
    expect(fechaLeadValida('2028-02-29')).toBe(true);
    for (const fecha of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-1-01', '0000-01-01']) {
      expect(fechaLeadValida(fecha)).toBe(false);
    }
  });
});
