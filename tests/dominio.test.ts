import { describe, expect, it } from 'vitest';
import { esDominioPublico } from '@/lib/dominio';

describe('dominio público', () => {
  it('reconoce el dominio del sitio con y sin www', () => {
    expect(esDominioPublico('www.cotaclara.cl')).toBe(true);
    expect(esDominioPublico('cotaclara.cl')).toBe(true);
    expect(esDominioPublico('WWW.CotaClara.cl')).toBe(true);
    expect(esDominioPublico('www.cotaclara.cl:443')).toBe(true);
  });

  it('deja fuera la dirección de Cloudflare y el desarrollo local', () => {
    expect(esDominioPublico('cota-clara-web.franciscolabra87.workers.dev')).toBe(false);
    expect(esDominioPublico('localhost:3000')).toBe(false);
    expect(esDominioPublico('127.0.0.1')).toBe(false);
  });

  it('no se deja engañar por un host que solo contiene el dominio', () => {
    expect(esDominioPublico('cotaclara.cl.evil.example')).toBe(false);
    expect(esDominioPublico('falso-cotaclara.cl')).toBe(false);
    expect(esDominioPublico('staging.cotaclara.cl')).toBe(false);
  });

  it('sin host, por las dudas, no es público', () => {
    expect(esDominioPublico(null)).toBe(false);
    expect(esDominioPublico(undefined)).toBe(false);
    expect(esDominioPublico('')).toBe(false);
  });
});
