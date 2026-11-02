"""
Renders AMPlifier's interface sound kit to public/sounds/*.wav.

Every sound is synthesized from scratch here (sine/FM tones, filtered noise, a small Schroeder
room), so the assets are original work owned by the project — no samples, no third-party audio,
nothing to license. Re-run after changing a recipe:

    python scripts/generate-sounds.py

Design brief (written in the each::sense / stable-audio prompt style from the installed
sound-effects skill, and used as the spec for each recipe below):
  "Clean, pristine, digital UI sound for a premium academic app. Dry, close, soft attack, no
   arcade character. Tuned to E major pentatonic so any two sounds played together are consonant.
   Signal (recorded) = bright glassy tones; gain (projected) = rising motion; valve (alerts) = warm."

Pure standard library: 32 kHz, mono, 16-bit PCM. Each file is peak-normalised to -6 dBFS; the
runtime sound manager sets per-sound loudness.
"""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 32_000
OUT = Path(__file__).resolve().parent.parent / 'public' / 'sounds'
random.seed(7)  # deterministic noise → identical files on every run

# E major pentatonic, the kit's tuning.
E4, GS4, B4 = 329.63, 415.30, 493.88
E5, FS5, GS5, B5, CS6 = 659.26, 739.99, 830.61, 987.77, 1108.73
E6, FS6, GS6, B6, CS7 = 1318.51, 1479.98, 1661.22, 1975.53, 2217.46


def buffer(seconds):
    return [0.0] * int(seconds * RATE)


def add(dst, src, at=0.0, gain=1.0):
    offset = int(at * RATE)
    for i, value in enumerate(src):
        j = offset + i
        if j < len(dst):
            dst[j] += value * gain
    return dst


def envelope(n, attack, decay, hold=0.0):
    """Linear attack, optional hold, exponential decay (time constant `decay`)."""
    out = []
    for i in range(n):
        t = i / RATE
        if t < attack:
            out.append(t / attack)
        elif t < attack + hold:
            out.append(1.0)
        else:
            out.append(math.exp(-(t - attack - hold) / decay))
    return out


def tone(freq, seconds, attack=0.004, decay=0.08, glide_to=None, wave_shape='sine', harmonics=()):
    """A single voice with optional pitch glide and extra harmonics [(multiple, level)]."""
    n = int(seconds * RATE)
    env = envelope(n, attack, decay)
    out, phase = [], 0.0
    for i in range(n):
        f = freq if glide_to is None else freq * (glide_to / freq) ** min(1.0, i / (n * 0.7))
        phase += 2 * math.pi * f / RATE
        if wave_shape == 'triangle':
            value = 2 / math.pi * math.asin(math.sin(phase))
        else:
            value = math.sin(phase)
        for multiple, level in harmonics:
            value += level * math.sin(phase * multiple)
        out.append(value * env[i])
    return out


def bell(freq, seconds, decay=0.25, index=1.6, ratio=3.5, attack=0.002):
    """FM bell: a glassy, slightly inharmonic chime whose brightness fades with the note."""
    n = int(seconds * RATE)
    env = envelope(n, attack, decay)
    out = []
    for i in range(n):
        t = i / RATE
        mod = index * math.exp(-t / (decay * 0.45)) * math.sin(2 * math.pi * freq * ratio * t)
        out.append(math.sin(2 * math.pi * freq * t + mod) * env[i])
    return out


class Biquad:
    """RBJ cookbook filter; frequency may be updated per sample for sweeps."""

    def __init__(self, kind, freq, q=0.707):
        self.kind, self.q = kind, q
        self.x1 = self.x2 = self.y1 = self.y2 = 0.0
        self.set(freq)

    def set(self, freq):
        w = 2 * math.pi * min(freq, RATE * 0.45) / RATE
        alpha, cos = math.sin(w) / (2 * self.q), math.cos(w)
        if self.kind == 'low':
            b0, b1, b2 = (1 - cos) / 2, 1 - cos, (1 - cos) / 2
        elif self.kind == 'high':
            b0, b1, b2 = (1 + cos) / 2, -(1 + cos), (1 + cos) / 2
        else:  # band (constant peak gain)
            b0, b1, b2 = alpha, 0.0, -alpha
        a0, a1, a2 = 1 + alpha, -2 * cos, 1 - alpha
        self.c = (b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)

    def __call__(self, x):
        b0, b1, b2, a1, a2 = self.c
        y = b0 * x + b1 * self.x1 + b2 * self.x2 - a1 * self.y1 - a2 * self.y2
        self.x2, self.x1, self.y2, self.y1 = self.x1, x, self.y1, y
        return y


def noise(seconds, kind='band', freq=2000.0, q=1.0, sweep_to=None, attack=0.002, decay=0.02, hold=0.0):
    n = int(seconds * RATE)
    env = envelope(n, attack, decay, hold)
    filt = Biquad(kind, freq, q)
    out = []
    for i in range(n):
        if sweep_to is not None and i % 16 == 0:
            filt.set(freq * (sweep_to / freq) ** (i / n))
        out.append(filt(random.uniform(-1, 1)) * env[i])
    return out


def lowpass(signal, freq):
    filt = Biquad('low', freq)
    return [filt(x) for x in signal]


def room(signal, wet=0.16, size=1.0):
    """Small Schroeder room: four combs into two allpasses. Adds air, never a wash."""
    combs = [(int(d * size * RATE / 1000), g) for d, g in ((29.7, .78), (37.1, .76), (41.1, .74), (43.7, .72))]
    tail = int(0.25 * RATE)
    dry = signal + [0.0] * tail
    out = [0.0] * len(dry)
    for delay, feedback in combs:
        line = [0.0] * delay
        for i, x in enumerate(dry):
            y = line[i % delay]
            line[i % delay] = x + y * feedback
            out[i] += y / len(combs)
    for delay, g in ((int(5.0 * RATE / 1000), .7), (int(1.7 * RATE / 1000), .7)):
        line = [0.0] * delay
        for i, x in enumerate(out):
            y = line[i % delay]
            line[i % delay] = x + y * g
            out[i] = y - g * x
    mixed = [d + w * wet for d, w in zip(dry, out)]
    # trim the silent end
    while len(mixed) > 1 and abs(mixed[-1]) < 1e-4:
        mixed.pop()
    return mixed


def finish(signal, peak=0.5, fade=0.006):
    """Normalise to `peak`, add short fades so no file starts or ends with a click."""
    top = max(abs(x) for x in signal) or 1.0
    out = [x / top * peak for x in signal]
    # Cut the inaudible end of the tail (below about -50 dBFS) so files stay short and small.
    last = max((i for i, x in enumerate(out) if abs(x) > 0.003), default=len(out) - 1)
    out = out[:last + 1]
    fade = max(fade, 0.02)
    fade_n = int(fade * RATE)
    for i in range(min(fade_n, len(out))):
        out[-1 - i] *= i / fade_n
    head = min(int(0.0015 * RATE), len(out))
    for i in range(head):
        out[i] *= i / head
    return out


# ───────────── Recipes ─────────────

def tick():
    # Soft digital tick; the runtime pitch-shifts it to make counts rise or fall.
    s = buffer(0.045)
    add(s, tone(2350, 0.04, attack=0.0008, decay=0.007))
    add(s, noise(0.012, 'high', 3500, decay=0.003), gain=0.25)
    return finish(s)


def tap():
    # Subtle press: a muted transient with a short tonal body.
    s = buffer(0.06)
    add(s, noise(0.02, 'band', 2600, q=1.4, decay=0.004), gain=0.9)
    add(s, tone(1650, 0.05, attack=0.001, decay=0.012), gain=0.55)
    return finish(lowpass(s, 6000))


def select():
    s = buffer(0.1)
    add(s, tone(E6, 0.09, attack=0.0015, decay=0.025, harmonics=((2, 0.12),)))
    add(s, noise(0.01, 'high', 4000, decay=0.002), gain=0.18)
    return finish(s)


def toggle_on():
    s = buffer(0.14)
    add(s, tone(B5, 0.06, attack=0.002, decay=0.018), 0.0, 0.8)
    add(s, tone(E6, 0.09, attack=0.002, decay=0.03), 0.035)
    return finish(s)


def toggle_off():
    s = buffer(0.14)
    add(s, tone(E6, 0.06, attack=0.002, decay=0.018), 0.0, 0.7)
    add(s, tone(B5, 0.09, attack=0.002, decay=0.03), 0.035, 0.9)
    return finish(lowpass(s, 4200))


def navigate():
    # Page change: an airy filtered sweep with a quiet tonal lift underneath.
    s = buffer(0.26)
    add(s, noise(0.22, 'band', 700, q=1.8, sweep_to=3200, attack=0.05, decay=0.05, hold=0.06), gain=0.8)
    add(s, tone(GS5, 0.2, attack=0.03, decay=0.06, glide_to=B5), 0.02, 0.32)
    return finish(room(s, wet=0.12, size=0.8))


def open_panel():
    s = buffer(0.24)
    add(s, tone(B5 * 0.94, 0.2, attack=0.012, decay=0.07, glide_to=B5, harmonics=((2, 0.08),)))
    add(s, bell(E6, 0.18, decay=0.06, index=0.8), 0.045, 0.45)
    return finish(room(s, wet=0.14, size=0.7))


def close_panel():
    s = buffer(0.18)
    add(s, tone(E6, 0.16, attack=0.006, decay=0.05, glide_to=B5))
    return finish(lowpass(room(s, wet=0.1, size=0.6), 5000), peak=0.42)


def success():
    s = buffer(0.62)
    add(s, bell(E6, 0.45, decay=0.14, index=1.2))
    add(s, bell(B6, 0.5, decay=0.18, index=1.0), 0.075, 0.85)
    return finish(room(s, wet=0.18))


def save():
    s = buffer(0.42)
    add(s, bell(GS6, 0.38, decay=0.12, index=0.9))
    add(s, tone(E5, 0.3, attack=0.004, decay=0.09), 0.0, 0.25)
    return finish(room(s, wet=0.16), peak=0.45)


def complete():
    s = buffer(0.7)
    for i, f in enumerate((E5, GS5, B5, E6)):
        add(s, bell(f, 0.4, decay=0.13, index=0.7, ratio=2.0), i * 0.055, 0.8 + i * 0.05)
    return finish(room(s, wet=0.18))


def milestone():
    s = buffer(0.95)
    for i, f in enumerate((B5, E6, GS6, B6)):
        add(s, bell(f, 0.45, decay=0.16, index=1.0), i * 0.045, 0.75)
    add(s, noise(0.5, 'high', 7500, attack=0.08, decay=0.14), 0.12, 0.022)
    return finish(room(s, wet=0.22, size=1.1))


def notify():
    s = buffer(0.55)
    add(s, bell(CS6, 0.35, decay=0.11, index=0.9))
    add(s, bell(E6, 0.45, decay=0.15, index=0.9), 0.11)
    return finish(room(s, wet=0.16))


def warning():
    s = buffer(0.4)
    add(s, tone(B4, 0.13, attack=0.006, decay=0.05, wave_shape='triangle'))
    add(s, tone(B4, 0.16, attack=0.006, decay=0.06, wave_shape='triangle'), 0.16)
    return finish(lowpass(room(s, wet=0.1), 2400))


def error():
    s = buffer(0.42)
    add(s, tone(E5, 0.18, attack=0.004, decay=0.06, wave_shape='triangle'))
    add(s, tone(B4, 0.26, attack=0.004, decay=0.09, wave_shape='triangle', glide_to=B4 * 0.97), 0.12)
    return finish(lowpass(room(s, wet=0.1), 1800))


def reveal():
    # Data arriving: a quiet rising sparkle that follows a chart drawing in.
    s = buffer(0.55)
    for i, f in enumerate((E6, FS6, GS6, B6, CS7)):
        add(s, tone(f, 0.12, attack=0.002, decay=0.03), i * 0.04, 0.55 + i * 0.08)
    return finish(room(s, wet=0.22, size=0.9), peak=0.4)


def load():
    # Content ready: a soft chord that blooms in.
    s = buffer(0.65)
    for f, level in ((E5, 1.0), (B5, 0.7), (E6, 0.45)):
        add(s, tone(f, 0.6, attack=0.045, decay=0.16, harmonics=((2, 0.06),)), 0.0, level)
    return finish(lowpass(room(s, wet=0.2), 4500), peak=0.42)


def settle_up():
    s = buffer(0.32)
    add(s, bell(B5, 0.28, decay=0.08, index=0.6))
    add(s, bell(E6, 0.28, decay=0.09, index=0.6), 0.02, 0.6)
    return finish(room(s, wet=0.14), peak=0.42)


def settle_down():
    s = buffer(0.3)
    add(s, bell(GS5, 0.26, decay=0.08, index=0.5))
    add(s, tone(E5, 0.24, attack=0.004, decay=0.07), 0.025, 0.4)
    return finish(lowpass(room(s, wet=0.12), 3600), peak=0.4)


RECIPES = {
    'tick': tick, 'tap': tap, 'select': select, 'toggle-on': toggle_on, 'toggle-off': toggle_off,
    'navigate': navigate, 'open': open_panel, 'close': close_panel,
    'success': success, 'save': save, 'complete': complete, 'milestone': milestone,
    'notify': notify, 'warning': warning, 'error': error,
    'reveal': reveal, 'load': load, 'settle-up': settle_up, 'settle-down': settle_down,
}


def write(name, samples):
    path = OUT / f'{name}.wav'
    with wave.open(str(path), 'wb') as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        handle.writeframes(b''.join(struct.pack('<h', int(max(-1.0, min(1.0, x)) * 32767)) for x in samples))
    return path


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for name, recipe in RECIPES.items():
        path = write(name, recipe())
        size = path.stat().st_size
        total += size
        print(f'{name:12s} {size / 1024:6.1f} KB')
    print(f'{"total":12s} {total / 1024:6.1f} KB')
