import { Icon } from './Icon';
import { whatsappHref } from '@/data/site';

export function WhatsAppButton() {
  return (
    <a className="wa-float" href={whatsappHref()} target="_blank" rel="noopener noreferrer" aria-label="Escríbenos por WhatsApp">
      <Icon name="whatsapp" className="wa-float__icon" />
      <span className="wa-float__label">¿Conversemos?</span>
    </a>
  );
}
