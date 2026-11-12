import { env } from 'cloudflare:workers';
import { beforeEach } from 'vitest';
import esquema from '../db/schema.sql?raw';

// Las pruebas corren contra el mismo db/schema.sql que se aplica en D1, no
// contra una copia: si el esquema cambia y rompe una consulta, se cae acá.
//
// D1 no acepta varias sentencias en un prepare(), así que se separan por ';'.
// Los comentarios se sacan antes de separar: el esquema tiene alguno con un
// punto y coma adentro, y partir por ahí dejaba sentencias cortadas al medio.
// Ninguna cadena del esquema contiene '--', así que recortar por línea basta.
const sentencias = esquema
  .split('\n')
  .map((linea) => linea.replace(/--.*$/, ''))
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

beforeEach(async () => {
  await env.DB.batch(sentencias.map((s) => env.DB.prepare(s)));

  // La base vive todo el archivo de pruebas, así que se vacía antes de cada
  // una: si no, el UNIQUE de los slugs se cae en la segunda. Se buscan las
  // tablas en vez de listarlas a mano para no olvidar ninguna nueva.
  const { results } = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
  ).all<{ name: string }>();
  await env.DB.batch(results.map((t) => env.DB.prepare(`DELETE FROM ${t.name}`)));

  // El bucket también: si no, una prueba ve las fotos que dejó la anterior y
  // deja de servir para comprobar que una subida rechazada no escribe nada.
  const { objects } = await env.FOTOS.list();
  if (objects.length) await env.FOTOS.delete(objects.map((o) => o.key));
});
