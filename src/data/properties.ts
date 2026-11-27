export type Operacion = 'venta' | 'arriendo';
export type TipoPropiedad = 'departamento' | 'casa' | 'oficina';
/** nuevo = Proyectos de inversión; usado = Retail. */
export type Condicion = 'nuevo' | 'usado';

export type Precio = {
  valor: number;
  moneda: 'UF' | 'CLP';
  periodo?: 'mes';
};

export type Propiedad = {
  slug: string;
  titulo?: string;
  tipo: TipoPropiedad;
  operacion: Operacion;
  condicion: Condicion;
  comuna: string;
  sector: string;
  /** Coordenadas publicadas para ubicar el pin en el mapa. */
  latitud?: number;
  longitud?: number;
  precio: Precio;
  dormitorios: number;
  banos: number;
  estacionamientos: number;
  bodegas: number;
  superficieUtil: number;
  superficieTotal: number;
  terreno?: number;
  /** Medidas del terreno en metros. Pueden venir las dos, una o ninguna. */
  frente?: number;
  fondo?: number;
  piso?: number;
  orientacion: string;
  anio: number;
  gastosComunes?: number;
  etiquetas: string[];
  resumen: string;
  descripcion: string[];
  caracteristicas: string[];
  destacada: boolean;
  publicada: string;
  /** Semilla y tono de la ilustración de reemplazo mientras no haya fotos reales. */
  ilustracion: { seed: number; tono: 'dia' | 'atardecer' };
  /** Fotos servidas desde R2 en /fotos/. Si existen, reemplazan a las ilustraciones. */
  imagenes?: string[];
  /** MP4 público servido por slug, sin exponer su clave privada de R2. */
  video?: string;
  /** Resumen del stock, solo en los proyectos (condicion 'nuevo') que tienen unidades cargadas. */
  stock?: ResumenStock;
};

/** En qué está cada unidad de un proyecto. Solo 'disponible' y 'reservada' se muestran en el sitio. */
export type EstadoUnidad = 'disponible' | 'reservada' | 'vendida' | 'bloqueada';

export const estadosUnidad: { value: EstadoUnidad; label: string }[] = [
  { value: 'disponible', label: 'Disponible' },
  { value: 'reservada', label: 'Reservada' },
  { value: 'vendida', label: 'Vendida' },
  { value: 'bloqueada', label: 'Bloqueada' },
];

export const esEstadoUnidad = (valor: unknown): valor is EstadoUnidad =>
  typeof valor === 'string' && estadosUnidad.some((e) => e.value === valor);

export const nombreEstadoUnidad = (estado: EstadoUnidad) => estadosUnidad.find((e) => e.value === estado)?.label ?? estado;

/** El modelo de planta que se repite en varias unidades. */
export type Tipologia = {
  id: number;
  codigo: string;
  dormitorios: number;
  banos: number;
  superficieUtil: number;
  superficieTerraza: number;
  /** Plano servido desde R2, si se cargó. */
  plano?: string;
  orden: number;
};

/** Una tipología con lo que queda de ella en el proyecto. */
export type TipologiaConStock = Tipologia & { total: number; disponibles: number; desdeUF: number | null };

export type Unidad = {
  id: number;
  tipologiaId: number | null;
  numero: string;
  piso?: number;
  orientacion: string;
  superficieUtil: number;
  superficieTotal: number;
  precioUF: number;
  descuentoPct: number;
  estacionamientos: number;
  bodegas: number;
  estado: EstadoUnidad;
};

/**
 * Lo que el listado necesita saber del stock sin traerse las unidades: el
 * explorador filtra en el navegador, y los dormitorios de un proyecto son el
 * rango de sus tipologías, no el número de la propiedad.
 */
export type ResumenStock = {
  total: number;
  disponibles: number;
  /** Mínimo de las disponibles; null si no queda ninguna. */
  desdeUF: number | null;
  dormitoriosMin: number;
  dormitoriosMax: number;
  superficieMin: number;
  superficieMax: number;
};

export const tipos: { value: TipoPropiedad; label: string }[] = [
  { value: 'departamento', label: 'Departamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'oficina', label: 'Oficina' },
];

/**
 * Qué pide quien escribe desde la ficha de una propiedad. Se guarda tal cual
 * en `motivo`: el aviso, el panel y el CRM lo muestran sin traducir. Las
 * solicitudes de la ficha tienen variante `visita` por historia de la base.
 */
export const motivosFicha = ['Pedir información', 'Agendar una reunión'] as const;
export const MOTIVO_REUNION = motivosFicha[1];

/** Los dos segmentos del inventario, cada uno con su página pública. */
export const segmentos: Record<Condicion, { label: string; corto: string; href: string; lead: string }> = {
  nuevo: {
    label: 'Proyectos de inversión',
    corto: 'Nuevo',
    href: '/proyectos-de-inversion',
    lead: 'Proyectos nuevos para invertir o para vivir: departamentos y casas a estrenar.',
  },
  usado: {
    label: 'Retail',
    corto: 'Usado',
    href: '/retail',
    lead: 'Propiedades usadas en venta y arriendo.',
  },
};

export const nombreTipo =(tipo: TipoPropiedad) => tipos.find((t) => t.value === tipo)?.label ?? tipo;

export const tituloPropiedad = (p: Propiedad) => p.titulo?.trim() || `${nombreTipo(p.tipo)} · ${p.comuna}`;

export const comunasDisponibles = (propiedades: Propiedad[]) =>
  [...new Set(propiedades.map((p) => p.comuna.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es-CL'));

// El inventario vive en D1, no acá: ver src/lib/propiedades.ts. Este archivo
// quedó solo con los tipos y los helpers de presentación, que usan tanto el
// sitio público como el panel.
