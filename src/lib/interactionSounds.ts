import { sound, type SoundName } from './sound';

/**
 * App-wide interaction sounds, installed once. Components with a more specific sound (navigation,
 * switches, segmented controls, dialogs, toasts) play it themselves; this listener supplies the
 * quiet default for every other button, link, menu and checkbox, so nothing needs wiring per component.
 *
 * Opt-outs and overrides: data-sound="none" silences an element; data-sound="<name>" picks a sound.
 * The manager drops a tap that lands right after another sound, so specific sounds always win.
 */
const HANDLED_ELSEWHERE = '.nav-link, [role=switch], .segmented button, .theme-card';
const CLICKABLE = 'button, a[href], [role=button], summary, [role=option]';

export function installInteractionSounds(): () => void {
  const unlock = () => sound.unlock();

  const onClick = (event: MouseEvent) => {
    const target = (event.target as Element | null)?.closest?.<HTMLElement>(CLICKABLE);
    if (!target || target.matches(HANDLED_ELSEWHERE) || target.closest('[data-sound=none]')) return;
    const named = target.closest<HTMLElement>('[data-sound]')?.dataset.sound as SoundName | undefined;
    // A slow render can delay this listener; anything that played since the click already answered it.
    sound.play(named ?? 'tap', { inputAt: event.timeStamp });
  };

  const onChange = (event: Event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement | null;
    if (!target || target.closest('[data-sound=none]')) return;
    if (target instanceof HTMLSelectElement) sound.play('select');
    else if (target.type === 'checkbox') sound.play(target.checked ? 'toggleOn' : 'toggleOff');
    else if (target.type === 'radio') sound.play('select');
  };

  // A hidden tab should not finish a count or chime later; stop anything scheduled.
  const onVisibility = () => { if (document.hidden) sound.silenceScheduled(); };

  document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  document.addEventListener('keydown', unlock, { capture: true, passive: true });
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    document.removeEventListener('pointerdown', unlock, { capture: true });
    document.removeEventListener('keydown', unlock, { capture: true });
    document.removeEventListener('click', onClick);
    document.removeEventListener('change', onChange);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
