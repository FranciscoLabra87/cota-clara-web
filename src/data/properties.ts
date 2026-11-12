export type Operacion = 'venta' | 'arriendo';
export type TipoPropiedad = 'departamento' | 'casa' | 'oficina';

export type Precio = {
  valor: number;
  moneda: 'UF' | 'CLP';
  periodo?: 'mes';
};

export type Propiedad = {
  slug: string;
  tipo: TipoPropiedad;
  operacion: Operacion;
  comuna: string;
  sector: string;
  precio: Precio;
  dormitorios: number;
  banos: number;
  estacionamientos: number;
  bodegas: number;
  superficieUtil: number;
  superficieTotal: number;
  terreno?: number;
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
  /** Rutas a fotos reales en /public. Si existen, reemplazan a las ilustraciones. */
  imagenes?: string[];
};

export const tipos: { value: TipoPropiedad; label: string }[] = [
  { value: 'departamento', label: 'Departamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'oficina', label: 'Oficina' },
];

export const nombreTipo = (tipo: TipoPropiedad) => tipos.find((t) => t.value === tipo)?.label ?? tipo;

export const tituloPropiedad = (p: Propiedad) => `${nombreTipo(p.tipo)} · ${p.comuna}`;

// El inventario vive en D1, no acá: ver src/lib/propiedades.ts. Este archivo
// quedó solo con los tipos y los helpers de presentación, que usan tanto el
// sitio público como el panel.
