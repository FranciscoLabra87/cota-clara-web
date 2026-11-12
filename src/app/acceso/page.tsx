import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AccesoForm } from '@/components/AccesoForm';
import { Logo } from '@/components/Logo';
import { sesionActual } from '@/lib/auth';
import { siteKeyTurnstile } from '@/lib/turnstile';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Acceso Corporativo',
  robots: { index: false, follow: false },
};

export default async function AccesoPage() {
  const sesion = await sesionActual();
  if (sesion) redirect(sesion.password_temporal ? '/panel/clave' : '/panel');

  const turnstileSiteKey = await siteKeyTurnstile();

  return (
    <div className="acceso">
      <div className="acceso__card">
        <div className="acceso__brand">
          <Logo variant="color" />
        </div>
        <h1 className="acceso__title">Acceso Corporativo</h1>
        <p className="acceso__intro">Uso interno de Cota Clara. Entra con tu RUT y tu contraseña.</p>
        <AccesoForm turnstileSiteKey={turnstileSiteKey} />
      </div>
    </div>
  );
}
