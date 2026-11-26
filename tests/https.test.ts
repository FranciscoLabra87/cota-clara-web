import { describe, expect, it } from 'vitest';
import { protegerHttps, redireccionPublica } from '@/lib/https';

describe('HTTPS del dominio público', () => {
  it('conserva la ruta y consulta y usa 308 también para peticiones con cuerpo', () => {
    const respuesta = redireccionPublica(new Request('http://cotaclara.cl/api/contacto?origen=web', { method: 'POST', body: '{}' }));
    expect(respuesta?.status).toBe(308);
    expect(respuesta?.headers.get('Location')).toBe('https://www.cotaclara.cl/api/contacto?origen=web');
  });
  it('elige un solo host público sin redirigir desarrollo ni previews', () => {
    expect(redireccionPublica(new Request('https://cotaclara.cl/og.png'))?.headers.get('Location')).toBe('https://www.cotaclara.cl/og.png');
    for (const url of ['https://www.cotaclara.cl/', 'http://localhost:3000/', 'http://127.0.0.1/', 'https://preview.workers.dev/', 'http://cotaclara.cl.ejemplo.com/']) expect(redireccionPublica(new Request(url))).toBeNull();
  });
  it('añade HSTS a respuestas públicas conservando cuerpo y cabeceras', async () => {
    const respuesta = protegerHttps(new Request('https://www.cotaclara.cl/og.png'), new Response('imagen', { headers: { 'Content-Type': 'image/png' } }));
    expect(respuesta.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
    expect(respuesta.headers.get('Content-Type')).toBe('image/png');
    expect(await respuesta.text()).toBe('imagen');
    expect(protegerHttps(new Request('http://localhost/'), new Response()).headers.has('Strict-Transport-Security')).toBe(false);
  });
});
