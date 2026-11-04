// Landing page behaviour: console meters, the exam simulator tile, in-view tile effects, entrance
// animations, the section-following URL, download notes, sound, and highlighting the visitor's
// platform. Sound goes through the app's manager (src/lib/sound.ts), so the
// same cooldowns, voice limits and on/off preference apply here.
import { sound, type SoundSettings } from '../lib/sound';
import { installInteractionSounds } from '../lib/interactionSounds';

type Channel = { name: string; recorded: number; projected: number; target: number };

// Sample Grade 10 quarter. Meters span 60–100 so differences near passing stay readable.
const CHANNELS: Channel[] = [
  { name: 'Math', recorded: 84.2, projected: 87, target: 90 },
  { name: 'English', recorded: 91.5, projected: 93, target: 90 },
  { name: 'Science', recorded: 88.0, projected: 90, target: 90 },
  { name: 'Filipino', recorded: 89.4, projected: 90, target: 90 },
  { name: 'AP', recorded: 86.7, projected: 89, target: 90 },
  { name: 'ESP', recorded: 94.1, projected: 95, target: 90 },
  { name: 'MAPEH', recorded: 92.3, projected: 93, target: 90 },
  { name: 'TLE', recorded: 73.8, projected: 79, target: 90 },
];
const PASSING = 75;
const toPct = (grade: number) => `${Math.max(0, Math.min(100, ((grade - 60) / 40) * 100))}%`;
// Resolved before first paint by the inline script in landing.html (app setting, then the OS).
const reducedMotion = document.documentElement.dataset.motion === 'reduced';
// The hero's entrance runs for about this long; the console waits for it rather than competing.
const ENTRANCE_MS = 900;

/* ───────── Sound preference (shared with the app, see src/lib/preferences.tsx) ───────── */

const PREFERENCES_KEY = 'amplifier-preferences';
const DEFAULT_SOUND: SoundSettings = { enabled: true, volume: .6, categories: { interface: true, data: true, feedback: true, alerts: true } };

function readPrefs(): { sound?: Partial<SoundSettings>; version?: number } & Record<string, unknown> {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? 'null');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function soundSettings(): SoundSettings {
  const raw = readPrefs();
  const merged = { ...DEFAULT_SOUND, ...raw.sound, categories: { ...DEFAULT_SOUND.categories, ...raw.sound?.categories } };
  // Same migration as the app: a version 1 store's "off" was a default, not a choice.
  if ((raw.version ?? 1) < 2) merged.enabled = true;
  return merged;
}

function saveSoundEnabled(enabled: boolean) {
  const raw = readPrefs();
  const next = { ...raw, sound: { ...soundSettings(), enabled }, version: Math.max(2, Number(raw.version) || 0) };
  try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next)); } catch { /* storage blocked: applies to this visit only */ }
}

function wireSound() {
  sound.configure(soundSettings());
  installInteractionSounds();
  const toggle = document.getElementById('sound-toggle');
  if (!toggle) return;
  const reflect = () => {
    toggle.setAttribute('aria-pressed', String(sound.enabled));
    toggle.title = sound.enabled ? 'Turn interface sounds off' : 'Turn interface sounds on';
  };
  reflect();
  toggle.addEventListener('click', () => {
    const enabled = !sound.enabled;
    if (enabled) {
      sound.configure({ ...soundSettings(), enabled });
      sound.unlock();
      sound.play('toggleOn');
    } else {
      // The switch's own click plays before the device closes.
      sound.play('toggleOff');
      sound.configure({ ...soundSettings(), enabled });
    }
    saveSoundEnabled(enabled);
    reflect();
  });
  // Changed in the app in another tab.
  window.addEventListener('storage', (event) => {
    if (event.key !== PREFERENCES_KEY) return;
    sound.configure(soundSettings());
    reflect();
  });
}

/* ───────── Console ───────── */

function countUp(el: HTMLElement, to: number, durationMs: number, digits = 1) {
  if (reducedMotion) { el.textContent = to.toFixed(digits); return; }
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    el.textContent = (to * (1 - Math.pow(1 - t, 3))).toFixed(digits);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderConsole() {
  const strips = document.getElementById('strips');
  const consoleEl = document.getElementById('console');
  const ga = document.getElementById('ga');
  const replay = document.getElementById('replay');
  if (!strips || !consoleEl || !ga) return;

  strips.innerHTML = CHANNELS.map((c, i) => {
    const low = c.recorded < PASSING;
    const gain = `calc(${toPct(c.projected)} - ${toPct(c.recorded)})`;
    return `
      <div class="strip${low ? ' is-low' : ''}" style="--i:${i}" role="img"
           aria-label="${c.name}: ${c.recorded.toFixed(1)} recorded, ${c.projected} projected, target ${c.target}">
        <span class="strip-val${low ? ' is-low' : ''}">${c.recorded.toFixed(1)}</span>
        <div class="meter" style="--rec:${toPct(c.recorded)};--target:${toPct(c.target)}">
          <div class="meter-rec"></div>
          <div class="meter-proj" style="bottom:${toPct(c.recorded)};height:${gain}"></div>
          <div class="meter-target"></div>
        </div>
        <span class="strip-name">${c.name}</span>
      </div>`;
  }).join('');

  const average = CHANNELS.reduce((sum, c) => sum + c.recorded, 0) / CHANNELS.length;
  if (reducedMotion) {
    ga.textContent = average.toFixed(1);
    if (replay) replay.hidden = true;
    return;
  }

  const run = () => {
    consoleEl.classList.remove('is-live');
    void consoleEl.offsetWidth; // restart the CSS animation
    consoleEl.classList.add('is-live');
    countUp(ga, average, 1100);
    // Silent until the visitor has interacted with the page (browsers block audio before that).
    sound.play('swell');
  };

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    observer.disconnect();
    window.setTimeout(run, Math.max(0, ENTRANCE_MS - performance.now()));
  }, { threshold: 0.25 });
  observer.observe(consoleEl);
  replay?.addEventListener('click', run);
}

/* ───────── Simulator tile ───────── */

// Math with weights 40 / 40 / 20: written work 86%, performance tasks 82%, exam out of 50.
function wireSimulator() {
  const input = document.getElementById('exam') as HTMLInputElement | null;
  const out = document.getElementById('exam-out');
  const grade = document.getElementById('sim-grade');
  const verdict = document.getElementById('sim-verdict');
  if (!input || !out || !grade || !verdict) return;

  const TARGET = 85;
  const termGrade = (score: number) => 0.4 * 86 + 0.4 * 82 + 0.2 * (score / 50) * 100;
  const needed = Math.ceil(((TARGET - 0.4 * 86 - 0.4 * 82) / 0.2 / 100) * 50);
  let lastScore = Number(input.value);
  let wasOnTarget = termGrade(lastScore) >= TARGET;

  const update = (audible: boolean) => {
    const score = Number(input.value);
    const value = Math.round(termGrade(score) * 10) / 10;
    const onTarget = value >= TARGET;
    out.textContent = `${score} / 50`;
    grade.textContent = value.toFixed(1);
    grade.classList.toggle('is-target', onTarget);
    grade.classList.toggle('is-low', value < PASSING);
    verdict.textContent = onTarget ? `That reaches your target of ${TARGET}.` : `You need ${needed} / 50 to reach ${TARGET}.`;

    if (audible && score !== lastScore) {
      if (onTarget && !wasOnTarget) {
        sound.play('milestone');
        grade.classList.remove('is-hit');
        void grade.offsetWidth;
        grade.classList.add('is-hit');
      } else if (!onTarget && wasOnTarget) {
        sound.play('settleDown');
      } else {
        // Each step is a fader detent; its pitch climbs with the score.
        sound.play('detent', { rate: 0.85 + (score / 50) * 0.4 });
      }
    }
    lastScore = score;
    wasOnTarget = onTarget;
  };
  input.addEventListener('input', () => update(true));
  update(false);
}

/* ───────── Tiles: in-view effects and pointer light ───────── */

function wireTiles() {
  const report = document.querySelector<HTMLElement>('.tile-report');
  const targets = document.querySelectorAll<HTMLElement>('.tile-forecast, .tile-report');
  if (reducedMotion) {
    targets.forEach((el) => el.classList.add('is-in'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        entry.target.classList.add('is-in');
        if (entry.target === report) {
          report.querySelectorAll<HTMLElement>('dd').forEach((dd) => {
            const value = Number(dd.dataset.value ?? dd.textContent);
            dd.dataset.value = String(value);
            countUp(dd, value, 900, Number.isInteger(value) ? 0 : 1);
          });
          sound.play('reveal');
        }
      }
    }, { threshold: 0.5 });
    targets.forEach((el) => observer.observe(el));
  }

  // A soft light follows the pointer across glass surfaces (pointer devices only).
  if (!matchMedia('(hover: hover)').matches) return;
  document.querySelectorAll<HTMLElement>('.tile, .console, .dl').forEach((el) => {
    el.addEventListener('pointermove', (event) => {
      const box = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${event.clientX - box.left}px`);
      el.style.setProperty('--my', `${event.clientY - box.top}px`);
    });
  });
}

function highlightPlatform() {
  const ua = navigator.userAgent;
  const platform =
    /android/i.test(ua) ? 'android'
    : /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) ? 'ios'
    : /windows/i.test(ua) ? 'windows'
    : 'mac';
  document.querySelectorAll(`[data-platform="${platform}"]`).forEach((el) => el.classList.add('is-yours'));
}

/* ───────── Downloads: confirm the start and say what the device will ask ───────── */

const DOWNLOAD_NOTES: Record<string, string> = {
  android: 'Your download is starting. Open the file when it finishes, and allow your browser to install apps if Android asks.',
  windows: 'Your download is starting. Run the installer when it finishes. If SmartScreen appears, choose More info, then Run anyway.',
};

function wireDownloads() {
  const note = document.getElementById('platform-note');
  document.querySelectorAll<HTMLElement>('[data-download]').forEach((link) => {
    link.addEventListener('click', () => {
      if (note) note.textContent = DOWNLOAD_NOTES[link.dataset.download ?? ''] ?? note.textContent;
    });
  });
}

/* ───────── Trailer: loads and plays only on a click, with sound ───────── */

function wireTrailer() {
  const video = document.getElementById('trailer-video') as HTMLVideoElement | null;
  const play = document.getElementById('trailer-play');
  if (!video || !play) return;
  // Without this script the video keeps its native controls, so it always works.
  const showPoster = () => {
    video.controls = false;
    play.hidden = false;
  };
  showPoster();
  play.addEventListener('click', () => {
    play.hidden = true;
    video.controls = true;
    video.muted = false;
    video.focus();
    void video.play().catch(() => { /* The browser refused: its native controls are showing, so the visitor can start it. */ });
  });
  // A device can claim WebM support and still fail to decode it. Carry on from the same spot with the MP4.
  video.addEventListener('error', () => {
    const mp4 = video.querySelector<HTMLSourceElement>('source[type="video/mp4"]');
    if (!mp4 || !video.currentSrc.endsWith('.webm')) return;
    const resumeAt = video.currentTime;
    video.src = mp4.src;
    video.currentTime = resumeAt;
    void video.play().catch(() => { /* Its native controls are showing. */ });
  });
  video.addEventListener('ended', () => {
    video.load(); // back to the poster
    showPoster();
  });
}

/* ───────── URL follows the section being read ───────── */

// The section under this line of the viewport is the current one.
const SECTION_LINE = 0.4;
// Upper limit for a smooth scroll from a link, for browsers without the scrollend event.
const LINK_SCROLL_MS = 1400;

function wireSectionUrl() {
  const regions = [...document.querySelectorAll<HTMLElement>('[data-spy]')];
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.nav-links a')];
  const highlight = (section: string | null) => {
    links.forEach((link) => {
      if (link.hash === `#${section}`) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  };

  let current: string | null = location.hash.slice(1) || null;
  let following = true;
  let timer = 0;
  highlight(current);

  const sectionInView = () => {
    if (window.scrollY < 24) return null; // the very top of the page keeps a clean address
    const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
    if (atEnd) return regions[regions.length - 1]?.dataset.spy ?? null;
    const line = window.innerHeight * SECTION_LINE;
    let found: string | null = null;
    for (const region of regions) if (region.getBoundingClientRect().top <= line) found = region.dataset.spy ?? null;
    return found;
  };

  const sync = () => {
    if (!following) return;
    const next = sectionInView();
    if (next === current) return;
    current = next;
    // replaceState keeps the Back button useful and never makes the page jump.
    history.replaceState(history.state, '', next ? `#${next}` : location.pathname + location.search);
    highlight(next);
  };

  const resume = () => {
    window.clearTimeout(timer);
    following = true;
    sync();
  };

  // A link's smooth scroll passes other sections; the address should go straight to the destination.
  document.addEventListener('click', (event) => {
    const link = (event.target as Element).closest?.<HTMLAnchorElement>('a[href^="#"]');
    if (!link) return;
    following = false;
    current = link.hash.slice(1) || null;
    highlight(current);
    window.clearTimeout(timer);
    timer = window.setTimeout(resume, LINK_SCROLL_MS);
  });
  window.addEventListener('scrollend', () => { if (!following) resume(); });
  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('hashchange', () => { current = location.hash.slice(1) || null; highlight(current); });
  // With a hash in the address the browser is about to scroll there, and that scroll will sync.
  if (!location.hash) sync();
}

/* ───────── Entrance animations as each part scrolls into view ───────── */

const REVEAL_TARGETS = '.section > h2, .trailer-stage, .trailer-after, .steps, .bento > .tile, .ledger-wrap, .rules > div, .install > div, .faq > details, .closing > *';
const MAX_STAGGER = 4;

function wireReveals() {
  if (reducedMotion) return; // everything simply stays in its final state
  const targets = document.querySelectorAll<HTMLElement>(REVEAL_TARGETS);
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      entry.target.classList.replace('will-reveal', 'is-revealed');
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  targets.forEach((el) => {
    const position = [...(el.parentElement?.children ?? [])].indexOf(el);
    el.style.setProperty('--n', String(Math.min(position, MAX_STAGGER)));
    el.classList.add('will-reveal');
    observer.observe(el);
  });
}

wireSound();
renderConsole();
wireSimulator();
wireTiles();
highlightPlatform();
wireDownloads();
wireTrailer();
wireReveals();
wireSectionUrl();
