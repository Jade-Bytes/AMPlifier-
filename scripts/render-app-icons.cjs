/**
 * Renders the home-screen icons for the installable web app into public/icons/ from the AMPlifier
 * brand mark, using Electron's Chromium (no image tooling needed):
 *   npx electron scripts/render-app-icons.cjs
 *
 *   icon-192.png / icon-512.png  rounded tile on transparency (browsers, Android "any" purpose)
 *   maskable-512.png             full-bleed square, glyph inside the 80% safe zone (Android adaptive shapes)
 *   apple-touch-icon.png (180)   full-bleed and opaque — iOS rounds the corners itself
 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const GRADIENT = 'linear-gradient(120deg,#46d8b8 0%,#69a6ff 55%,#9583ff 100%)';
const glyph = size => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#061024" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 14.5h3.2l2.1-5.2 3.6 9.2 3-12.2 2.4 8.2h4.7"/></svg>`;

// Each variant is drawn at 512 and scaled down for smaller outputs.
const variants = {
  rounded: `<div style="width:512px;height:512px;display:grid;place-items:center"><div style="width:448px;height:448px;border-radius:116px;display:grid;place-items:center;background:${GRADIENT};box-shadow:inset 0 6px 0 rgba(255,255,255,.35)">${glyph(300)}</div></div>`,
  fullBleed: `<div style="width:512px;height:512px;display:grid;place-items:center;background:${GRADIENT}">${glyph(260)}</div>`,
};
const outputs = [
  { file: 'icon-192.png', variant: 'rounded', size: 192 },
  { file: 'icon-512.png', variant: 'rounded', size: 512 },
  { file: 'maskable-512.png', variant: 'fullBleed', size: 512 },
  { file: 'apple-touch-icon.png', variant: 'fullBleed', size: 180 },
];

app.whenReady().then(async () => {
  const outDir = path.join(__dirname, '..', 'public', 'icons');
  fs.mkdirSync(outDir, { recursive: true });
  const window = new BrowserWindow({ width: 512, height: 512, show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } });
  const rendered = {};
  for (const [name, html] of Object.entries(variants)) {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><body style="margin:0;background:transparent;overflow:hidden">${html}</body></html>`)}`);
    await new Promise(resolve => setTimeout(resolve, 300));
    rendered[name] = await window.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  }
  for (const { file, variant, size } of outputs) {
    fs.writeFileSync(path.join(outDir, file), rendered[variant].resize({ width: size, height: size, quality: 'best' }).toPNG());
    console.log(`wrote public/icons/${file} (${size}×${size})`);
  }
  app.quit();
});
