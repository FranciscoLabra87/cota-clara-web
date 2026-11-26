import { describe, expect, it } from 'vitest';
import { esPaginaMedible, idMedicionValido, leerPreferenciasCookies, VIGENCIA_COOKIES_MS } from '@/lib/consentimiento';

describe('consentimiento de analítica', () => {
  const ahora = Date.UTC(2026, 10, 26);
  it('solo admite una elección explícita, vigente y de versión conocida', () => {
    expect(leerPreferenciasCookies(JSON.stringify({ version: 1, analitica: false, fecha: ahora - 1 }), ahora)?.analitica).toBe(false);
    expect(leerPreferenciasCookies(JSON.stringify({ version: 1, analitica: true, fecha: ahora - 1 }), ahora)?.analitica).toBe(true);
    for (const valor of [null, '{}', 'null', 'no-json', JSON.stringify({ version: 1, analitica: 'true', fecha: ahora }), JSON.stringify({ version: 2, analitica: true, fecha: ahora }), JSON.stringify({ version: 1, analitica: true, fecha: ahora + 1 }), JSON.stringify({ version: 1, analitica: true, fecha: ahora - VIGENCIA_COOKIES_MS })]) {
      expect(leerPreferenciasCookies(valor, ahora)).toBeNull();
    }
  });
  it('excluye las páginas privadas pero conserva rutas públicas con nombres parecidos', () => {
    for (const ruta of ['/panel', '/panel/usuarios', '/acceso', '/api/contacto', '/drive/archivos/1']) expect(esPaginaMedible(ruta)).toBe(false);
    for (const ruta of ['/', '/propiedades/casa', '/privacidad', '/paneles-solares']) expect(esPaginaMedible(ruta)).toBe(true);
  });
  it('no convierte valores arbitrarios en una dirección de script', () => {
    expect(idMedicionValido(' G-TEST123456 ')).toBe('G-TEST123456');
    expect(idMedicionValido('G-1234&otro=valor')).toBeNull();
    expect(idMedicionValido(undefined)).toBeNull();
  });
});
