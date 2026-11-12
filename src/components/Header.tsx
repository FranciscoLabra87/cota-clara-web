'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { navegacion, site, whatsappHref } from '@/data/site';

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const transparent = !scrolled && !open;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const modifiers = [transparent ? 'site-header--transparent' : '', open ? 'site-header--open' : ''].filter(Boolean).join(' ');

  return (
    <header className={`site-header ${modifiers}`.trim()}>
      <div className="site-header__inner container">
        <Link href="/" className="site-header__brand" aria-label="Cota Clara, ir al inicio">
          <Logo variant={transparent || open ? 'negativo' : 'color'} />
        </Link>

        <nav className="nav" aria-label="Principal">
          <ul className="nav__list">
            {navegacion.map((item) => (
              <li key={item.href} className="nav__item">
                <Link
                  href={item.href}
                  className={`nav__link${isActive(item.href) ? ' nav__link--active' : ''}`}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-header__actions">
          <a className="site-header__phone" href={`tel:${site.telefonoHref}`}>
            <Icon name="phone" className="site-header__phone-icon" />
            {site.telefono}
          </a>
          <Link className="button button--primary button--sm site-header__cta" href="/contacto">
            Contacto
          </Link>
          <button
            type="button"
            className="site-header__toggle"
            aria-expanded={open}
            aria-controls="menu-movil"
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? 'close' : 'menu'} className="site-header__toggle-icon" />
            <span className="visually-hidden">{open ? 'Cerrar menú' : 'Abrir menú'}</span>
          </button>
        </div>
      </div>

      <div id="menu-movil" className="mobile-menu" hidden={!open}>
        <ul className="mobile-menu__list">
          {navegacion.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="mobile-menu__link">
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/contacto" className="mobile-menu__link">
              Contacto
            </Link>
          </li>
        </ul>
        <div className="mobile-menu__footer">
          <a className="mobile-menu__contact" href={`tel:${site.telefonoHref}`}>
            <Icon name="phone" /> {site.telefono}
          </a>
          <a className="mobile-menu__contact" href={whatsappHref()} target="_blank" rel="noopener noreferrer">
            <Icon name="whatsapp" /> Escríbenos por WhatsApp
          </a>
        </div>
      </div>
    </header>
  );
}
