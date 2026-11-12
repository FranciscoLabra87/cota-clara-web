type LogoProps = {
  variant?: 'color' | 'negativo';
  className?: string;
};

/** Símbolo de Cota Clara: la "C" con la cruz de medición y el punto terracota. */
export function LogoSymbol({ className = 'logo__symbol' }: { className?: string }) {
  // "C" con terminales horizontales: anillo de radio 47/29 centrado en (56, 60), abierto entre y = 39 y y = 81.
  return (
    <svg className={className} viewBox="0 0 116 120" aria-hidden="true" focusable="false">
      <path className="logo__c" d="M98.05 39 A47 47 0 1 0 98.05 81 L76 81 A29 29 0 1 1 76 39 Z" />
      <path className="logo__cross" d="M56 1v118M1 60h97" />
      <rect className="logo__mark" x="98" y="47" width="14" height="14" />
    </svg>
  );
}

export function Logo({ variant = 'color', className = '' }: LogoProps) {
  return (
    <span className={`logo logo--${variant} ${className}`.trim()}>
      <LogoSymbol />
      <span className="logo__divider" aria-hidden="true" />
      <span className="logo__text">
        <span className="logo__name">Cota Clara</span>
        <span className="logo__tagline">Patrimonio Inmobiliario</span>
      </span>
    </span>
  );
}
