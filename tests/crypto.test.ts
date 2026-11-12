import { describe, expect, it } from 'vitest';
import {
  formatearRut,
  generarClaveTemporal,
  generarToken,
  hashPassword,
  hashToken,
  normalizarRut,
  validarPassword,
  validarRut,
  verifyPassword,
} from '@/lib/crypto';

describe('RUT', () => {
  it('acepta un RUT válido escrito de cualquier forma', () => {
    for (const rut of ['11.111.111-1', '11111111-1', '111111111', ' 11.111.111-1 ']) {
      expect(validarRut(rut)).toBe(true);
    }
  });

  it('acepta el dígito verificador K en minúscula', () => {
    expect(validarRut('12.345.670-k')).toBe(true);
    expect(validarRut('12.345.670-K')).toBe(true);
  });

  it('rechaza un dígito verificador equivocado', () => {
    expect(validarRut('11.111.111-2')).toBe(false);
    expect(validarRut('12.345.670-9')).toBe(false);
    expect(validarRut('20.347.550-K')).toBe(false);
  });

  it('rechaza lo que no es un RUT', () => {
    for (const basura of ['', '123', 'hola', '1.111-1', '111111111111', '11.111.111-X']) {
      expect(validarRut(basura)).toBe(false);
    }
  });

  it('normaliza a mayúsculas y sin puntos ni guion', () => {
    expect(normalizarRut('12.345.670-k')).toBe('12345670K');
    expect(normalizarRut(12345678)).toBe('');
  });

  it('formatea de vuelta con puntos y guion', () => {
    expect(formatearRut('12345670K')).toBe('12.345.670-K');
    expect(formatearRut('11.111.111-1')).toBe('11.111.111-1');
  });
});

describe('política de contraseñas', () => {
  it('exige 10 caracteres, una letra y un número', () => {
    expect(validarPassword('corta1').ok).toBe(false);
    expect(validarPassword('solo-letras-aqui').ok).toBe(false);
    expect(validarPassword('1234567890').ok).toBe(false);
    expect(validarPassword('contrasena1').ok).toBe(true);
  });

  it('cuenta las letras acentuadas y la ñ como letras', () => {
    expect(validarPassword('mañanaaaa1').ok).toBe(true);
  });

  it('rechaza lo que no es texto y lo demasiado largo', () => {
    expect(validarPassword(undefined).ok).toBe(false);
    expect(validarPassword(123456789012).ok).toBe(false);
    expect(validarPassword(`${'a'.repeat(128)}1`).ok).toBe(false);
  });
});

describe('hash de contraseñas', () => {
  it('verifica la contraseña correcta y rechaza la equivocada', async () => {
    const { hash, salt } = await hashPassword('clave-de-prueba-1');
    expect(await verifyPassword('clave-de-prueba-1', hash, salt)).toBe(true);
    expect(await verifyPassword('clave-de-prueba-2', hash, salt)).toBe(false);
  });

  it('usa un salt distinto cada vez, así dos cuentas con la misma clave no comparten hash', async () => {
    const a = await hashPassword('la-misma-clave-1');
    const b = await hashPassword('la-misma-clave-1');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it('con el mismo salt el hash es el mismo: es lo que permite crear al admin desde un script', async () => {
    const { hash, salt } = await hashPassword('clave-de-prueba-1');
    const repetido = await hashPassword('clave-de-prueba-1', salt);
    expect(repetido.hash).toBe(hash);
  });
});

describe('tokens de sesión', () => {
  it('genera 256 bits en hexadecimal y nunca el mismo dos veces', () => {
    const uno = generarToken();
    const otro = generarToken();
    expect(uno).toMatch(/^[0-9a-f]{64}$/);
    expect(uno).not.toBe(otro);
  });

  it('el hash que se guarda en la base es determinista y no devuelve el token', async () => {
    const token = generarToken();
    const hash = await hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(await hashToken(token));
    expect(hash).not.toBe(token);
  });
});

describe('clave temporal', () => {
  it('cumple la política por construcción y evita caracteres ambiguos', () => {
    for (let i = 0; i < 50; i += 1) {
      const clave = generarClaveTemporal();
      expect(clave).toHaveLength(12);
      expect(validarPassword(clave).ok).toBe(true);
      expect(clave).not.toMatch(/[0O1lI]/);
    }
  });
});
