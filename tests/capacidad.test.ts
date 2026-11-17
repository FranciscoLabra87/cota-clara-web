import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';
import { CUOTA_POR_DEFECTO } from '@/lib/drive';
import { medirD1, medirR2 } from '@/lib/capacidad';

it('mide lo ocupado en D1 y el espacio reservado por el Drive', async () => {
  await env.DB.prepare(
    `INSERT INTO drive_archivos (clave, nombre, tipo, tamano, estado)
     VALUES ('drive/prueba/uno', 'uno.pdf', 'application/pdf', 1024, 'listo'),
            ('drive/prueba/dos', 'dos.pdf', 'application/pdf', 2048, 'subiendo')`,
  ).run();
  const dato = await medirD1(env.DB, CUOTA_POR_DEFECTO);
  expect(dato.bytes).toBeGreaterThan(0);
  expect(dato.archivosDrive).toBe(2);
  expect(dato.reservadoDrive).toBe(3072);
  expect(dato.cuotaDrive).toBe(CUOTA_POR_DEFECTO);
});

it('suma los objetos reales de R2 y distingue Drive de fotos', async () => {
  await env.FOTOS.put('drive/prueba/uno', 'archivo');
  await env.FOTOS.put('propiedades/foto.webp', 'foto');
  const dato = await medirR2(env.FOTOS);
  expect(dato).toMatchObject({ bytes: 11, objetos: 2, bytesDrive: 7, bytesFotos: 4, completo: true });
});
