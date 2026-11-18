export const site = {
  nombre: 'Cota Clara',
  bajada: 'Patrimonio Inmobiliario',
  lema: 'El valor de saber.',
  concepto:
    'Cota Clara es una firma inmobiliaria que combina precisión técnica, transparencia y experiencia para proteger y potenciar tu patrimonio.',
  url: 'https://www.cotaclara.cl',
  email: 'contacto@cotaclara.cl',
  telefono: '+56 9 4001 2319',
  telefonoHref: '+56940012319',
  whatsapp: '56940012319',
  direccion: 'Av. Manquehue Norte 882, Las Condes',
  calle: 'Av. Manquehue Norte 882',
  edificio: 'Edificio Spot Residence Manquehue',
  comuna: 'Las Condes',
  horario: 'Lunes a viernes de 9:00 a 18:30 · Sábados con cita',
};

// Lo que se le pide a Google Maps: calle, número y comuna bastan para el pin.
const direccionMapa = `${site.calle}, ${site.comuna}, Santiago, Chile`;

/** Abre la oficina en Google Maps (app en el celular, web en el computador). */
export const mapaHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccionMapa)}`;

/** El mapa embebido de /contacto. Su origen va en frame-src de la CSP (next.config.ts). */
export const mapaEmbed = `https://www.google.com/maps?q=${encodeURIComponent(direccionMapa)}&z=16&output=embed`;

export const navegacion = [
  { href: '/proyectos-de-inversion', label: 'Proyectos de inversión' },
  { href: '/retail', label: 'Retail' },
  { href: '/servicios/corretaje', label: 'Vender' },
  { href: '/servicios/tasaciones', label: 'Tasaciones' },
  { href: '/servicios/asesoria', label: 'Asesoría' },
  { href: '/servicios/gestion-patrimonial', label: 'Gestión patrimonial' },
];

export const comunas = ['Providencia', 'Las Condes', 'Vitacura', 'Ñuñoa', 'La Reina', 'Lo Barnechea'];

export const whatsappHref = (texto = 'Hola, quiero hablar con Cota Clara.') =>
  `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(texto)}`;
