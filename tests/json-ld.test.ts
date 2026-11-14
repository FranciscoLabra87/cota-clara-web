import { describe, expect, it } from 'vitest';
import { jsonLd } from '@/lib/json-ld';

describe('datos estructurados', () => {
  it('un texto de la base no puede cerrar el <script> ni abrir otro', () => {
    const malicioso = '</script><script>alert(1)</script>';
    const salida = jsonLd({ areaServed: [{ '@type': 'City', name: malicioso }] });
    expect(salida).not.toContain('<');
    expect(salida).not.toContain('>');
    expect(salida.toLowerCase()).not.toContain('</script');
  });

  it('el JSON sigue siendo el mismo para quien lo lee', () => {
    const datos = { name: 'Cota Clara · Patrimonio', comunas: ['Ñuñoa', 'A & B', '<x>', 'línea separada'] };
    expect(JSON.parse(jsonLd(datos))).toEqual(datos);
  });
});
