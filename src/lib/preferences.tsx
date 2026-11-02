import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { sound, type SoundName, type SoundSettings } from './sound';
import { installInteractionSounds } from './interactionSounds';

/**
 * Device-level display and sound preferences. They live in this browser only (not in the
 * student's Firestore workspace) because they describe the device, not the academic record.
 */
export type ThemePreference = 'system' | 'dark' | 'light';
export type MotionPreference = 'system' | 'full' | 'reduced';
export type Preferences = {
  theme: ThemePreference;
  motion: MotionPreference;
  ambient: boolean;
  reduceTransparency: boolean;
  sidebarCollapsed: boolean;
  sound: SoundSettings;
  /** Schema version of the stored preferences (see load()). */
  version: number;
};

export const PREFERENCES_KEY = 'amplifier-preferences';

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  motion: 'system',
  ambient: true,
  reduceTransparency: false,
  sidebarCollapsed: false,
  sound: { enabled: true, volume: .6, categories: { interface: true, data: true, feedback: true, alerts: true } },
  version: 2,
};

function load(): Preferences {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? 'null') as Partial<Preferences> | null;
    if (!raw || typeof raw !== 'object') return DEFAULT_PREFERENCES;
    const merged = { ...DEFAULT_PREFERENCES, ...raw, sound: { ...DEFAULT_PREFERENCES.sound, ...raw.sound, categories: { ...DEFAULT_PREFERENCES.sound.categories, ...raw.sound?.categories } } };
    // Version 1 stored every preference including a sound default of "off", so its value is not a real
    // choice. Version 2 makes interface sounds on by default; carry older stores over to that default.
    if ((raw.version ?? 1) < 2) merged.sound = { ...merged.sound, enabled: true };
    return { ...merged, version: 2 };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    // Some embedded browsers skip MediaQueryList change events on emulated resizes; resize is the fallback.
    window.addEventListener('resize', onChange);
    return () => { list.removeEventListener('change', onChange); window.removeEventListener('resize', onChange); };
  }, [query]);
  return matches;
}

type PreferencesApi = {
  prefs: Preferences;
  update: (patch: Partial<Preferences>) => void;
  updateSound: (patch: Partial<SoundSettings>) => void;
  resolvedTheme: 'dark' | 'light';
  reducedMotion: boolean;
  play: (name: SoundName) => void;
};

const PreferencesContext = createContext<PreferencesApi | null>(null);

export function usePreferences(): PreferencesApi {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return value;
}

/** True when animations should be skipped (OS setting, unless the student chose full motion, or the in-app setting). */
export const useReducedMotion = () => usePreferences().reducedMotion;
export const useSound = () => usePreferences().play;

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(load);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const systemReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const systemReducedTransparency = useMediaQuery('(prefers-reduced-transparency: reduce)');

  const resolvedTheme = prefs.theme === 'system' ? (systemDark ? 'dark' : 'light') : prefs.theme;
  const reducedMotion = prefs.motion === 'reduced' || (prefs.motion === 'system' && systemReducedMotion);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    if (prefs.motion === 'system') delete root.dataset.motion; else root.dataset.motion = prefs.motion;
    if (prefs.reduceTransparency || systemReducedTransparency) root.dataset.transparency = 'reduced'; else delete root.dataset.transparency;
    root.dataset.ambient = prefs.ambient && !reducedMotion ? 'on' : 'off';
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', resolvedTheme === 'dark' ? '#080c1b' : '#edf0f8');
  }, [resolvedTheme, prefs.motion, prefs.reduceTransparency, prefs.ambient, reducedMotion, systemReducedTransparency]);

  useEffect(() => { sound.configure(prefs.sound); }, [prefs.sound]);
  useEffect(() => installInteractionSounds(), []);

  useEffect(() => {
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs)); } catch { /* storage blocked: preferences last for this session */ }
  }, [prefs]);

  const update = useCallback((patch: Partial<Preferences>) => setPrefs(current => ({ ...current, ...patch })), []);
  const updateSound = useCallback((patch: Partial<SoundSettings>) => setPrefs(current => ({ ...current, sound: { ...current.sound, ...patch } })), []);
  const play = useCallback((name: SoundName) => sound.play(name), []);

  const api = useMemo(() => ({ prefs, update, updateSound, resolvedTheme, reducedMotion, play }), [prefs, update, updateSound, resolvedTheme, reducedMotion, play]);
  return <PreferencesContext.Provider value={api}>{children}</PreferencesContext.Provider>;
}
