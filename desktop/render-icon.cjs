/**
 * Renders the app icon (desktop/icon.png, 512×512) from the AMPlifier brand mark using Electron's
 * own Chromium, so no image tooling is needed. electron-builder turns it into the Windows .ico.
 *   npx electron desktop/render-icon.cjs
 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const SIZE = 512;
const html = `<!doctype html><html><body style="margin:0;background:transparent;overflow:hidden">
<div style="width:${SIZE}px;height:${SIZE}px;display:grid;place-items:center">
  <div style="width:448px;height:448px;border-radius:116px;display:grid;place-items:center;
    background:linear-gradient(120deg,#46d8b8 0%,#69a6ff 55%,#9583ff 100%);
    box-shadow:inset 0 6px 0 rgba(255,255,255,.35)">
    <svg width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="#061024" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2.5 14.5h3.2l2.1-5.2 3.6 9.2 3-12.2 2.4 8.2h4.7"/>
    </svg>
  </div>
</div></body></html>`;

app.whenReady().then(async () => {
  const window = new BrowserWindow({ width: SIZE, height: SIZE, show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } });
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise(resolve => setTimeout(resolve, 400));
  const image = await window.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE });
  const out = path.join(__dirname, 'icon.png');
  fs.writeFileSync(out, image.resize({ width: SIZE, height: SIZE }).toPNG());
  console.log(`wrote ${out} (${image.getSize().width}×${image.getSize().height})`);
  app.quit();
});
