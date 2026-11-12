import { getCloudflareContext } from '@opennextjs/cloudflare';

// Acceso a los bindings de Cloudflare. Va aparte de auth.ts para que los
// módulos de datos no arrastren next/headers solo por leer la base.

export async function obtenerDB(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

export async function obtenerFotos(): Promise<R2Bucket> {
  const { env } = await getCloudflareContext({ async: true });
  return env.FOTOS;
}
