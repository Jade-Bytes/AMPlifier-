import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useSound } from '../../lib/preferences';

type Props = {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Modal dialog with focus management: focuses the first field, traps Tab, closes on Escape, restores focus. */
export default function Dialog({ title, eyebrow, description, onClose, children, footer, size = 'md' }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const play = useSound();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>('.dialog-body ' + FOCUSABLE.split(', ').join(', .dialog-body '));
    (first ?? node)?.focus();
    play('open');
    const openedAt = performance.now();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.stopPropagation(); onCloseRef.current(); return; }
      if (event.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(item => item.offsetParent !== null);
      if (!items.length) return;
      const [head, tail] = [items[0], items[items.length - 1]];
      if (event.shiftKey && document.activeElement === head) { event.preventDefault(); tail.focus(); }
      else if (!event.shiftKey && document.activeElement === tail) { event.preventDefault(); head.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.();
      // Skip the instant unmount React's development double-mount performs; real closes are slower.
      if (performance.now() - openedAt > 80) play('close');
    };
  }, []);

  return <div className="dialog-scrim" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panel} className={`dialog glass-float dialog-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <header className="dialog-header">
        <div>
          {eyebrow && <div className="dialog-eyebrow">{eyebrow}</div>}
          <h2 id={titleId}>{title}</h2>
          {description && <p className="dialog-description">{description}</p>}
        </div>
        <button type="button" className="btn-icon" aria-label="Close dialog" onClick={onClose}><X size={18}/></button>
      </header>
      <div className="dialog-body">{children}</div>
      {footer && <footer className="dialog-footer">{footer}</footer>}
    </div>
  </div>;
}
