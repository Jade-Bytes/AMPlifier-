/**
 * Renders the Android app's launcher icons into android/app/src/main/res/mipmap-* from the AMPlifier
 * brand mark, using Electron's Chromium (no image tooling needed):
 *   npx electron scripts/render-android-icons.cjs
 *
 *   ic_launcher.png             rounded tile (Android 7 and older launchers)
 *   ic_launcher_round.png       circle (launchers that ask for round icons)
 *   ic_launcher_foreground.png  full-bleed adaptive-icon layer, glyph inside the 66/108 safe zone
 *                               (Android 8+ crops it to the launcher's shape; also the splash icon)
 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const GRADIENT = 'linear-gradient(120deg,#46d8b8 0%,#69a6ff 55%,#9583ff 100%)';
const glyph = size => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#061024" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 14.5h3.2l2.1-5.2 3.6 9.2 3-12.2 2.4 8.2h4.7"/></svg>`;

// Each variant is drawn at 512 and scaled down for each density.
const variants = {
  rounded: `<div style="width:512px;height:512px;display:grid;place-items:center"><div style="width:448px;height:448px;border-radius:116px;display:grid;place-items:center;background:${GRADIENT};box-shadow:inset 0 6px 0 rgba(255,255,255,.35)">${glyph(300)}</div></div>`,
  round: `<div style="width:512px;height:512px;display:grid;place-items:center"><div style="width:464px;height:464px;border-radius:50%;display:grid;place-items:center;background:${GRADIENT};box-shadow:inset 0 6px 0 rgba(255,255,255,.35)">${glyph(280)}</div></div>`,
  foreground: `<div style="width:512px;height:512px;display:grid;place-items:center;background:${GRADIENT}">${glyph(230)}</div>`,
};
// Launcher icons are 48dp; adaptive layers are 108dp.
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const outputs = [
  { file: 'ic_launcher.png', variant: 'rounded', dp: 48 },
  { file: 'ic_launcher_round.png', variant: 'round', dp: 48 },
  { file: 'ic_launcher_foreground.png', variant: 'foreground', dp: 108 },
];

app.whenReady().then(async () => {
  const resDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
  const window = new BrowserWindow({ width: 512, height: 512, show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } });
  const rendered = {};
  for (const [name, html] of Object.entries(variants)) {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><body style="margin:0;background:transparent;overflow:hidden">${html}</body></html>`)}`);
    await new Promise(resolve => setTimeout(resolve, 300));
    rendered[name] = await window.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  }
  for (const [density, scale] of Object.entries(densities)) {
    const dir = path.join(resDir, `mipmap-${density}`);
    fs.mkdirSync(dir, { recursive: true });
    for (const { file, variant, dp } of outputs) {
      const size = Math.round(dp * scale);
      fs.writeFileSync(path.join(dir, file), rendered[variant].resize({ width: size, height: size, quality: 'best' }).toPNG());
    }
    console.log(`wrote mipmap-${density}`);
  }
  app.quit();
});
