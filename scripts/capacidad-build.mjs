import { execFile } from 'node:child_process';
import { readdir, stat, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';

const ejecutar = promisify(execFile);
const raiz = process.cwd();
const assets = path.join(raiz, '.open-next', 'assets');

async function archivosDe(directorio) {
  const entradas = await readdir(directorio, { withFileTypes: true });
  const grupos = await Promise.all(entradas.map(async (entrada) => {
    const ruta = path.join(directorio, entrada.name);
    return entrada.isDirectory() ? archivosDe(ruta) : [ruta];
  }));
  return grupos.flat();
}

const archivos = (await archivosDe(assets)).filter((archivo) => path.basename(archivo) !== 'capacidad-build.json');
const tamanos = await Promise.all(archivos.map(async (archivo) => (await stat(archivo)).size));

let workerBytes = null;
try {
  const { stdout, stderr } = await ejecutar(process.execPath, [path.join(raiz, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), 'deploy', '--dry-run'], {
    cwd: raiz,
    timeout: 60_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const texto = `${stdout}\n${stderr}`;
  const coincide = texto.match(/Total Upload:\s*([\d.]+)\s*(B|KiB|MiB)/i);
  if (coincide) {
    const unidad = { B: 1, KiB: 1024, MiB: 1024 ** 2 }[coincide[2]];
    workerBytes = Math.round(Number(coincide[1]) * unidad);
  }
} catch {
  // La medición del paquete es informativa; no bloquea el despliegue.
}

const medicion = {
  workerBytes,
  assetsBytes: tamanos.reduce((total, tamano) => total + tamano, 0),
  assetsArchivos: archivos.length + 1,
  assetMaxBytes: Math.max(0, ...tamanos),
  medidoEn: new Date().toISOString(),
};

const salida = path.join(assets, 'capacidad-build.json');
const bytesSinMedicion = medicion.assetsBytes;
for (let intento = 0; intento < 3; intento += 1) {
  const contenido = JSON.stringify(medicion);
  const bytesMedicion = Buffer.byteLength(contenido);
  const total = bytesSinMedicion + bytesMedicion;
  const mayor = Math.max(medicion.assetMaxBytes, bytesMedicion);
  if (medicion.assetsBytes === total && medicion.assetMaxBytes === mayor) {
    await writeFile(salida, contenido);
    break;
  }
  medicion.assetsBytes = total;
  medicion.assetMaxBytes = mayor;
  if (intento === 2) await writeFile(salida, JSON.stringify(medicion));
}
console.info(`Capacidad del build: ${medicion.assetsArchivos} archivos estáticos; Worker ${workerBytes === null ? 'sin medición' : `${workerBytes} bytes`}.`);
