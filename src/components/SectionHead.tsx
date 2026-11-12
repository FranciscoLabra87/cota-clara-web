import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

type Props = {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  link?: { href: string; label: string };
  light?: boolean;
  id?: string;
};

export function SectionHead({ eyebrow, title, lead, link, light = false, id }: Props) {
  return (
    <div className={`section-head${light ? ' section-head--light' : ''}`}>
      <div className="section-head__text">
        {eyebrow ? <span className={`eyebrow${light ? ' eyebrow--light' : ''}`}>{eyebrow}</span> : null}
        <h2 className="section-head__title" id={id}>
          {title}
        </h2>
        {lead ? <p className="section-head__lead">{lead}</p> : null}
      </div>
      {link ? (
        <Link className="link-arrow" href={link.href}>
          {link.label}
          <Icon name="arrow" className="link-arrow__icon" />
        </Link>
      ) : null}
    </div>
  );
}
