'use client';

import { useId, useState } from 'react';
import { formatNumero } from '@/lib/format';

type Control = {
  key: 'pie' | 'plazo' | 'tasa';
  label: string;
  min: number;
  max: number;
  step: number;
  sufijo: string;
  decimales: number;
};

const controles: Control[] = [
  { key: 'pie', label: 'Pie', min: 10, max: 50, step: 5, sufijo: '%', decimales: 0 },
  { key: 'plazo', label: 'Plazo', min: 10, max: 30, step: 5, sufijo: ' años', decimales: 0 },
  { key: 'tasa', label: 'Tasa anual', min: 2.5, max: 7, step: 0.1, sufijo: '%', decimales: 1 },
];

export function MortgageCalculator({ precioUF }: { precioUF: number }) {
  const id = useId();
  const [valores, setValores] = useState({ pie: 20, plazo: 25, tasa: 4.1 });

  const pie = (precioUF * valores.pie) / 100;
  const credito = precioUF - pie;
  const r = valores.tasa / 100 / 12;
  const n = valores.plazo * 12;
  const dividendo = r === 0 ? credito / n : (credito * r) / (1 - Math.pow(1 + r, -n));

  return (
    <div className="mortgage">
      <div className="mortgage__inputs">
        {controles.map((c) => (
          <div key={c.key} className="mortgage__control">
            <div className="mortgage__control-head">
              <label className="field__label" htmlFor={`${id}-${c.key}`}>
                {c.label}
              </label>
              <output className="mortgage__value" htmlFor={`${id}-${c.key}`}>
                {formatNumero(valores[c.key], c.decimales)}
                {c.sufijo}
              </output>
            </div>
            <input
              className="mortgage__range"
              type="range"
              id={`${id}-${c.key}`}
              min={c.min}
              max={c.max}
              step={c.step}
              value={valores[c.key]}
              onChange={(e) => setValores((v) => ({ ...v, [c.key]: Number(e.target.value) }))}
            />
          </div>
        ))}
      </div>
      <div className="mortgage__result" aria-live="polite">
        <span className="mortgage__label">Dividendo estimado</span>
        <span className="mortgage__amount">UF {formatNumero(dividendo, 1)}</span>
        <span className="mortgage__period">al mes</span>
        <dl className="mortgage__detail">
          <div>
            <dt>Pie</dt>
            <dd>UF {formatNumero(pie)}</dd>
          </div>
          <div>
            <dt>Crédito</dt>
            <dd>UF {formatNumero(credito)}</dd>
          </div>
        </dl>
        <p className="mortgage__note">Referencial. No incluye seguros ni gastos operacionales; cada banco evalúa tu caso.</p>
      </div>
    </div>
  );
}
