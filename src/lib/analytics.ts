import { esPaginaMedible } from './consentimiento';

// Sólo recibe categorías de acciones públicas: nunca valores de formularios.
type EstadoMedicion = { id: string; permitida: boolean; configurada: boolean };
declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: (...argumentos: unknown[]) => void;
    cotaMedicion?: EstadoMedicion;
    [clave: `ga-disable-${string}`]: boolean | undefined;
  }
}

function referenteSinConsulta() {
  try {
    const url = new URL(document.referrer);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
}

function contextoPagina() {
  return {
    page_location: `${location.origin}${location.pathname}`,
    page_title: document.title,
    page_referrer: referenteSinConsulta(),
  };
}

export function prepararMedicion(id: string, permitida: boolean) {
  window[`ga-disable-${id}`] = !permitida;
  const anterior = window.cotaMedicion;
  const estado = anterior?.id === id ? anterior : { id, permitida: false, configurada: false };
  estado.permitida = permitida;
  window.cotaMedicion = estado;
  if (!permitida) {
    if (estado.configurada) window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
    return;
  }
  window.dataLayer ??= [];
  window.gtag ??= function (..._argumentos: unknown[]) { window.dataLayer?.push(arguments); };
  if (!estado.configurada) {
    window.gtag('consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    });
    window.gtag('js', new Date());
    window.gtag('config', id, {
      send_page_view: false,
      page_location: `${location.origin}${location.pathname}`,
      page_referrer: referenteSinConsulta(),
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: 180 * 24 * 60 * 60,
    });
    estado.configurada = true;
  }
  window.gtag('consent', 'update', { analytics_storage: 'granted' });
}

export function registrarPagina(ruta: string) {
  const estado = window.cotaMedicion;
  if (!estado?.permitida || !esPaginaMedible(ruta)) return;
  window.gtag?.('config', estado.id, { send_page_view: false, ...contextoPagina() });
  window.gtag?.('event', 'page_view', {
    send_to: estado.id, ...contextoPagina(),
  });
}

export function registrarSolicitudEnviada(variante: 'contacto' | 'tasacion' | 'visita') {
  if (typeof window === 'undefined' || !window.cotaMedicion?.permitida || !esPaginaMedible(location.pathname)) return;
  window.gtag?.('event', 'generate_lead', { send_to: window.cotaMedicion.id, tipo_solicitud: variante, ...contextoPagina() });
}

export function registrarContacto(canal: 'whatsapp' | 'telefono' | 'correo' | 'formulario') {
  if (!window.cotaMedicion?.permitida || !esPaginaMedible(location.pathname)) return;
  window.gtag?.('event', 'contact_click', { send_to: window.cotaMedicion.id, canal, ...contextoPagina() });
}

export function borrarCookiesAnalitica() {
  const nombres = document.cookie.split(';').map((parte) => parte.split('=')[0].trim()).filter((nombre) => /^_ga(?:_|$)/.test(nombre));
  const partes = location.hostname.split('.');
  for (const nombre of nombres) {
    document.cookie = `${nombre}=; Max-Age=0; Path=/; SameSite=Lax`;
    for (let i = 0; i < partes.length - 1; i += 1) {
      document.cookie = `${nombre}=; Max-Age=0; Path=/; Domain=${partes.slice(i).join('.')}; SameSite=Lax`;
    }
  }
}
