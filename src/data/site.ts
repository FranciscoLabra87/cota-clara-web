export const site = {
  nombre: 'Cota Clara',
  bajada: 'Patrimonio Inmobiliario',
  lema: 'El valor de saber.',
  concepto:
    'Cota Clara es una firma inmobiliaria que combina precisión técnica, transparencia y experiencia para proteger y potenciar tu patrimonio.',
  url: 'https://www.cotaclara.cl',
  email: 'contacto@cotaclara.cl',
  telefono: '+56 9 9876 5432',
  telefonoHref: '+56998765432',
  whatsapp: '56998765432',
  direccion: 'Providencia, Santiago de Chile',
  horario: 'Lunes a viernes de 9:00 a 18:30 · Sábados con cita',
};

export const navegacion = [
  { href: '/propiedades', label: 'Propiedades' },
  { href: '/servicios/corretaje', label: 'Vender' },
  { href: '/servicios/tasaciones', label: 'Tasaciones' },
  { href: '/servicios/asesoria', label: 'Asesoría' },
  { href: '/servicios/gestion-patrimonial', label: 'Gestión patrimonial' },
];

export const comunas = ['Providencia', 'Las Condes', 'Vitacura', 'Ñuñoa', 'La Reina', 'Lo Barnechea'];

export const whatsappHref = (texto = 'Hola, quiero hablar con Cota Clara.') =>
  `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(texto)}`;
