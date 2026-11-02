import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../lib/preferences';
import { sound } from '../../lib/sound';
import { crossing } from '../../lib/soundPlan';

const easeOutExpo = (t: number) => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);

/**
 * A number that counts to its value on first render and glides between values when it changes.
 * Screen readers get the final value only; the animated digits are hidden from them.
 * `audible` numbers (one headline figure per screen) sound their count: ticks that rise or fall with
 * the digits and a landing tone. With reduced motion the number jumps and only the landing tone plays.
 */
export function AnimatedNumber({ value, digits = 1, fallback = '—', duration = 900, audible = false }: { value: number | null | undefined; digits?: number; fallback?: string; duration?: number; audible?: boolean }) {
  const reduced = useReducedMotion();
  const valid = value !== null && value !== undefined && Number.isFinite(value);
  const [shown, setShown] = useState(() => valid && !reduced ? 0 : value ?? 0);
  const shownRef = useRef(shown);

  useEffect(() => {
    if (!valid) return;
    const from = shownRef.current;
    const to = value as number;
    const visibleChange = Number(from.toFixed(digits)) !== Number(to.toFixed(digits));
    if (reduced || from === to) {
      if (audible && visibleChange) sound.play(to > from ? 'settleUp' : 'settleDown');
      shownRef.current = to; setShown(to); return;
    }
    const cancelSound = audible && visibleChange ? sound.count(from, to, duration) : null;
    let frame = 0;
    const start = performance.now();
    const at = (now: number) => from + (to - from) * easeOutExpo(Math.min(1, (now - start) / duration));
    const tick = (now: number) => {
      const next = at(now);
      shownRef.current = next;
      setShown(next);
      if (now - start < duration) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // Frames can be paused (background tab, hidden window); the number must still land on its value.
    const land = window.setTimeout(() => { cancelAnimationFrame(frame); shownRef.current = to; setShown(to); }, duration + 50);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(land);
      cancelSound?.();
      // Continue the next glide from where the number would be now, whether or not frames ran.
      shownRef.current = at(performance.now());
    };
  }, [value, valid, reduced, duration, audible, digits]);

  if (!valid) return <>{fallback}</>;
  return <><span aria-hidden="true">{shown.toFixed(digits)}</span><span className="sr-only">{(value as number).toFixed(digits)}</span></>;
}

/**
 * Lights the edge of whichever card the pointer is over (see .card::before in app.css).
 * One passive listener for the whole app, throttled to animation frames.
 */
export function usePointerGlow() {
  useEffect(() => {
    if (window.matchMedia('(hover: none)').matches) return;
    let frame = 0;
    let event: PointerEvent | null = null;
    const apply = () => {
      frame = 0;
      const target = (event?.target as Element | null)?.closest?.<HTMLElement>('.card, .stat');
      if (!target || !event) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty('--mx', `${event.clientX - rect.left}px`);
      target.style.setProperty('--my', `${event.clientY - rect.top}px`);
    };
    const onMove = (next: PointerEvent) => { event = next; if (!frame) frame = requestAnimationFrame(apply); };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => { document.removeEventListener('pointermove', onMove); cancelAnimationFrame(frame); };
  }, []);
}

/** A soft rising sparkle shortly after a screen's charts start drawing in. Once per mount. */
export function useRevealCue(delay = 220) {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const timer = window.setTimeout(() => sound.play('reveal'), delay);
    return () => window.clearTimeout(timer);
  }, [reduced, delay]);
}

/**
 * Marks a value crossing a line that matters — reaching a target plays a milestone chime, dropping
 * below one a soft warning. Only changes after the first render count, so opening a screen is quiet.
 */
export function useThresholdCue(value: number | null, threshold: number | null, delay = 650, scope = '') {
  const previous = useRef<{ value: number | null; scope: string } | null>(null);
  useEffect(() => {
    // A different subject (scope) is a new baseline, not a crossing.
    const direction = previous.current && previous.current.scope === scope ? crossing(previous.current.value, value, threshold) : null;
    previous.current = { value, scope };
    if (!direction) return;
    // Wait for the number's own count to land before marking the milestone.
    const timer = window.setTimeout(() => sound.play(direction === 'up' ? 'milestone' : 'warning'), delay);
    return () => window.clearTimeout(timer);
  }, [value, threshold, delay, scope]);
}
