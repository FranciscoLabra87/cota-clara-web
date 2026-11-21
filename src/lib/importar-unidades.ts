import { esEstadoUnidad, type EstadoUnidad } from '@/data/properties';

// Lector de la planilla de stock de una inmobiliaria. Es puro a propósito: sin
// Next, sin D1 y sin red, así que se prueba solo y la vista previa del panel
// puede usar exactamente lo mismo que después aplica el servidor.
//
// Lo que llega es siempre lo mismo y siempre distinto: un pegado desde Excel
// (tabulado), un CSV con punto y coma, encabezados con tildes, en mayúsculas,
// con "N°" o "Depto", y números a la chilena (4.500,5). Nada de eso es error
// del usuario, así que se normaliza en vez de rechazarse.

export type FilaImportada = {
  /** Línea del archivo, para mostrar el error donde está. */
  linea: number;
  numero: string;
  /** Código de tipología tal como venía; vacío si la planilla no la trae. */
  tipologia: string;
  piso: number | null;
  orientacion: string;
  superficieUtil: number;
  superficieTotal: number;
  precioUF: number;
  descuentoPct: number;
  estacionamientos: number;
  bodegas: number;
  estado: EstadoUnidad;
};

export type ErrorFila = { linea: number; error: string };

export type Analisis = {
  filas: FilaImportada[];
  errores: ErrorFila[];
  /** Columnas reconocidas del encabezado, para que el panel diga qué leyó. */
  columnas: Campo[];
};

export const MAX_FILAS_IMPORTACION = 2000;

type Campo =
  | 'numero'
  | 'tipologia'
  | 'piso'
  | 'orientacion'
  | 'superficieUtil'
  | 'superficieTotal'
  | 'precioUF'
  | 'descuentoPct'
  | 'estacionamientos'
  | 'bodegas'
  | 'estado';

// Los nombres que de verdad llegan en las planillas. El primero de cada lista
// es el que usa la plantilla que ofrece el panel.
const ALIAS: Record<Campo, string[]> = {
  numero: ['numero', 'unidad', 'n', 'no', 'depto', 'departamento', 'casa', 'sitio'],
  tipologia: ['tipologia', 'tipo', 'modelo', 'planta'],
  piso: ['piso', 'nivel'],
  orientacion: ['orientacion', 'orient'],
  superficieUtil: ['util', 'superficie util', 'm2 util', 'm2 utiles', 'sup util', 'utiles', 'interior'],
  superficieTotal: ['total', 'superficie total', 'm2 total', 'sup total', 'm2 totales'],
  precioUF: ['precio uf', 'precio', 'uf', 'valor uf', 'valor', 'precio lista'],
  descuentoPct: ['descuento', 'dcto', 'descuento %', 'dcto %'],
  estacionamientos: ['estacionamientos', 'estacionamiento', 'estac', 'e'],
  bodegas: ['bodegas', 'bodega', 'b'],
  estado: ['estado', 'disponibilidad', 'status', 'situacion'],
};

const ESTADOS: Record<string, EstadoUnidad> = {
  disponible: 'disponible',
  disponibles: 'disponible',
  libre: 'disponible',
  d: 'disponible',
  reservada: 'reservada',
  reservado: 'reservada',
  reserva: 'reservada',
  r: 'reservada',
  vendida: 'vendida',
  vendido: 'vendida',
  venta: 'vendida',
  v: 'vendida',
  bloqueada: 'bloqueada',
  bloqueado: 'bloqueada',
  'no disponible': 'bloqueada',
  b: 'bloqueada',
};

/** Minúsculas, sin tildes, sin puntos ni símbolos de número y con un solo espacio. */
function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[°º]/g, '')
    .replace(/[.:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Número a la chilena. Con punto y coma, el punto separa miles y la coma
 * decide los decimales (4.500,5). Con solo coma, la coma es decimal (68,5).
 * Con solo punto, es miles si los grupos son de tres (4.500) y decimal si no
 * (68.5), que es como lo escribe quien exportó la planilla en inglés.
 */
export function numeroCL(valor: string): number {
  const limpio = valor.replace(/\s|UF|\$/gi, '').trim();
  if (!limpio) return Number.NaN;

  const tienePunto = limpio.includes('.');
  const tieneComa = limpio.includes(',');

  let normalizado = limpio;
  if (tienePunto && tieneComa) normalizado = limpio.replace(/\./g, '').replace(',', '.');
  else if (tieneComa) normalizado = limpio.replace(',', '.');
  else if (tienePunto && /^\d{1,3}(\.\d{3})+$/.test(limpio)) normalizado = limpio.replace(/\./g, '');

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : Number.NaN;
}

/**
 * Dormitorios y baños leídos del código de la tipología (2D/2B, 3D2B, "2D + 2B").
 * Sirve para que una planilla que solo trae el código igual deje las tipologías
 * con sus dormitorios, que es lo que filtra el listado.
 */
export function medidasDeCodigo(codigo: string): { dormitorios: number; banos: number } {
  const limpio = normalizar(codigo);
  const dormitorios = /(\d+)\s*d/.exec(limpio);
  const banos = /(\d+)\s*b/.exec(limpio);
  return {
    dormitorios: dormitorios ? Math.min(Number(dormitorios[1]), 20) : 0,
    banos: banos ? Math.min(Number(banos[1]), 20) : 0,
  };
}

/** Tabulación primero: es lo que deja un pegado desde Excel, y no choca con la coma decimal. */
function separador(encabezado: string): string {
  for (const candidato of ['\t', ';', ',']) {
    if (encabezado.includes(candidato)) return candidato;
  }
  return '\t';
}

function mapaDeColumnas(celdas: string[]): Partial<Record<Campo, number>> {
  const mapa: Partial<Record<Campo, number>> = {};
  celdas.forEach((celda, i) => {
    const nombre = normalizar(celda);
    if (!nombre) return;
    for (const [campo, alias] of Object.entries(ALIAS) as [Campo, string[]][]) {
      if (mapa[campo] !== undefined) continue;
      if (alias.includes(nombre)) {
        mapa[campo] = i;
        return;
      }
    }
  });
  return mapa;
}

export class ErrorImportacion extends Error {}

/**
 * Lee la planilla y devuelve las filas que sirven y los errores de las que no,
 * fila por fila: una celda mala no bota la carga entera, y el panel muestra
 * qué línea revisar.
 */
export function analizarUnidades(contenido: string): Analisis {
  const lineas = contenido.replace(/\r\n?/g, '\n').split('\n');
  const indiceEncabezado = lineas.findIndex((l) => l.trim() !== '');
  if (indiceEncabezado === -1) throw new ErrorImportacion('Pega la planilla con el stock');

  const sep = separador(lineas[indiceEncabezado]);
  const columnas = mapaDeColumnas(lineas[indiceEncabezado].split(sep));
  if (columnas.numero === undefined || columnas.precioUF === undefined) {
    throw new ErrorImportacion(
      'No se reconocieron las columnas. La primera fila tiene que nombrarlas, y hacen falta al menos "numero" y "precio uf".',
    );
  }

  const filas: FilaImportada[] = [];
  const errores: ErrorFila[] = [];
  const vistos = new Set<string>();

  for (let i = indiceEncabezado + 1; i < lineas.length; i += 1) {
    const linea = lineas[i];
    if (linea.trim() === '') continue;
    if (filas.length >= MAX_FILAS_IMPORTACION) {
      errores.push({ linea: i + 1, error: `La carga admite hasta ${MAX_FILAS_IMPORTACION} unidades por vez` });
      break;
    }

    const celdas = linea.split(sep);
    const celda = (campo: Campo) => {
      const indice = columnas[campo];
      return indice === undefined ? '' : (celdas[indice] ?? '').trim();
    };

    const numero = celda('numero').slice(0, 20);
    if (!numero) {
      errores.push({ linea: i + 1, error: 'Sin número de unidad' });
      continue;
    }
    if (vistos.has(numero)) {
      errores.push({ linea: i + 1, error: `La unidad ${numero} viene repetida en la planilla` });
      continue;
    }

    const precio = numeroCL(celda('precioUF'));
    if (!Number.isFinite(precio) || precio < 1) {
      errores.push({ linea: i + 1, error: `La unidad ${numero} no tiene un precio en UF válido` });
      continue;
    }

    const numeroOpcional = (campo: Campo, max: number) => {
      const bruto = celda(campo);
      if (!bruto) return 0;
      const n = numeroCL(bruto);
      return Number.isFinite(n) && n >= 0 && n <= max ? n : 0;
    };

    const pisoBruto = celda('piso');
    const piso = pisoBruto ? numeroCL(pisoBruto) : Number.NaN;

    const estadoBruto = normalizar(celda('estado'));
    const estado = ESTADOS[estadoBruto] ?? (esEstadoUnidad(estadoBruto) ? estadoBruto : 'disponible');

    vistos.add(numero);
    filas.push({
      linea: i + 1,
      numero,
      tipologia: celda('tipologia').slice(0, 20),
      piso: Number.isFinite(piso) && piso >= 0 && piso <= 300 ? Math.trunc(piso) : null,
      orientacion: celda('orientacion').slice(0, 40),
      superficieUtil: Math.round(numeroOpcional('superficieUtil', 100_000) * 100) / 100,
      superficieTotal: Math.round(numeroOpcional('superficieTotal', 100_000) * 100) / 100,
      precioUF: Math.trunc(precio),
      descuentoPct: Math.round(numeroOpcional('descuentoPct', 100) * 100) / 100,
      estacionamientos: Math.trunc(numeroOpcional('estacionamientos', 20)),
      bodegas: Math.trunc(numeroOpcional('bodegas', 20)),
      estado,
    });
  }

  if (!filas.length && !errores.length) throw new ErrorImportacion('La planilla no tiene filas con datos');

  return { filas, errores, columnas: Object.keys(columnas) as Campo[] };
}

/** La plantilla que ofrece el panel para copiar y pegar. */
export const PLANTILLA_IMPORTACION = [
  'numero\ttipologia\tpiso\torientacion\tutil\ttotal\tprecio uf\testacionamientos\tbodegas\testado',
  '302\t2D/2B\t3\tNorte\t68,5\t78\t4.520\t1\t1\tdisponible',
  '304\t2D/2B\t3\tSur\t68,5\t78\t4.480\t1\t0\treservada',
].join('\n');
