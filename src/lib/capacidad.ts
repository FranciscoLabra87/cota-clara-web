import { getCloudflareContext } from '@opennextjs/cloudflare';
import { cuotaDe, MAX_ARCHIVO } from './drive';

export type Capacidad = {
  d1: { bytes: number; limiteFree: number; archivosDrive: number; reservadoDrive: number; cuotaDrive: number } | null;
  r2: { bytes: number; objetos: number; bytesDrive: number; bytesFotos: number; completo: boolean } | null;
  github: { bytesAproximados: number } | null;
  build: { workerBytes: number | null; assetsBytes: number; assetsArchivos: number; assetMaxBytes: number; medidoEn: string } | null;
  maxArchivo: number;
};

export async function medirD1(db: D1Database, cuotaDrive: number): Promise<NonNullable<Capacidad['d1']>> {
  const resultado = await db
    .prepare(`SELECT COALESCE(SUM(tamano), 0) AS reservado, COUNT(*) AS archivos FROM drive_archivos`)
    .run<{ reservado: number; archivos: number }>();
  return {
    bytes: resultado.meta.size_after,
    limiteFree: 500_000_000,
    archivosDrive: resultado.results[0]?.archivos ?? 0,
    reservadoDrive: resultado.results[0]?.reservado ?? 0,
    cuotaDrive,
  };
}

export async function medirR2(bucket: R2Bucket): Promise<NonNullable<Capacidad['r2']>> {
  let cursor: string | undefined;
  let bytes = 0;
  let objetos = 0;
  let bytesDrive = 0;
  let bytesFotos = 0;
  let completo = false;

  // La consulta se hace solo al abrir el panel. Si el bucket creciera mucho,
  // se informa que el total es parcial en vez de bloquear la página.
  for (let pagina = 0; pagina < 20; pagina += 1) {
    const lote = await bucket.list({ limit: 1000, ...(cursor ? { cursor } : {}) });
    for (const objeto of lote.objects) {
      bytes += objeto.size;
      objetos += 1;
      if (objeto.key.startsWith('drive/')) bytesDrive += objeto.size;
      else bytesFotos += objeto.size;
    }
    if (!lote.truncated) {
      completo = true;
      break;
    }
    if (!lote.cursor) break;
    cursor = lote.cursor;
  }
  return { bytes, objetos, bytesDrive, bytesFotos, completo };
}

async function medirGitHub(): Promise<NonNullable<Capacidad['github']>> {
  const respuesta = await fetch('https://api.github.com/repos/FranciscoLabra87/cota-clara-web', {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'CotaClara-Panel' },
    cache: 'no-store',
    signal: AbortSignal.timeout(3000),
  });
  if (!respuesta.ok) throw new Error('GitHub no disponible');
  const datos = (await respuesta.json()) as { size?: unknown };
  if (typeof datos.size !== 'number' || !Number.isFinite(datos.size)) throw new Error('Tamaño de GitHub no disponible');
  return { bytesAproximados: datos.size * 1024 };
}

async function medirBuild(assets: Fetcher): Promise<NonNullable<Capacidad['build']>> {
  const respuesta = await assets.fetch('https://www.cotaclara.cl/capacidad-build.json');
  if (!respuesta.ok) throw new Error('Medición de build no disponible');
  const dato = (await respuesta.json()) as Partial<NonNullable<Capacidad['build']>>;
  if (typeof dato.assetsBytes !== 'number' || typeof dato.assetsArchivos !== 'number' || typeof dato.assetMaxBytes !== 'number' || typeof dato.medidoEn !== 'string') {
    throw new Error('Medición de build inválida');
  }
  return {
    workerBytes: typeof dato.workerBytes === 'number' ? dato.workerBytes : null,
    assetsBytes: dato.assetsBytes,
    assetsArchivos: dato.assetsArchivos,
    assetMaxBytes: dato.assetMaxBytes,
    medidoEn: dato.medidoEn,
  };
}

export async function medirCapacidad(): Promise<Capacidad> {
  const { env } = await getCloudflareContext({ async: true });
  const cuotaDrive = cuotaDe({ DRIVE_CUOTA_GB: (env as CloudflareEnv & { DRIVE_CUOTA_GB?: string }).DRIVE_CUOTA_GB });
  const [d1, r2, github, build] = await Promise.allSettled([
    medirD1(env.DB, cuotaDrive),
    medirR2(env.FOTOS),
    medirGitHub(),
    env.ASSETS ? medirBuild(env.ASSETS) : Promise.reject(new Error('Assets no disponible')),
  ]);
  return {
    d1: d1.status === 'fulfilled' ? d1.value : null,
    r2: r2.status === 'fulfilled' ? r2.value : null,
    github: github.status === 'fulfilled' ? github.value : null,
    build: build.status === 'fulfilled' ? build.value : null,
    maxArchivo: MAX_ARCHIVO,
  };
}
