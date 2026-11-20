import { nombreTipo, tituloPropiedad, type Propiedad, type TipoPropiedad } from '@/data/properties';
import { formatMetros, formatNumero, formatPrecio } from './format';

/**
 * Qué muestra una ficha comercial y en qué orden. Vive aparte del dibujo del PDF
 * porque la vista previa del panel, que corre en el navegador, necesita lo mismo:
 * sin imports de Next, de Cloudflare ni de la base.
 */

export const MAX_TITULO_FICHA = 110;
export const MAX_BAJADA_FICHA = 320;
export const MAX_DESTACADOS_FICHA = 6;

/** Supuestos del dividendo referencial, los mismos del simulador público. */
export const CREDITO_REFERENCIAL = { pie: 20, plazo: 25, tasa: 4.1 };

export type AjustesFichaComercial = {
  /** Titular propio de la ficha. Vacío = el título del aviso. */
  titulo: string;
  /** Bajada propia de la ficha. Vacío = el resumen del aviso. */
  bajada: string;
  /** Posiciones de `candidatosDestacados`, en el orden elegido. Vacío = las primeras. */
  destacados: number[];
  /** Incluir la página de ubicación. Sin coordenadas no hay mapa. */
  mapa: boolean;
};

export type Metrica = { valor: string; etiqueta: string };
export type Dato = [etiqueta: string, valor: string];

export type PerfilFicha = {
  encabezado: string;
  segmento: string | null;
  titulo: string;
  bajada: string;
  pilares: Metrica[];
  destacados: string[];
  datos: Dato[];
  precios: Dato[];
  notaPrecio: string;
  cierre: { titulo: string; texto: string };
  ubicacion: string;
};

export const ajustesVacios: AjustesFichaComercial = { titulo: '', bajada: '', destacados: [], mapa: true };

const numero = (valor: number) => formatNumero(valor, Number.isInteger(valor) ? 0 : 2);
const m2 = (valor: number) => `${numero(valor)} m²`;
const metros = (valor: number) => formatMetros(valor);
const plural = (cantidad: number, singular: string, muchos = `${singular}s`) =>
  `${cantidad} ${cantidad === 1 ? singular : muchos}`;

type Clave =
  | 'dormitorios' | 'banos' | 'util' | 'total' | 'terreno' | 'medidas'
  | 'piso' | 'orientacion' | 'anio' | 'estacionamientos' | 'bodegas' | 'gastos';

type Campo = { pilar?: Metrica; dato?: Dato };

/** Un solo lugar donde cada dato se escribe, para que el pilar y la fila no se contradigan. */
function campos(p: Propiedad): Partial<Record<Clave, Campo>> {
  const mapa: Partial<Record<Clave, Campo>> = {};
  if (p.dormitorios > 0) {
    mapa.dormitorios = {
      pilar: { valor: String(p.dormitorios), etiqueta: p.dormitorios === 1 ? 'dormitorio' : 'dormitorios' },
      dato: ['Dormitorios', String(p.dormitorios)],
    };
  }
  if (p.banos > 0) {
    mapa.banos = {
      pilar: { valor: String(p.banos), etiqueta: p.banos === 1 ? 'baño' : 'baños' },
      dato: ['Baños', String(p.banos)],
    };
  }
  if (p.superficieUtil > 0) {
    mapa.util = {
      pilar: { valor: m2(p.superficieUtil), etiqueta: p.tipo === 'casa' ? 'construidos' : 'útiles' },
      dato: [p.tipo === 'casa' ? 'Superficie construida' : 'Superficie útil', m2(p.superficieUtil)],
    };
  }
  if (p.superficieTotal > 0 && p.superficieTotal !== p.superficieUtil) {
    mapa.total = {
      pilar: { valor: m2(p.superficieTotal), etiqueta: 'superficie total' },
      dato: ['Superficie total', m2(p.superficieTotal)],
    };
  }
  if (p.terreno && p.terreno > 0) {
    mapa.terreno = {
      pilar: { valor: m2(p.terreno), etiqueta: 'de terreno' },
      dato: ['Terreno', m2(p.terreno)],
    };
  }
  if ((p.frente && p.frente > 0) || (p.fondo && p.fondo > 0)) {
    const medida = p.frente && p.fondo
      ? `${metros(p.frente)} de frente × ${metros(p.fondo)} de fondo`
      : p.frente ? `${metros(p.frente)} de frente` : `${metros(p.fondo!)} de fondo`;
    mapa.medidas = { dato: ['Medidas del terreno', medida] };
  }
  if (p.piso != null && p.piso >= 0) {
    mapa.piso = { pilar: { valor: String(p.piso), etiqueta: 'piso' }, dato: ['Piso', String(p.piso)] };
  }
  if (p.orientacion.trim()) mapa.orientacion = { dato: ['Orientación', p.orientacion.trim()] };
  if (p.anio > 0) {
    mapa.anio = { pilar: { valor: String(p.anio), etiqueta: 'año de construcción' }, dato: ['Año de construcción', String(p.anio)] };
  }
  if (p.estacionamientos > 0) {
    mapa.estacionamientos = {
      pilar: { valor: String(p.estacionamientos), etiqueta: p.estacionamientos === 1 ? 'estacionamiento' : 'estacionamientos' },
      dato: ['Estacionamientos', String(p.estacionamientos)],
    };
  }
  if (p.bodegas > 0) {
    mapa.bodegas = {
      pilar: { valor: String(p.bodegas), etiqueta: p.bodegas === 1 ? 'bodega' : 'bodegas' },
      dato: ['Bodegas', String(p.bodegas)],
    };
  }
  if (p.gastosComunes != null && p.gastosComunes >= 0) {
    mapa.gastos = { dato: ['Gastos comunes', `${formatPrecio({ valor: p.gastosComunes, moneda: 'CLP' })} / mes`] };
  }
  return mapa;
}

/** Qué pone adelante cada tipo de propiedad: una casa se vende por su terreno, una oficina por sus m². */
const ordenPilares: Record<TipoPropiedad, Clave[]> = {
  casa: ['dormitorios', 'banos', 'util', 'terreno', 'total', 'estacionamientos', 'anio'],
  departamento: ['dormitorios', 'banos', 'util', 'total', 'estacionamientos', 'piso', 'bodegas'],
  oficina: ['util', 'total', 'banos', 'estacionamientos', 'piso', 'bodegas'],
};

const ordenDatos: Record<TipoPropiedad, Clave[]> = {
  casa: ['util', 'total', 'terreno', 'medidas', 'dormitorios', 'banos', 'estacionamientos', 'bodegas', 'anio', 'orientacion', 'piso', 'gastos'],
  departamento: ['util', 'total', 'dormitorios', 'banos', 'piso', 'orientacion', 'estacionamientos', 'bodegas', 'anio', 'gastos', 'terreno', 'medidas'],
  oficina: ['util', 'total', 'piso', 'orientacion', 'banos', 'estacionamientos', 'bodegas', 'anio', 'gastos', 'terreno', 'medidas', 'dormitorios'],
};

/** Lo que se puede marcar como destacado: equipamiento contable primero, después el texto del aviso. */
export function candidatosDestacados(p: Propiedad): string[] {
  const base = [
    ...(p.estacionamientos > 0 ? [plural(p.estacionamientos, 'estacionamiento')] : []),
    ...(p.bodegas > 0 ? [plural(p.bodegas, 'bodega')] : []),
    ...p.caracteristicas,
    ...p.etiquetas,
  ].map((item) => item.trim()).filter(Boolean);
  const vistos = new Set<string>();
  return base.filter((item) => {
    const llave = item.toLocaleLowerCase('es-CL');
    if (vistos.has(llave)) return false;
    vistos.add(llave);
    return true;
  });
}

function precioPorMetro(p: Propiedad): string | null {
  const base = p.superficieUtil > 0 ? p.superficieUtil : p.superficieTotal;
  if (base <= 0 || p.precio.valor <= 0) return null;
  const valor = p.precio.valor / base;
  return p.precio.moneda === 'UF' ? `UF ${formatNumero(valor, 1)} / m²` : `$${formatNumero(valor)} / m²`;
}

/** Dividendo del crédito con los supuestos de `CREDITO_REFERENCIAL`, en la moneda del precio. */
export function dividendoReferencial(p: Propiedad): string | null {
  if (p.operacion !== 'venta' || p.precio.valor <= 0) return null;
  const { pie, plazo, tasa } = CREDITO_REFERENCIAL;
  const credito = p.precio.valor * (1 - pie / 100);
  const mensual = tasa / 100 / 12;
  const cuotas = plazo * 12;
  const dividendo = credito * mensual / (1 - Math.pow(1 + mensual, -cuotas));
  if (!Number.isFinite(dividendo) || dividendo <= 0) return null;
  return p.precio.moneda === 'UF'
    ? `UF ${formatNumero(dividendo, 1)} / mes`
    : `${formatPrecio({ valor: Math.round(dividendo), moneda: 'CLP' })} / mes`;
}

function bandaPrecios(p: Propiedad): { precios: Dato[]; nota: string } {
  const valor = p.precio.valor > 0
    ? `${formatPrecio(p.precio)}${p.precio.periodo === 'mes' ? ' / mes' : ''}`
    : 'Valor a consultar';
  if (p.operacion === 'arriendo') {
    const precios: Dato[] = [['ARRIENDO MENSUAL', valor]];
    if (p.gastosComunes != null && p.gastosComunes >= 0) {
      precios.push(['GASTOS COMUNES / MES', formatPrecio({ valor: p.gastosComunes, moneda: 'CLP' })]);
      if (p.precio.valor > 0 && p.precio.moneda === 'CLP') {
        precios.push(['TOTAL MENSUAL REFERENCIAL', formatPrecio({ valor: p.precio.valor + p.gastosComunes, moneda: 'CLP' })]);
      }
    }
    return {
      precios,
      nota: precios.length === 3
        ? 'Total mensual referencial. No incluye consumos, garantía ni otros cargos; valor y disponibilidad sujetos a confirmación.'
        : 'Valor, gastos comunes y requisitos de arriendo sujetos a confirmación.',
    };
  }
  const precios: Dato[] = [['VENTA', valor]];
  const porMetro = precioPorMetro(p);
  const dividendo = dividendoReferencial(p);
  if (porMetro) precios.push(['VALOR POR M²', porMetro]);
  if (dividendo && precios.length < 3) precios.push(['DIVIDENDO REFERENCIAL', dividendo]);
  const notaCredito = dividendo && precios.length === 3
    ? ` Dividendo referencial con pie ${CREDITO_REFERENCIAL.pie}%, ${CREDITO_REFERENCIAL.plazo} años y tasa ${formatNumero(CREDITO_REFERENCIAL.tasa, 1)}% anual; no es una oferta de crédito.`
    : '';
  const base = p.condicion === 'nuevo'
    ? 'Proyecto en venta: valores, unidades disponibles y plazos de entrega sujetos a confirmación.'
    : 'Valor y disponibilidad sujetos a confirmación al coordinar una visita.';
  return { precios, nota: `${base}${notaCredito}` };
}

function cierreFicha(p: Propiedad): { titulo: string; texto: string } {
  if (p.condicion === 'nuevo') {
    return { titulo: 'Conoce el proyecto y sus unidades.', texto: 'Pide el detalle de disponibilidad y formas de pago.' };
  }
  if (p.operacion === 'arriendo') {
    return { titulo: 'Agenda una visita.', texto: 'Te enviamos los requisitos de arriendo y coordinamos el horario.' };
  }
  return { titulo: 'Conoce más y coordina una visita.', texto: 'Te acompañamos en la visita, la oferta y el cierre.' };
}

/** La ficha de esta propiedad: qué secciones tiene, con qué datos y en qué orden. */
export function perfilFicha(p: Propiedad, ajustes: AjustesFichaComercial = ajustesVacios): PerfilFicha {
  const disponibles = campos(p);
  const usados = new Set<Clave>();
  const pilares: Metrica[] = [];
  for (const clave of ordenPilares[p.tipo]) {
    if (pilares.length >= 4) break;
    const pilar = disponibles[clave]?.pilar;
    if (!pilar) continue;
    pilares.push(pilar);
    usados.add(clave);
  }
  const datos = ordenDatos[p.tipo]
    .filter((clave) => !usados.has(clave))
    .map((clave) => disponibles[clave]?.dato)
    .filter((dato): dato is Dato => !!dato);
  const candidatos = candidatosDestacados(p);
  // Sin elección a mano no se repite en los destacados lo que ya es un pilar:
  // «1 estacionamiento» arriba y abajo en la misma portada se ve a desgano.
  const elegidos = ajustes.destacados.length
    ? ajustes.destacados.map((indice) => candidatos[indice]).filter(Boolean)
    : candidatos.filter((candidato) => !pilares.some(({ valor, etiqueta }) =>
        candidato.toLocaleLowerCase('es-CL') === `${valor} ${etiqueta}`.toLocaleLowerCase('es-CL')));
  const ubicacion = [p.sector, p.comuna].map((parte) => parte.trim()).filter(Boolean).join(', ');
  const { precios, nota } = bandaPrecios(p);
  return {
    encabezado: [
      p.operacion === 'venta' ? 'Venta' : 'Arriendo',
      nombreTipo(p.tipo),
      ubicacion,
    ].filter(Boolean).join('  /  '),
    segmento: p.condicion === 'nuevo' ? 'Proyecto de inversión · propiedad nueva' : null,
    titulo: ajustes.titulo.trim() || tituloPropiedad(p),
    bajada: ajustes.bajada.trim() || p.resumen.trim(),
    pilares,
    destacados: elegidos.slice(0, MAX_DESTACADOS_FICHA),
    datos,
    precios,
    notaPrecio: nota,
    cierre: cierreFicha(p),
    ubicacion,
  };
}

export type BloqueDescripcion =
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'item'; texto: string }
  | { tipo: 'dato'; etiqueta: string; valor: string };

/**
 * Los avisos importados traen la descripción como un solo párrafo con saltos de
 * línea («Dormitorios: 3 amplios dormitorios»). Esto los separa en bloques para
 * que la ficha no muestre un muro de texto, sin reescribir nada del original.
 */
export function bloquesDescripcion(p: Propiedad, bajada = ''): BloqueDescripcion[] {
  const bloques: BloqueDescripcion[] = [];
  let enSeccion = false;
  for (const parrafo of p.descripcion) {
    for (const cruda of parrafo.split('\n')) {
      const linea = cruda.trim();
      if (!linea) { enSeccion = false; continue; }
      const vineta = linea.match(/^[-•*·+]\s+(.+)$/);
      if (vineta) { bloques.push({ tipo: 'item', texto: vineta[1].trim() }); continue; }
      const subtitulo = linea.match(/^(.{2,44}):$/);
      if (subtitulo) { bloques.push({ tipo: 'subtitulo', texto: subtitulo[1].trim() }); enSeccion = true; continue; }
      const dato = linea.match(/^([^:]{2,44}):\s+(.+)$/);
      if (dato) { bloques.push({ tipo: 'dato', etiqueta: dato[1].trim(), valor: dato[2].trim() }); continue; }
      if (enSeccion && linea.length <= 90) { bloques.push({ tipo: 'item', texto: linea }); continue; }
      bloques.push({ tipo: 'parrafo', texto: linea });
      enSeccion = false;
    }
  }
  // Los avisos importados repiten el resumen como primera línea de la
  // descripción; en la ficha ya está arriba, como bajada.
  const comparable = (valor: string) => valor.replace(/\s+/g, ' ').trim().toLocaleLowerCase('es-CL');
  const primero = bloques[0];
  if (bajada.trim() && primero?.tipo === 'parrafo' && comparable(primero.texto) === comparable(bajada)) bloques.shift();
  return bloques;
}

export type AvisoFicha = { nivel: 'alerta' | 'dato'; texto: string };

/** Superficies que el texto del aviso nombra, para cruzarlas con las registradas. */
function superficiesCitadas(p: Propiedad): number[] {
  const texto = [p.resumen, ...p.descripcion].join(' ');
  const encontradas: number[] = [];
  for (const coincidencia of texto.matchAll(/(\d{1,5}(?:\.\d{3})*(?:,\d{1,2})?)\s*(?:m²|m2|mts2|metros cuadrados)/gi)) {
    const valor = Number(coincidencia[1].replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(valor) && valor > 0) encontradas.push(valor);
  }
  return encontradas;
}

/**
 * Lo que conviene revisar antes de compartir la ficha. Se muestra en el panel,
 * nunca en el PDF: es una ayuda para el equipo, no contenido del cliente.
 */
export function avisosFicha(p: Propiedad): AvisoFicha[] {
  const avisos: AvisoFicha[] = [];
  const registradas = [p.superficieUtil, p.superficieTotal, p.terreno ?? 0].filter((valor) => valor > 0);
  for (const citada of superficiesCitadas(p)) {
    const cercana = registradas
      .map((valor) => ({ valor, diferencia: Math.abs(valor - citada) }))
      .filter(({ valor, diferencia }) => diferencia / valor <= 0.1)
      .sort((a, b) => a.diferencia - b.diferencia)[0];
    if (cercana && cercana.diferencia > 0.05) {
      avisos.push({
        nivel: 'alerta',
        texto: `El texto del aviso menciona ${numero(citada)} m² y el dato registrado dice ${numero(cercana.valor)} m². Revisa cuál corresponde antes de compartir la ficha.`,
      });
      break;
    }
  }
  if (p.precio.valor <= 0) {
    avisos.push({ nivel: 'alerta', texto: 'La propiedad no tiene precio: la ficha dirá «Valor a consultar».' });
  }
  if (p.latitud == null || p.longitud == null) {
    avisos.push({ nivel: 'alerta', texto: 'Sin latitud ni longitud: la ficha sale sin mapa. Agrégalas en el aviso para incluir la ubicación.' });
  }
  const fotos = p.imagenes?.length ?? 0;
  if (fotos === 0) avisos.push({ nivel: 'alerta', texto: 'La propiedad no tiene fotos. La portada saldrá sin imágenes.' });
  else if (fotos < 3) avisos.push({ nivel: 'dato', texto: `Solo hay ${plural(fotos, 'foto')}: la portada se ve mejor con tres o más.` });
  if (!p.resumen.trim()) avisos.push({ nivel: 'dato', texto: 'Sin resumen en el aviso: escribe una bajada propia para la ficha.' });
  if (!p.descripcion.filter((parrafo) => parrafo.trim()).length) {
    avisos.push({ nivel: 'dato', texto: 'Sin descripción: la ficha quedará solo con datos y fotos.' });
  }
  if (!candidatosDestacados(p).length) {
    avisos.push({ nivel: 'dato', texto: 'Sin características ni etiquetas: no hay destacados para la portada.' });
  }
  if (p.operacion === 'arriendo' && p.gastosComunes == null) {
    avisos.push({ nivel: 'dato', texto: 'Arriendo sin gastos comunes informados: la ficha no podrá mostrar el total mensual.' });
  }
  const faltantes = [
    p.superficieUtil <= 0 && p.superficieTotal <= 0 ? 'superficie' : '',
    p.tipo === 'casa' && !(p.terreno && p.terreno > 0) ? 'terreno' : '',
    p.anio <= 0 ? 'año de construcción' : '',
    !p.orientacion.trim() ? 'orientación' : '',
  ].filter(Boolean);
  if (faltantes.length) {
    avisos.push({ nivel: 'dato', texto: `Datos sin informar en el aviso: ${faltantes.join(', ')}.` });
  }
  return avisos;
}

/** Valida lo que llega del panel. Nada se guarda: los ajustes viven solo en esa descarga. */
export function normalizarAjustesFicha(valor: unknown, p: Propiedad): AjustesFichaComercial {
  const bruto = (valor ?? {}) as Record<string, unknown>;
  const texto = (campo: unknown, limite: number, nombre: string) => {
    if (campo == null) return '';
    if (typeof campo !== 'string') throw new Error(`${nombre} no es un texto válido.`);
    const limpio = campo.replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (limpio.length > limite) throw new Error(`${nombre} supera los ${limite} caracteres.`);
    return limpio;
  };
  const titulo = texto(bruto.titulo, MAX_TITULO_FICHA, 'El titular de la ficha');
  const bajada = texto(bruto.bajada, MAX_BAJADA_FICHA, 'La bajada de la ficha');
  let destacados: number[] = [];
  if (bruto.destacados != null) {
    const total = candidatosDestacados(p).length;
    if (!Array.isArray(bruto.destacados)) throw new Error('Los destacados no son una lista válida.');
    destacados = bruto.destacados.map(Number);
    if (destacados.length > MAX_DESTACADOS_FICHA || new Set(destacados).size !== destacados.length ||
        destacados.some((indice) => !Number.isSafeInteger(indice) || indice < 0 || indice >= total)) {
      throw new Error(`Elige hasta ${MAX_DESTACADOS_FICHA} destacados distintos de esta propiedad.`);
    }
  }
  const mapa = bruto.mapa == null ? true : bruto.mapa === true;
  return { titulo, bajada, destacados, mapa };
}
