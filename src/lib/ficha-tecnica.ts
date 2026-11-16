import { obtenerDB } from './db';

// Antecedentes técnicos de una propiedad: lo que no va en el aviso público
// pero sí en la ficha técnica que se entrega a un cliente o se usa en la
// firma. Viven en su propia tabla, que solo lee el panel.

export const ESTADOS_CONSERVACION = ['Nuevo', 'Excelente', 'Bueno', 'Regular', 'Para remodelar'] as const;
export const RECEPCIONES = ['Sí', 'No', 'En trámite'] as const;
export const ESTADOS_ANTECEDENTES = ['Informados', 'Revisados documentalmente', 'Pendientes'] as const;

export type FichaTecnica = {
  /** Rol de avalúo del SII: manzana y predio, como «1234-56». */
  rolSii?: string;
  /** Destino según el SII: habitacional, oficina, comercio… */
  destino?: string;
  /** Avalúo fiscal total, en pesos. */
  avaluoFiscal?: number;
  /** Contribuciones, en pesos por cuota trimestral. */
  contribuciones?: number;
  materialidad?: string;
  estadoConservacion?: (typeof ESTADOS_CONSERVACION)[number];
  /** Número de pisos de la propiedad, o del edificio si es un departamento. */
  pisos?: number;
  calefaccion?: string;
  /** Recepción final municipal de la construcción. */
  recepcionFinal?: (typeof RECEPCIONES)[number];
  /** Inscripción en el Conservador de Bienes Raíces: fojas, número, año y conservador. */
  inscripcion?: string;
  /** Documento o persona que aportó los antecedentes. No implica verificación. */
  fuenteAntecedentes?: string;
  /** Última revisión declarada por el equipo, en fecha de Chile (YYYY-MM-DD). */
  fechaRevision?: string;
  revisadoPor?: string;
  estadoAntecedentes?: (typeof ESTADOS_ANTECEDENTES)[number];
  /** Notas de la firma. Solo salen en la versión interna de la ficha. */
  observaciones?: string;
};

export type ResultadoFicha = { ok: true; datos: FichaTecnica } | { ok: false; error: string };

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Entero opcional. `undefined` si vino algo que no sirve; `null` si vino vacío. */
function entero(v: unknown, min: number, max: number): number | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string' && typeof v !== 'number') return undefined;
  let crudo: string | number = typeof v === 'string' ? v.trim() : v;
  if (crudo === '') return null;
  if (typeof crudo === 'string') {
    // El punto solo es separador de miles si todos los grupos tienen tres
    // dígitos. Así «1.5» no se transforma silenciosamente en 15 pesos/pisos.
    if (!/^\d+$/.test(crudo) && !/^\d{1,3}(?:\.\d{3})+$/.test(crudo)) return undefined;
    crudo = crudo.replace(/\./g, '');
  }
  const n = Number(crudo);
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
}

// Los textos se rechazan si pasan del largo en vez de cortarse: una
// inscripción o una observación recortada en silencio es un dato equivocado.
const LARGOS = { destino: 60, materialidad: 80, calefaccion: 80, inscripcion: 200, fuenteAntecedentes: 300, revisadoPor: 100, observaciones: 1000 } as const;
const NOMBRES: Record<keyof typeof LARGOS, string> = {
  destino: 'El destino',
  materialidad: 'La materialidad',
  calefaccion: 'La calefacción',
  inscripcion: 'La inscripción',
  fuenteAntecedentes: 'La fuente de antecedentes',
  revisadoPor: 'El nombre de quien revisó',
  observaciones: 'Las observaciones',
};

function fechaValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

export function validarFicha(body: Record<string, unknown>): ResultadoFicha {
  const datos: FichaTecnica = {};

  // El rol se escribe de varias formas («1234-56», «01234 - 00056»): se
  // guarda sin espacios, y se exige la forma manzana-predio.
  const rol = texto(body.rolSii).replace(/\s+/g, '');
  if (rol) {
    if (!/^\d{1,5}-\d{1,5}$/.test(rol)) return { ok: false, error: 'El rol del SII va como manzana-predio, por ejemplo 1234-56' };
    datos.rolSii = rol;
  }

  for (const campo of Object.keys(LARGOS) as (keyof typeof LARGOS)[]) {
    if (body[campo] != null && typeof body[campo] !== 'string') {
      return { ok: false, error: `${NOMBRES[campo]} tiene que ser texto` };
    }
    const valor = texto(body[campo]);
    if (valor.length > LARGOS[campo]) return { ok: false, error: `${NOMBRES[campo]} no puede pasar de ${LARGOS[campo]} caracteres` };
    if (valor) datos[campo] = valor;
  }

  const fechaRevision = texto(body.fechaRevision);
  if (body.fechaRevision != null && typeof body.fechaRevision !== 'string') {
    return { ok: false, error: 'La fecha de revisión va como AAAA-MM-DD' };
  }
  if (fechaRevision) {
    if (!fechaValida(fechaRevision)) return { ok: false, error: 'La fecha de revisión tiene que ser una fecha válida como AAAA-MM-DD' };
    datos.fechaRevision = fechaRevision;
  }

  const antecedentes = texto(body.estadoAntecedentes);
  if (body.estadoAntecedentes != null && typeof body.estadoAntecedentes !== 'string') {
    return { ok: false, error: 'El estado de los antecedentes no es válido' };
  }
  if (antecedentes) {
    if (!ESTADOS_ANTECEDENTES.includes(antecedentes as NonNullable<FichaTecnica['estadoAntecedentes']>)) {
      return { ok: false, error: 'El estado de los antecedentes no es válido' };
    }
    datos.estadoAntecedentes = antecedentes as FichaTecnica['estadoAntecedentes'];
  }
  if (datos.estadoAntecedentes === 'Revisados documentalmente' && (!datos.fuenteAntecedentes || !datos.fechaRevision || !datos.revisadoPor)) {
    return { ok: false, error: 'Para marcar antecedentes revisados, indica la fuente, la fecha de revisión y quién los revisó' };
  }

  const avaluo = entero(body.avaluoFiscal, 0, 100_000_000_000);
  const contribuciones = entero(body.contribuciones, 0, 1_000_000_000);
  const pisos = entero(body.pisos, 1, 200);
  if (avaluo === undefined) return { ok: false, error: 'El avalúo fiscal tiene que ser un monto en pesos, sin decimales' };
  if (contribuciones === undefined) return { ok: false, error: 'Las contribuciones tienen que ser un monto en pesos, sin decimales' };
  if (pisos === undefined) return { ok: false, error: 'El número de pisos tiene que ser un entero entre 1 y 200' };
  if (avaluo !== null) datos.avaluoFiscal = avaluo;
  if (contribuciones !== null) datos.contribuciones = contribuciones;
  if (pisos !== null) datos.pisos = pisos;

  const estado = texto(body.estadoConservacion);
  if (estado) {
    if (!ESTADOS_CONSERVACION.includes(estado as FichaTecnica['estadoConservacion'] & string)) {
      return { ok: false, error: 'El estado de conservación no es válido' };
    }
    datos.estadoConservacion = estado as FichaTecnica['estadoConservacion'];
  }

  const recepcion = texto(body.recepcionFinal);
  if (recepcion) {
    if (!RECEPCIONES.includes(recepcion as FichaTecnica['recepcionFinal'] & string)) {
      return { ok: false, error: 'La recepción final no es válida' };
    }
    datos.recepcionFinal = recepcion as FichaTecnica['recepcionFinal'];
  }

  return { ok: true, datos };
}

/** Los antecedentes guardados, o un objeto vacío si la propiedad no tiene. */
export async function fichaDe(propiedadId: number): Promise<FichaTecnica> {
  const db = await obtenerDB();
  const fila = await db.prepare(`SELECT datos FROM propiedad_ficha WHERE propiedad_id = ?`).bind(propiedadId).first<{ datos: string }>();
  if (!fila) return {};
  try {
    const datos = JSON.parse(fila.datos);
    return datos && typeof datos === 'object' && !Array.isArray(datos) ? (datos as FichaTecnica) : {};
  } catch {
    // Esta capa es la única que escribe la columna, pero si quedara
    // malformada vale más una ficha sin antecedentes que una página caída.
    return {};
  }
}

export async function guardarFicha(propiedadId: number, datos: FichaTecnica): Promise<void> {
  const db = await obtenerDB();
  await db
    .prepare(
      `INSERT INTO propiedad_ficha (propiedad_id, datos) VALUES (?, ?)
       ON CONFLICT (propiedad_id) DO UPDATE SET datos = excluded.datos, actualizada_en = datetime('now')`,
    )
    .bind(propiedadId, JSON.stringify(datos))
    .run();
}
