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

// Propiedades de ejemplo: reemplazar por el inventario real.
export const propiedades: Propiedad[] = [
  {
    slug: 'departamento-providencia-pedro-de-valdivia',
    tipo: 'departamento',
    operacion: 'venta',
    comuna: 'Providencia',
    sector: 'Sector Pedro de Valdivia',
    precio: { valor: 7890, moneda: 'UF' },
    dormitorios: 3,
    banos: 2,
    estacionamientos: 1,
    bodegas: 1,
    superficieUtil: 96,
    superficieTotal: 104,
    piso: 8,
    orientacion: 'Nororiente',
    anio: 2016,
    gastosComunes: 185000,
    etiquetas: ['Con informe de valor'],
    resumen: 'Luminoso, con terraza y vista despejada a la cordillera, a pasos del metro Pedro de Valdivia.',
    descripcion: [
      'Departamento de planta eficiente en edificio de 2016, con living-comedor integrado a una terraza de 8 m² y vista despejada hacia la cordillera.',
      'La propiedad cuenta con un informe de valor completo: comparables del sector, rango de precio y estrategia de venta, disponibles para compradores interesados.',
    ],
    caracteristicas: ['Terraza de 8 m²', 'Cocina equipada', 'Logia independiente', 'Calefacción central', 'Conserjería 24 h', 'Piscina y gimnasio', 'Bodega incluida', 'A 4 cuadras del metro'],
    destacada: true,
    publicada: '2026-11-03',
    ilustracion: { seed: 3, tono: 'dia' },
  },
  {
    slug: 'departamento-nunoa-plaza-nunoa',
    tipo: 'departamento',
    operacion: 'venta',
    comuna: 'Ñuñoa',
    sector: 'Sector Plaza Ñuñoa',
    precio: { valor: 6450, moneda: 'UF' },
    dormitorios: 2,
    banos: 2,
    estacionamientos: 1,
    bodegas: 1,
    superficieUtil: 78,
    superficieTotal: 85,
    piso: 5,
    orientacion: 'Oriente',
    anio: 2019,
    gastosComunes: 140000,
    etiquetas: ['Precio revisado'],
    resumen: 'Dos dormitorios en suite, cerca de Plaza Ñuñoa, parques y la futura línea 7 del metro.',
    descripcion: [
      'Departamento moderno con dos dormitorios en suite, ideal para pareja o inversión. Living con salida a balcón y cocina americana con isla.',
      'Ubicado a pasos de Plaza Ñuñoa, con comercio, restaurantes y áreas verdes en un radio de 10 minutos a pie.',
    ],
    caracteristicas: ['Dos dormitorios en suite', 'Cocina con isla', 'Balcón', 'Quincho y sala multiuso', 'Bicicletero', 'Lavandería en el edificio'],
    destacada: true,
    publicada: '2026-10-28',
    ilustracion: { seed: 7, tono: 'atardecer' },
  },
  {
    slug: 'departamento-las-condes-el-golf',
    tipo: 'departamento',
    operacion: 'venta',
    comuna: 'Las Condes',
    sector: 'Sector El Golf',
    precio: { valor: 15900, moneda: 'UF' },
    dormitorios: 3,
    banos: 3,
    estacionamientos: 2,
    bodegas: 1,
    superficieUtil: 148,
    superficieTotal: 166,
    piso: 12,
    orientacion: 'Norte',
    anio: 2014,
    gastosComunes: 320000,
    etiquetas: ['Con informe de valor'],
    resumen: 'Piso alto con orientación norte, terraza amplia y dos estacionamientos en el corazón de El Golf.',
    descripcion: [
      'Departamento de 148 m² útiles en piso 12, con orientación norte y terraza de 18 m². Dormitorio principal con walk-in closet y baño en suite.',
      'Edificio con conserjería, piscina temperada y salas de reuniones, a pasos de Isidora Goyenechea y del metro El Golf.',
    ],
    caracteristicas: ['Terraza de 18 m²', 'Walk-in closet', 'Piscina temperada', 'Gimnasio', 'Salas de reuniones', 'Dos estacionamientos', 'Calefacción por losa radiante'],
    destacada: true,
    publicada: '2026-10-21',
    ilustracion: { seed: 11, tono: 'dia' },
  },
  {
    slug: 'casa-la-reina-principe-de-gales',
    tipo: 'casa',
    operacion: 'venta',
    comuna: 'La Reina',
    sector: 'Sector Príncipe de Gales',
    precio: { valor: 21500, moneda: 'UF' },
    dormitorios: 5,
    banos: 4,
    estacionamientos: 3,
    bodegas: 1,
    superficieUtil: 240,
    superficieTotal: 260,
    terreno: 720,
    orientacion: 'Norte',
    anio: 2008,
    etiquetas: ['Jardín consolidado'],
    resumen: 'Casa familiar de dos pisos con jardín consolidado, piscina y vista a la precordillera.',
    descripcion: [
      'Casa de dos pisos en terreno de 720 m², con living y comedor independientes, escritorio y sala de estar familiar en el segundo nivel.',
      'Jardín consolidado con árboles nativos, piscina y quincho techado. Barrio residencial tranquilo, cerca de colegios y de Avenida Príncipe de Gales.',
    ],
    caracteristicas: ['Terreno de 720 m²', 'Piscina', 'Quincho techado', 'Escritorio', 'Pieza y baño de servicio', 'Riego automático', 'Paneles solares'],
    destacada: true,
    publicada: '2026-10-14',
    ilustracion: { seed: 5, tono: 'dia' },
  },
  {
    slug: 'departamento-vitacura-arriendo',
    tipo: 'departamento',
    operacion: 'arriendo',
    comuna: 'Vitacura',
    sector: 'Sector Alonso de Córdova',
    precio: { valor: 1650000, moneda: 'CLP', periodo: 'mes' },
    dormitorios: 3,
    banos: 3,
    estacionamientos: 2,
    bodegas: 1,
    superficieUtil: 132,
    superficieTotal: 150,
    piso: 6,
    orientacion: 'Nororiente',
    anio: 2017,
    gastosComunes: 290000,
    etiquetas: ['Disponible de inmediato'],
    resumen: 'Departamento amplio y silencioso, a pasos de Alonso de Córdova y del Parque Bicentenario.',
    descripcion: [
      'Departamento de 132 m² útiles con living amplio, terraza techada y cocina cerrada con comedor de diario.',
      'Edificio de baja densidad a pasos de Alonso de Córdova, con fácil acceso a Costanera Norte y al Parque Bicentenario.',
    ],
    caracteristicas: ['Terraza techada', 'Comedor de diario', 'Edificio de baja densidad', 'Piscina', 'Dos estacionamientos', 'Acepta mascotas'],
    destacada: true,
    publicada: '2026-11-06',
    ilustracion: { seed: 9, tono: 'atardecer' },
  },
  {
    slug: 'departamento-providencia-manuel-montt-arriendo',
    tipo: 'departamento',
    operacion: 'arriendo',
    comuna: 'Providencia',
    sector: 'Sector Manuel Montt',
    precio: { valor: 890000, moneda: 'CLP', periodo: 'mes' },
    dormitorios: 2,
    banos: 2,
    estacionamientos: 1,
    bodegas: 0,
    superficieUtil: 64,
    superficieTotal: 70,
    piso: 10,
    orientacion: 'Poniente',
    anio: 2020,
    gastosComunes: 115000,
    etiquetas: ['Cerca del metro'],
    resumen: 'Dos dormitorios a dos cuadras del metro Manuel Montt, con balcón y estacionamiento.',
    descripcion: [
      'Departamento de dos dormitorios y dos baños, con living iluminado y balcón. Cocina equipada con encimera vitrocerámica.',
      'A dos cuadras del metro Manuel Montt, con supermercados, cafés y servicios a la mano.',
    ],
    caracteristicas: ['Balcón', 'Cocina equipada', 'Estacionamiento', 'Gimnasio', 'Cowork en el edificio', 'Bicicletero'],
    destacada: true,
    publicada: '2026-11-08',
    ilustracion: { seed: 13, tono: 'dia' },
  },
  {
    slug: 'oficina-las-condes-isidora-goyenechea',
    tipo: 'oficina',
    operacion: 'arriendo',
    comuna: 'Las Condes',
    sector: 'Sector Isidora Goyenechea',
    precio: { valor: 62, moneda: 'UF', periodo: 'mes' },
    dormitorios: 0,
    banos: 2,
    estacionamientos: 2,
    bodegas: 1,
    superficieUtil: 85,
    superficieTotal: 92,
    piso: 14,
    orientacion: 'Norte',
    anio: 2012,
    gastosComunes: 210000,
    etiquetas: ['Habilitada'],
    resumen: 'Oficina habilitada en piso 14, con sala de reuniones, dos baños y dos estacionamientos.',
    descripcion: [
      'Oficina habilitada de 85 m² útiles con planta libre, sala de reuniones vidriada, kitchenette y dos baños.',
      'Edificio corporativo con control de acceso, a pasos de Isidora Goyenechea y del metro Tobalaba.',
    ],
    caracteristicas: ['Planta libre habilitada', 'Sala de reuniones', 'Kitchenette', 'Aire acondicionado', 'Control de acceso', 'Dos estacionamientos'],
    destacada: false,
    publicada: '2026-10-30',
    ilustracion: { seed: 17, tono: 'dia' },
  },
  {
    slug: 'casa-lo-barnechea-la-dehesa',
    tipo: 'casa',
    operacion: 'venta',
    comuna: 'Lo Barnechea',
    sector: 'Sector La Dehesa',
    precio: { valor: 28900, moneda: 'UF' },
    dormitorios: 5,
    banos: 5,
    estacionamientos: 4,
    bodegas: 2,
    superficieUtil: 320,
    superficieTotal: 345,
    terreno: 1200,
    orientacion: 'Nororiente',
    anio: 2015,
    etiquetas: ['Vista a la cordillera'],
    resumen: 'Casa contemporánea con vista a la cordillera, piscina y terreno de 1.200 m² en condominio.',
    descripcion: [
      'Casa contemporánea de 320 m² en condominio con seguridad, con grandes ventanales hacia el jardín y vista a la cordillera.',
      'Primer piso con living, comedor y cocina integrados; segundo piso con cinco dormitorios, cuatro de ellos en suite.',
    ],
    caracteristicas: ['Terreno de 1.200 m²', 'Condominio con seguridad', 'Piscina', 'Sala de juegos', 'Bodegas', 'Calefacción por losa radiante'],
    destacada: false,
    publicada: '2026-10-09',
    ilustracion: { seed: 21, tono: 'atardecer' },
  },
];

export const propiedadesDestacadas = propiedades.filter((p) => p.destacada);

export const buscarPropiedad = (slug: string) => propiedades.find((p) => p.slug === slug);
