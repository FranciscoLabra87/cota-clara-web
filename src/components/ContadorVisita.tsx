'use client';

import { useEffect } from 'react';

// Avisa que alguien abrió la ficha. Va desde el navegador y no desde el
// servidor a propósito: Next precarga las fichas cuando sus enlaces aparecen
// en pantalla, y los buscadores sin JavaScript también las piden. Contar en
// el servidor sumaría todo eso como si fueran visitas.
//
// Una vez por ficha y por pestaña: recargar la página no suma de nuevo.
export function ContadorVisita({ slug }: { slug: string }) {
  useEffect(() => {
    const clave = `visita:${slug}`;
    try {
      if (sessionStorage.getItem(clave)) return;
      sessionStorage.setItem(clave, '1');
    } catch {
      // Sin sessionStorage (modo privado estricto) se cuenta igual.
    }
    fetch('/api/visitas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {});
  }, [slug]);

  return null;
}
