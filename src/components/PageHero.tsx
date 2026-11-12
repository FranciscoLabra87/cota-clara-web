import Link from 'next/link';
import type { ReactNode } from 'react';
import { Illustration } from './Illustration';

type Props = {
  migas: { href?: string; label: string }[];
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
};

export function PageHero({ migas, title, lead, children }: Props) {
  return (
    <section className="page-hero">
      <div className="page-hero__media" aria-hidden="true">
        <Illustration variant="skyline" seed={4} tono="atardecer" className="page-hero__art" />
      </div>
      <div className="page-hero__inner container">
        <nav aria-label="Ruta de navegación">
          <ol className="breadcrumb">
            {migas.map((m) => (
              <li key={m.label} className="breadcrumb__item">
                {m.href ? (
                  <Link className="breadcrumb__link" href={m.href}>
                    {m.label}
                  </Link>
                ) : (
                  <span aria-current="page">{m.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <h1 className="page-hero__title">{title}</h1>
        {lead ? <p className="page-hero__lead">{lead}</p> : null}
        {children}
      </div>
    </section>
  );
}
