'use client';

type Props = { className?: string };

export function CookiePreferencesButton({ className = 'button button--outline' }: Props) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event('cota:preferencias-cookies'))}>
      Gestionar preferencias
    </button>
  );
}
