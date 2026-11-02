/**
 * AMPlifier's sound manager — the only place in the app that touches audio.
 *
 * Assets: original sounds rendered by scripts/generate-sounds.py into public/sounds/*.wav. They are
 * fetched and decoded once, after the first user gesture (browsers block audio before one). Until a
 * file is ready — or if it fails to load — the same sound is synthesized with the Web Audio API, so
 * a missing asset is never audible as silence or an error.
 *
 * Restraint is built in, so components can simply ask for a sound:
 *   • each sound has a cooldown, so repeated triggers never stack;
 *   • at most MAX_VOICES play at once; a new sound only displaces a lower-priority one;
 *   • important sounds (confirmations, alerts) briefly duck the quiet ones (taps, ticks, reveals);
 *   • a tap right after any other sound is dropped (the specific sound already answered the click);
 *   • nothing plays while the page is hidden, and nothing at all when the student turns sound off.
 */
import { countTicks } from './soundPlan';

export type SoundCategory = 'interface' | 'data' | 'feedback' | 'alerts';
export type SoundName =
  | 'tap' | 'select' | 'toggleOn' | 'toggleOff' | 'navigate' | 'open' | 'close'
  | 'tick' | 'settleUp' | 'settleDown' | 'reveal' | 'load'
  | 'success' | 'save' | 'complete' | 'milestone'
  | 'notify' | 'warning' | 'error';
export type SoundSettings = { enabled: boolean; volume: number; categories: Record<SoundCategory, boolean> };

type Spec = { file: string; category: SoundCategory; gain: number; priority: 0 | 1 | 2 | 3; cooldown: number };

const SPECS: Record<SoundName, Spec> = {
  tap:        { file: 'tap',         category: 'interface', gain: .32, priority: 0, cooldown: 45 },
  select:     { file: 'select',      category: 'interface', gain: .3,  priority: 1, cooldown: 60 },
  toggleOn:   { file: 'toggle-on',   category: 'interface', gain: .38, priority: 1, cooldown: 80 },
  toggleOff:  { file: 'toggle-off',  category: 'interface', gain: .34, priority: 1, cooldown: 80 },
  navigate:   { file: 'navigate',    category: 'interface', gain: .42, priority: 2, cooldown: 140 },
  open:       { file: 'open',        category: 'interface', gain: .4,  priority: 1, cooldown: 140 },
  close:      { file: 'close',       category: 'interface', gain: .32, priority: 1, cooldown: 140 },
  tick:       { file: 'tick',        category: 'data',      gain: .2,  priority: 0, cooldown: 0 },
  settleUp:   { file: 'settle-up',   category: 'data',      gain: .3,  priority: 1, cooldown: 200 },
  settleDown: { file: 'settle-down', category: 'data',      gain: .3,  priority: 1, cooldown: 200 },
  reveal:     { file: 'reveal',      category: 'data',      gain: .24, priority: 0, cooldown: 700 },
  load:       { file: 'load',        category: 'data',      gain: .34, priority: 1, cooldown: 900 },
  success:    { file: 'success',     category: 'feedback',  gain: .4,  priority: 2, cooldown: 300 },
  save:       { file: 'save',        category: 'feedback',  gain: .38, priority: 2, cooldown: 300 },
  complete:   { file: 'complete',    category: 'feedback',  gain: .38, priority: 2, cooldown: 250 },
  milestone:  { file: 'milestone',   category: 'feedback',  gain: .42, priority: 3, cooldown: 1500 },
  notify:     { file: 'notify',      category: 'alerts',    gain: .38, priority: 2, cooldown: 400 },
  warning:    { file: 'warning',     category: 'alerts',    gain: .4,  priority: 3, cooldown: 400 },
  error:      { file: 'error',       category: 'alerts',    gain: .42, priority: 3, cooldown: 400 },
};

export const SOUND_CATEGORIES: { id: SoundCategory; label: string; description: string; preview: SoundName }[] = [
  { id: 'interface', label: 'Interface', description: 'Pages, panels, buttons, switches, and menus.', preview: 'navigate' },
  { id: 'data', label: 'Numbers and charts', description: 'Grades counting up or down and charts drawing in.', preview: 'reveal' },
  { id: 'feedback', label: 'Confirmations', description: 'Saved changes, completed tasks, and reached targets.', preview: 'success' },
  { id: 'alerts', label: 'Alerts', description: 'Notifications, warnings, and errors.', preview: 'error' },
];

const MAX_VOICES = 4;
const DUCK_MS = 160;
const TAP_SHADOW_MS = 90;

// Synthesized stand-ins, used until (or if) the recorded asset is available. Same tuning as the kit.
type SynthVoice = { freq: number; at?: number; dur: number; type?: OscillatorType; gain?: number; glide?: number };
const FALLBACK: Record<SoundName, SynthVoice[]> = {
  tap: [{ freq: 1650, dur: .04, gain: .5 }],
  select: [{ freq: 1318.5, dur: .07, gain: .6 }],
  toggleOn: [{ freq: 987.8, dur: .05, gain: .5 }, { freq: 1318.5, at: .035, dur: .07, gain: .6 }],
  toggleOff: [{ freq: 1318.5, dur: .05, gain: .5 }, { freq: 987.8, at: .035, dur: .07, gain: .6 }],
  navigate: [{ freq: 830.6, glide: 987.8, dur: .18, gain: .45 }],
  open: [{ freq: 928, glide: 987.8, dur: .16, gain: .5 }, { freq: 1318.5, at: .045, dur: .14, gain: .35 }],
  close: [{ freq: 1318.5, glide: 987.8, dur: .13, gain: .45 }],
  tick: [{ freq: 2350, dur: .03, gain: .5 }],
  settleUp: [{ freq: 987.8, dur: .22, gain: .5 }, { freq: 1318.5, at: .02, dur: .22, gain: .35 }],
  settleDown: [{ freq: 830.6, dur: .2, gain: .5 }],
  reveal: [1318.5, 1480, 1661.2, 1975.5].map((freq, index) => ({ freq, at: index * .04, dur: .1, gain: .4 })),
  load: [{ freq: 659.3, dur: .45, gain: .5 }, { freq: 987.8, dur: .45, gain: .3 }],
  success: [{ freq: 1318.5, dur: .3, gain: .55 }, { freq: 1975.5, at: .075, dur: .35, gain: .45 }],
  save: [{ freq: 1661.2, dur: .3, gain: .55 }],
  complete: [659.3, 830.6, 987.8, 1318.5].map((freq, index) => ({ freq, at: index * .055, dur: .3, gain: .45, type: 'triangle' as const })),
  milestone: [987.8, 1318.5, 1661.2, 1975.5].map((freq, index) => ({ freq, at: index * .045, dur: .35, gain: .45 })),
  notify: [{ freq: 1108.7, dur: .3, gain: .5 }, { freq: 1318.5, at: .11, dur: .35, gain: .5 }],
  warning: [{ freq: 493.9, dur: .12, gain: .55, type: 'triangle' }, { freq: 493.9, at: .16, dur: .14, gain: .55, type: 'triangle' }],
  error: [{ freq: 659.3, dur: .16, gain: .55, type: 'triangle' }, { freq: 493.9, at: .12, dur: .24, gain: .55, type: 'triangle' }],
};

type Voice = { name: SoundName; priority: number; started: number; stop: () => void };
export type SoundEvent = { name: SoundName; at: number; via: 'asset' | 'synth' | 'dropped'; reason?: string };
type PlayOptions = { force?: boolean; rate?: number; gain?: number; when?: number; /** performance.now() of the triggering input; any sound since then covers a tap. */ inputAt?: number };

class SoundManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<SoundName, AudioBuffer | 'loading' | 'failed'>();
  private settings: SoundSettings = { enabled: true, volume: .6, categories: { interface: true, data: true, feedback: true, alerts: true } };
  private lastPlayed = new Map<SoundName, number>();
  private voices: Voice[] = [];
  private duckUntil = 0;
  private lastAny = 0;
  private lastImportant = -Infinity;
  private countVoices: AudioScheduledSourceNode[] = [];
  private lastCountStart = 0;
  private settleTimer = 0;
  /** Recent decisions (newest last). Read by tests and in-app verification; never sent anywhere. */
  readonly history: SoundEvent[] = [];

  configure(settings: SoundSettings) {
    this.settings = settings;
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.level(), this.context.currentTime, .015);
    if (!settings.enabled) {
      // New sounds stop at once; the device closes a moment later so the switch's own click can finish.
      this.stopCount();
      window.setTimeout(() => { if (!this.settings.enabled) this.silence(); }, 450);
    }
  }

  get enabled() { return this.settings.enabled; }

  /** Called on the first user gesture: opens the audio device and starts decoding the kit. */
  unlock() {
    if (!this.settings.enabled) return;
    try { this.ensureContext(); } catch { /* audio unavailable: stay silent */ }
  }

  /** Stops everything immediately (sound turned off, or the page is going away). */
  silence() {
    this.stopCount();
    for (const voice of this.voices) voice.stop();
    this.voices = [];
    if (this.context) { void this.context.close().catch(() => undefined); this.context = null; this.master = null; }
  }

  play(name: SoundName, options: PlayOptions = {}): boolean {
    const spec = SPECS[name];
    const now = performance.now();
    const drop = (reason: string) => { this.log({ name, at: now, via: 'dropped', reason }); return false; };
    if (!options.force) {
      if (!this.settings.enabled) return drop('sound off');
      if (!this.settings.categories[spec.category]) return drop('category off');
      if (typeof document !== 'undefined' && document.hidden) return drop('page hidden');
      if (now - (this.lastPlayed.get(name) ?? -Infinity) < spec.cooldown) return drop('cooldown');
      if (spec.priority === 0 && now < this.duckUntil) return drop('ducked');
      if (name === 'tap' && (now - this.lastAny < TAP_SHADOW_MS || (options.inputAt !== undefined && this.lastAny >= options.inputAt))) return drop('covered by another sound');
      // A number counting into view is already the arrival cue.
      if ((name === 'load' || name === 'reveal') && now - this.lastCountStart < 900) return drop('count is playing');
      // Closing a dialog that just confirmed something: the confirmation is the sound of that close.
      if (name === 'close' && now - this.lastImportant < 250) return drop('confirmation already played');
    }
    const context = this.contextForPlayback();
    if (!context || !this.master) return drop('audio not available yet');

    this.voices = this.voices.filter(voice => now - voice.started < 1500);
    if (this.voices.length >= MAX_VOICES) {
      const weakest = this.voices.reduce((low, voice) => voice.priority < low.priority || (voice.priority === low.priority && voice.started < low.started) ? voice : low);
      if (weakest.priority > spec.priority) return drop('too many sounds');
      weakest.stop();
      this.voices = this.voices.filter(voice => voice !== weakest);
    }
    if (spec.priority >= 2) {
      this.lastImportant = now;
      this.duckUntil = now + DUCK_MS;
      for (const voice of this.voices.filter(voice => voice.priority === 0)) voice.stop();
      this.stopCount(); // a confirmation or alert outranks a number still counting
    }

    this.lastPlayed.set(name, now);
    this.lastAny = now;
    const { stop, via } = this.emit(context, name, options);
    this.voices.push({ name, priority: spec.priority, started: now, stop });
    this.log({ name, at: now, via });
    return true;
  }

  /** Starts one sound now or at `when` (AudioContext time). Policy is the caller's job. */
  private emit(context: AudioContext, name: SoundName, options: PlayOptions) {
    const start = options.when ?? context.currentTime + .004;
    const out = context.createGain();
    out.gain.value = SPECS[name].gain * (options.gain ?? 1);
    out.connect(this.master!);
    const buffer = this.buffers.get(name);
    if (buffer instanceof AudioBuffer) {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = options.rate ?? 1;
      source.connect(out);
      source.start(start);
      source.onended = () => { source.disconnect(); out.disconnect(); };
      return { nodes: [source] as AudioScheduledSourceNode[], via: 'asset' as const, stop: () => this.fadeOut(out, () => source.stop()) };
    }
    const nodes = FALLBACK[name].map(voice => this.synth(context, out, voice, start, options.rate ?? 1));
    return { nodes: nodes as AudioScheduledSourceNode[], via: 'synth' as const, stop: () => this.fadeOut(out, () => nodes.forEach(node => node.stop())) };
  }

  /**
   * Audio for a number animating from `from` to `to` over `durationMs` (ease-out, like AnimatedNumber):
   * soft ticks that follow the digits and step up or down the scale, then a landing tone.
   * Only one count is audible at a time; a newer one replaces the older. Returns a cancel function.
   */
  count(from: number, to: number, durationMs: number): () => void {
    if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return () => undefined;
    if (!this.settings.enabled || !this.settings.categories.data || document.hidden) { this.log({ name: 'tick', at: performance.now(), via: 'dropped', reason: 'sound off' }); return () => undefined; }
    const context = this.contextForPlayback();
    if (!context) { this.log({ name: 'tick', at: performance.now(), via: 'dropped', reason: 'audio not available yet' }); return () => undefined; }
    this.stopCount();
    const now = performance.now();
    for (const voice of this.voices.filter(voice => voice.name === 'load' && now - voice.started < 120)) voice.stop();
    // Rapid re-triggers (typing a value) only get the landing tone, never another run of ticks.
    const rapid = now - this.lastCountStart < 350;
    const previousStart = this.lastCountStart;
    this.lastCountStart = now;
    this.lastAny = now;
    const base = context.currentTime + .02;
    if (!rapid) {
      const ticks = countTicks(from, to, durationMs);
      for (const tick of ticks) this.countVoices.push(...this.emit(context, 'tick', { when: base + tick.at / 1000, rate: tick.rate, gain: tick.gain }).nodes);
      this.log({ name: 'tick', at: now, via: this.buffers.get('tick') instanceof AudioBuffer ? 'asset' : 'synth', reason: `${ticks.length} ticks ${to > from ? 'rising' : 'falling'}` });
    }
    const settle = to > from ? 'settleUp' : 'settleDown';
    const timer = this.settleTimer = window.setTimeout(() => this.play(settle), Math.round(durationMs * (rapid ? .3 : .78)));
    return () => {
      if (this.settleTimer !== timer) return;
      this.stopCount();
      // Cancelled at once (an immediate re-render or remount): don't let it count as a rapid re-trigger.
      if (performance.now() - now < 60) this.lastCountStart = previousStart;
    };
  }

  /** Cancels counts and pending landing tones without closing the audio device. */
  silenceScheduled() { this.stopCount(); }

  private stopCount() {
    window.clearTimeout(this.settleTimer);
    const context = this.context;
    for (const node of this.countVoices) { try { node.stop(context ? context.currentTime + .01 : 0); } catch { /* already stopped */ } }
    this.countVoices = [];
  }

  private level() { return Math.max(0, Math.min(1, this.settings.volume)); }

  private contextForPlayback(): AudioContext | null {
    // Before the first gesture browsers refuse to start audio; don't even try (and don't warn).
    if (!this.context && typeof navigator !== 'undefined' && navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
    try {
      const context = this.ensureContext();
      if (context.state === 'suspended') void context.resume().catch(() => undefined);
      return context;
    } catch {
      return null;
    }
  }

  private ensureContext(): AudioContext {
    if (this.context && this.master) return this.context;
    if (typeof window === 'undefined' || !('AudioContext' in window)) throw new Error('Web Audio unavailable');
    const context = new AudioContext({ latencyHint: 'interactive' });
    const master = context.createGain();
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 8;
    limiter.ratio.value = 6;
    master.gain.value = this.level();
    master.connect(limiter).connect(context.destination);
    this.context = context;
    this.master = master;
    this.preload(context);
    return context;
  }

  private preload(context: AudioContext) {
    const base = `${import.meta.env.BASE_URL ?? '/'}sounds/`;
    for (const [name, spec] of Object.entries(SPECS) as [SoundName, Spec][]) {
      const current = this.buffers.get(name);
      if (current instanceof AudioBuffer || current === 'loading') continue;
      this.buffers.set(name, 'loading');
      fetch(`${base}${spec.file}.wav`)
        .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.arrayBuffer(); })
        .then(data => context.decodeAudioData(data))
        .then(buffer => { this.buffers.set(name, buffer); })
        .catch(() => { this.buffers.set(name, 'failed'); }); // the synthesized stand-in keeps playing
    }
  }

  private synth(context: AudioContext, out: AudioNode, { freq, at = 0, dur, type = 'sine', gain = .5, glide }: SynthVoice, start: number, rate: number) {
    const t0 = start + at;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq * rate, t0);
    if (glide) oscillator.frequency.exponentialRampToValueAtTime(glide * rate, t0 + dur * .8);
    envelope.gain.setValueAtTime(0, t0);
    envelope.gain.linearRampToValueAtTime(gain, t0 + .005);
    envelope.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    oscillator.connect(envelope).connect(out);
    oscillator.start(t0);
    oscillator.stop(t0 + dur + .02);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    return oscillator;
  }

  private fadeOut(gain: GainNode, stop: () => void) {
    const context = this.context;
    if (!context) return;
    try {
      gain.gain.setTargetAtTime(0, context.currentTime, .012);
      window.setTimeout(() => { try { stop(); } catch { /* already ended */ } }, 60);
    } catch { /* context closed */ }
  }

  private log(event: SoundEvent) {
    this.history.push(event);
    if (this.history.length > 80) this.history.splice(0, this.history.length - 80);
  }
}

export const sound = new SoundManager();
