'use client';

import Link from 'next/link';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CLAVE_COOKIES, esPaginaMedible, idMedicionValido, leerPreferenciasCookies, type PreferenciasCookies } from '@/lib/consentimiento';
import { borrarCookiesAnalitica, prepararMedicion, registrarContacto, registrarPagina } from '@/lib/analytics';

export function CookieConsent({ measurementId }: { measurementId?: string }) {
  const ruta = usePathname();
  const id = idMedicionValido(measurementId);
  const [preferencias, setPreferencias] = useState<PreferenciasCookies | null>(null);
  const [lista, setLista] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [scriptListo, setScriptListo] = useState(false);
  const volverA = useRef<HTMLElement | null>(null);
  const botonNecesarias = useRef<HTMLButtonElement>(null);
  const publica = esPaginaMedible(ruta);
  const permitida = lista && preferencias?.analitica === true && publica;

  useEffect(() => {
    const leer = () => {
      let valor: string | null = null;
      try { valor = localStorage.getItem(CLAVE_COOKIES); } catch { /* Se puede elegir para esta visita igualmente. */ }
      const guardadas = leerPreferenciasCookies(valor);
      setPreferencias(guardadas);
      setAbierto(!guardadas);
      setLista(true);
      if (!guardadas?.analitica) borrarCookiesAnalitica();
    };
    const abrir = () => {
      volverA.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setAbierto(true);
      requestAnimationFrame(() => botonNecesarias.current?.focus());
    };
    const sincronizar = (evento: StorageEvent) => { if (evento.key === CLAVE_COOKIES || evento.key === null) leer(); };
    leer();
    window.addEventListener('storage', sincronizar);
    window.addEventListener('cota:preferencias-cookies', abrir);
    return () => {
      window.removeEventListener('storage', sincronizar);
      window.removeEventListener('cota:preferencias-cookies', abrir);
    };
  }, []);

  useEffect(() => {
    if (id) prepararMedicion(id, permitida);
  }, [id, permitida]);

  useEffect(() => {
    if (!permitida || !scriptListo) return;
    let enviada = false;
    const enviar = (sinCanonica = false) => {
      if (enviada || location.pathname !== ruta || !document.title.trim()) return;
      const canonica = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!sinCanonica && (!canonica || new URL(canonica.href).pathname !== ruta)) return;
      enviada = true;
      registrarPagina(ruta);
      observador.disconnect();
    };
    // Next puede actualizar título y canónica después de cambiar la ruta.
    const observador = new MutationObserver(() => enviar());
    observador.observe(document.head, { childList: true, subtree: true, characterData: true });
    const frame = requestAnimationFrame(() => enviar());
    const espera = window.setTimeout(() => enviar(true), 1500);
    return () => { observador.disconnect(); cancelAnimationFrame(frame); clearTimeout(espera); };
  }, [ruta, permitida, scriptListo]);

  useEffect(() => {
    if (!permitida || !id) return;
    const medir = (evento: MouseEvent) => {
      const enlace = evento.target instanceof Element ? evento.target.closest('a[href]') : null;
      if (!(enlace instanceof HTMLAnchorElement)) return;
      if (enlace.protocol === 'tel:') registrarContacto('telefono');
      else if (enlace.protocol === 'mailto:') registrarContacto('correo');
      else if (enlace.hostname === 'wa.me') registrarContacto('whatsapp');
      else if (enlace.origin === location.origin && enlace.pathname === '/contacto') registrarContacto('formulario');
    };
    document.addEventListener('click', medir);
    return () => document.removeEventListener('click', medir);
  }, [permitida, id]);

  function elegir(analitica: boolean) {
    const nuevas: PreferenciasCookies = { version: 1, analitica, fecha: Date.now() };
    if (id) prepararMedicion(id, analitica && publica);
    if (!analitica) borrarCookiesAnalitica();
    try { localStorage.setItem(CLAVE_COOKIES, JSON.stringify(nuevas)); } catch { /* Preferencia válida durante esta visita. */ }
    setPreferencias(nuevas);
    setAbierto(false);
    volverA.current?.focus();
  }

  return (
    <>
      {id && permitida ? (
        <Script id="cota-ga4" src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" onReady={() => setScriptListo(true)} />
      ) : null}
      {lista && abierto && publica ? (
        <section className="cookie-banner" aria-labelledby="cookies-titulo">
          <div className="cookie-banner__inner">
            <div className="cookie-banner__copy">
              <h2 className="cookie-banner__title" id="cookies-titulo">Tú eliges las cookies</h2>
              <p>Usamos almacenamiento necesario para el sitio. La analítica con cookies es opcional y solo se activa si la aceptas. Puedes cambiar tu elección cuando quieras.</p>
              <p className="cookie-banner__links"><Link href="/cookies">Ver política de cookies</Link><Link href="/privacidad">Privacidad</Link></p>
            </div>
            <div className="cookie-banner__actions">
              <button ref={botonNecesarias} className="button button--outline" type="button" onClick={() => elegir(false)}>Solo necesarias</button>
              <button className="button button--primary" type="button" onClick={() => elegir(true)}>Aceptar analítica</button>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
