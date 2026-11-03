// Landing page behaviour: console meters, the exam simulator tile, and highlighting the visitor's platform.

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
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function renderConsole() {
  const strips = document.getElementById('strips');
  const consoleEl = document.getElementById('console');
  const ga = document.getElementById('ga');
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
          <div class="meter-proj" style="bottom:${toPct(c.recorded)};--proj:${gain};height:${gain}"></div>
          <div class="meter-target"></div>
        </div>
        <span class="strip-name">${c.name}</span>
      </div>`;
  }).join('');

  const average = CHANNELS.reduce((sum, c) => sum + c.recorded, 0) / CHANNELS.length;
  if (reducedMotion) {
    ga.textContent = average.toFixed(1);
    return;
  }
  // Start the rise once the console is on screen, and count the average up alongside it.
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    observer.disconnect();
    consoleEl.classList.add('is-live');
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1100);
      ga.textContent = (average * (1 - Math.pow(1 - t, 3))).toFixed(1);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { threshold: 0.25 });
  observer.observe(consoleEl);
}

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

  const update = () => {
    const score = Number(input.value);
    const value = Math.round(termGrade(score) * 10) / 10;
    out.textContent = `${score} / 50`;
    grade.textContent = value.toFixed(1);
    grade.classList.toggle('is-target', value >= TARGET);
    grade.classList.toggle('is-low', value < PASSING);
    verdict.textContent = value >= TARGET
      ? `That reaches your target of ${TARGET}.`
      : `You need ${needed} / 50 to reach ${TARGET}.`;
  };
  input.addEventListener('input', update);
  update();
}

function highlightPlatform() {
  const ua = navigator.userAgent;
  const platform =
    /android/i.test(ua) ? 'android'
    : /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) ? 'ios'
    : /windows/i.test(ua) ? 'windows'
    : 'mac';
  document.querySelector(`.dl[data-platform="${platform}"]`)?.classList.add('is-yours');
}

renderConsole();
wireSimulator();
highlightPlatform();
