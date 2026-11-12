'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CerrarSesion() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/acceso');
      router.refresh();
    }
  }

  return (
    <button type="button" className="panel__nav-link panel__nav-link--salir" onClick={salir} disabled={saliendo}>
      {saliendo ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  );
}
