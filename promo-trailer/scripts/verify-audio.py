"""Checks a finished trailer: loudness, clipping, and whether the music hits land on the cue frames.
Usage: python -I scripts/verify-audio.py <video>"""
import re, subprocess, sys
import numpy as np

path = sys.argv[1]
SR = 48000
x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vn', '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout, dtype=np.float32)
print(f'audio {x.size / 2 / SR:.3f}s  samples at or above full scale: {(np.abs(x) >= 1).sum()}  sample peak {20 * np.log10(np.abs(x).max()):.2f} dBFS')

log = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
summary = log[log.rfind('Summary:'):]
print('integrated', re.search(r'I:\s+(-?[\d.]+) LUFS', summary).group(1), 'LUFS; range', re.search(r'LRA:\s+(-?[\d.]+) LU', summary).group(1), 'LU; true peak', re.search(r'Peak:\s+(-?[\d.]+) dBFS', summary).group(1), 'dBFS')

mono = x.reshape(-1, 2).mean(axis=1)
def rms(a, b):
    s = mono[int(a * SR):int(b * SR)]
    return 20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-9)

print('\nLevel around each key moment (dB):')
for name, t in [('first pulse', 1.2), ('music enters', 4.4), ('break starts', 29.2), ('drop', 30.0), ('theme', 36.4), ('second break', 48.0), ('sync hit', 49.2), ('close', 52.4), ('final chord', 55.6)]:
    print(f'  {name:13s} {t:5.1f}s  before {rms(t - .25, t):7.1f}  after {rms(t, t + .25):7.1f}')
print(f'  {"last second":13s} 59.0s  {rms(59, 60):7.1f}')

# Exact position of the attack at the two biggest hits.
env = np.abs(mono)
for name, t in [('drop', 30.0), ('sync hit', 49.2)]:
    a, b = int((t - .15) * SR), int((t + .15) * SR)
    hop = 48
    e = np.array([np.sqrt(np.mean(mono[i:i + hop] ** 2)) for i in range(a, b, hop)])
    onset = a / SR + (np.argmax(np.diff(e)) * hop) / SR
    print(f'{name}: steepest attack at {onset:.3f}s, {abs(onset - t) * 1000:.0f} ms from the cue; one frame is 33 ms')

# Joins in the music edit: a click would be a sudden sample jump far above its surroundings.
print('\nLargest sample jump near each edit, compared with the region:')
for name, t in [('join at 33.2s', 33.2), ('join at 52.4s', 52.4)]:
    near = np.abs(np.diff(mono[int((t - .03) * SR):int((t + .03) * SR)])).max()
    around = np.abs(np.diff(mono[int((t - 1) * SR):int((t - .1) * SR)])).max()
    print(f'  {name}: {near:.3f} vs {around:.3f}; level {rms(t - .3, t):.1f} -> {rms(t, t + .3):.1f} dB')
