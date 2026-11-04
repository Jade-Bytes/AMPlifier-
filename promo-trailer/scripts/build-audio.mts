// Builds public/audio/mix.wav from the music and effects, using the same cues as the picture.
// Run from promo-trailer/:  node scripts/build-audio.mts
import { execFileSync } from 'node:child_process';
import { BEAT, CUE, DURATION, EIGHTH, MUSIC_BLOCKS, bar, check, seconds } from '../src/beats.ts';

check();
const DIR = 'public/audio';
const TARGET_LUFS = -14;
const CEILING_DB = -1.5;
const SR = 48000;
const total = seconds(DURATION);

type Cue = { file: string; at: number; db: number; seek?: number };
const cues: Cue[] = [];
const whooshLead = 0.22; // the whoosh file peaks about this far in
const tick = (frame: number, db = -14) => cues.push({ file: 'fader-tick.mp3', at: seconds(frame), db });
const whoosh = (frame: number, db = -22) => cues.push({ file: 'whoosh.wav', at: seconds(frame) - whooshLead, db });

// Signal: the first score, then one tick an eighth note apart as each subject lands.
tick(CUE.signal, -8);
for (let i = 0; i < 8; i++) tick(CUE.signalLands + i * EIGHTH, -11 + i * 0.4);
cues.push({ file: 'console-rise.mp3', at: seconds(CUE.signalSurge) - 0.1, db: -9 });

// Rise: a soft whoosh on each feature cut.
for (const frame of [CUE.forecast, CUE.reportCard, CUE.gradebook, CUE.planning, CUE.approach]) whoosh(frame);

// Approach: slider detents, then the riser stops at the silent break.
tick(CUE.approach + BEAT, -9);
tick(CUE.approach + BEAT * 2, -9);
tick(CUE.approach + BEAT * 3, -9);
cues.push({ file: 'riser.wav', at: seconds(CUE.breakdown) - 4.56, db: -19 });

// The moment.
tick(CUE.drop, -6);
cues.push({ file: 'impact.wav', at: seconds(CUE.drop), db: -3.5 });

// Everywhere: one soft pass per platform, a lighter impact out of the second break.
for (const frame of [CUE.windows, CUE.apple, CUE.browser]) whoosh(frame, -24);
cues.push({ file: 'impact.wav', at: seconds(CUE.sync), db: -13 });

const inputs: string[] = [];
const graph: string[] = [];
const labels: string[] = [];
let index = 0;
const addInput = (file: string) => { inputs.push('-i', `${DIR}/${file}`); return index++; };
const delay = (t: number) => `adelay=${Math.round(t * 1000)}:all=1`;
const clean = `aresample=${SR},aformat=sample_fmts=fltp:channel_layouts=stereo`;

// Gain over time: quiet at first, so the drop has somewhere to go.
const MUSIC_START = MUSIC_BLOCKS[0].at;
const ramp = (a: number, b: number, from: number, to: number) => `if(between(t,${a},${b}),${from}+(${to}-(${from}))*(t-${a})/(${b}-${a}),0)`;
const at = (n: number) => seconds(bar(n));
const dbCurve = `(${[
  `if(lt(t,${at(5)}),-9,0)`,
  ramp(at(5), at(8), -9, -4),
  ramp(at(8), at(9), -4, -2),
  `if(gte(t,${at(9)}),0,0)`,
].join('+')})`;

const music = addInput('music-source.mp3');
MUSIC_BLOCKS.forEach((block, i) => {
  const fadeOut = i < MUSIC_BLOCKS.length - 1 ? `,afade=t=out:st=${(block.to - block.from - 0.012).toFixed(3)}:d=0.03` : '';
  const fadeIn = i > 0 ? ',afade=t=in:st=0:d=0.018' : ',afade=t=in:st=0:d=0.004';
  graph.push(`[${music}:a]atrim=${block.from}:${block.to + (i < MUSIC_BLOCKS.length - 1 ? 0.018 : 0)},asetpts=N/SR/TB,${clean}${fadeIn}${fadeOut},${delay(block.at)}[m${i}]`);
  labels.push(`[m${i}]`);
});
graph.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=longest,volume='pow(10,${dbCurve}/20)':eval=frame[music]`);

// The opening heartbeat: an original low pulse on the first bar's beats 1 and 3, tuned to the track's A.
const pulse = (name: string, t: number, gain: number) =>
  graph.push(`aevalsrc='${gain}*(sin(2*PI*55*t)+0.35*sin(2*PI*110*t))*exp(-3.2*t)*min(1,t*120)|${gain}*(sin(2*PI*55*t)+0.35*sin(2*PI*110*t))*exp(-3.2*t)*min(1,t*120)':s=${SR}:d=1.5,${clean},${delay(t)}[${name}]`);
pulse('p0', seconds(bar(0)), 0.22);
pulse('p1', seconds(bar(0, 2)), 0.27);

const fx = cues.map((cue, i) => {
  const n = addInput(cue.file);
  graph.push(`[${n}:a]${clean},volume=${cue.db}dB,${delay(Math.max(0, cue.at))}[x${i}]`);
  return `[x${i}]`;
});

const mixAll = ['[music]', '[p0]', '[p1]', ...fx];
const run = (args: string[]) => execFileSync('ffmpeg', ['-hide_banner', '-y', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });

const premix = `${DIR}/premix.wav`;
const filter = `${graph.join(';')};${mixAll.join('')}amix=inputs=${mixAll.length}:normalize=0:duration=longest,apad,atrim=0:${total}[out]`;
run([...inputs, '-filter_complex', filter, '-map', '[out]', '-ar', String(SR), '-c:a', 'pcm_f32le', premix]);

const measure = (file: string) => {
  const result = execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "${file}" -af ebur128=peak=true -f null - 2>&1 | tail -14`], { encoding: 'utf8' });
  const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(result)?.[1]);
  const peak = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(result)?.[1]);
  return { lufs, peak };
};

// Gain to target, then a true-peak limiter; the limiter takes a little level, so iterate.
const out = `${DIR}/mix.wav`;
let gain = TARGET_LUFS - measure(premix).lufs;
let result = { lufs: 0, peak: 0 };
for (let pass = 0; pass < 5; pass++) {
  const limit = Math.pow(10, CEILING_DB / 20).toFixed(4);
  run(['-i', premix, '-af', `volume=${gain.toFixed(3)}dB,aresample=192000,alimiter=limit=${limit}:level=false:attack=4:release=120,aresample=${SR}`, '-c:a', 'pcm_s24le', out]);
  result = measure(out);
  const miss = TARGET_LUFS - result.lufs;
  console.log(`pass ${pass}: gain ${gain.toFixed(2)} dB, ${result.lufs} LUFS, true peak ${result.peak} dBFS`);
  if (Math.abs(miss) < 0.15) break;
  gain += miss;
}
console.log(`Wrote ${out}: ${result.lufs} LUFS, true peak ${result.peak} dBFS`);
