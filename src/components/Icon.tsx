const paths = {
  bed: 'M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 15h18M3 18v2M21 18v2M6 10V8a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v2M12.5 10V8a1 1 0 0 1 1-1H17a1 1 0 0 1 1 1v2',
  bath: 'M3.5 12h17v2.5A4.5 4.5 0 0 1 16 19H8a4.5 4.5 0 0 1-4.5-4.5V12zM6 12V6.5A2.5 2.5 0 0 1 10.3 5M8 19l-1 2M16 19l1 2',
  car: 'M4.5 16.5V13l1.8-4.2A2 2 0 0 1 8.1 7.6h7.8a2 2 0 0 1 1.8 1.2l1.8 4.2v3.5zM4.5 16.5v2M19.5 16.5v2M7.5 13.5h.01M16.5 13.5h.01M6.5 11h11',
  area: 'M4 4h16v16H4zM8.5 15.5l7-7M11.5 8.5h4v4M8.5 11.5v4h4',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  phone: 'M5.2 4h3.1l1.5 4-2 1.4a11.5 11.5 0 0 0 6.8 6.8l1.4-2 4 1.5v3.1a1.2 1.2 0 0 1-1.3 1.2C10.6 19.4 4.6 13.4 4 5.3A1.2 1.2 0 0 1 5.2 4z',
  mail: 'M3.5 6h17v12h-17zM3.5 7l8.5 6 8.5-6',
  pin: 'M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11zM12 12.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z',
  whatsapp: 'M4 20l1.2-3.6A8 8 0 1 1 8.4 19zM9.2 8.6c-.3 2.6 2.4 5.6 5.4 6.1l1-1.3-1.7-1-.9.8a4.3 4.3 0 0 1-2.2-2.3l.8-.9-.9-1.8z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M10.8 17.6a6.8 6.8 0 1 0 0-13.6 6.8 6.8 0 0 0 0 13.6zM20 20l-4.4-4.4',
  key: 'M14.5 13.5a4.5 4.5 0 1 0-4-4.5M10.8 9.8L3.5 17v3h3v-2h2v-2h2l1.5-1.5M15.5 8.5h.01',
  target: 'M12 2.5v19M2.5 12h19M12 17.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8z',
  building: 'M4 21V6l7-3v18M11 21V9l9 3v9M2.5 21h19M7 8v.01M7 11.5v.01M7 15v.01M14.5 14v.01M17 14v.01M14.5 17.5v.01M17 17.5v.01',
  doc: 'M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h6M9.5 15.5h6',
  shield: 'M12 3l7 3v5.5c0 4.6-3.1 8-7 9.5-3.9-1.5-7-4.9-7-9.5V6zM9 12l2.2 2.2L15.5 10',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
} as const;

export type IconName = keyof typeof paths;

type IconProps = {
  name: IconName;
  className?: string;
  title?: string;
};

export function Icon({ name, className = 'icon', title }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path d={paths[name]} />
    </svg>
  );
}
