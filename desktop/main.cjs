const { app, BrowserWindow, shell, session, ipcMain } = require('electron');
const crypto = require('crypto');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let servers = [];
let serverPort = null;

// The app is served from http://localhost:<fixed port>. Both parts matter:
//  - Firebase Authentication accepts Google sign-in only from authorized domains, and "localhost"
//    is authorized by default (127.0.0.1 is not).
//  - The origin owns the saved Firebase session and the student's preferences (theme, sound…);
//    a random port would give every launch a new origin and sign the student out each time.
// Later ports are fallbacks for the rare case the first is taken.
const PORTS = [47821, 47822, 47823, 47824];

// Google blocks sign-in from user agents that announce an embedded browser ("disallowed_useragent").
// Set the Chromium user agent app-wide so the sign-in popup window gets it too, not just the main window.
app.userAgentFallback = app.userAgentFallback.replace(/\s?Electron\/\S+/, '').replace(/\s?AMPlifier\/\S+/i, '');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm'
};

function getDistPath() {
  const candidates = [
    path.join(__dirname, '..', 'dist'),
    path.join(process.resourcesPath, 'dist'),
    path.join(process.resourcesPath, 'app', 'dist'),
    path.join(__dirname, 'dist')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return path.join(__dirname, '..', 'dist');
}

// ───────────── Google sign-in through the system browser ─────────────
// Google discourages (and often blocks) sign-in inside embedded app windows, and in-app popups are
// fragile. Like other desktop apps, AMPlifier opens sign-in in the student's default browser, where
// their Google accounts already live:
//   1. The app asks for a sign-in; we create a one-time secret ("state") and open the sign-in page on
//      the official website (SIGN_IN_PAGE) with ?state=…&port=… in the default browser.
//   2. That page runs Firebase's normal Google sign-in (jade-bytes.github.io is an authorized domain),
//      then POSTs the Google credential with the state back to this server on localhost — accepted only
//      from the official site or the app's own origin, only with the matching state, and only once.
//   3. The app signs in to Firebase with that credential, and its window comes back to the front.
const OFFICIAL_SITE_ORIGIN = 'https://jade-bytes.github.io';
const SIGN_IN_PAGE = `${OFFICIAL_SITE_ORIGIN}/AMPlifier-/desktop-auth.html`;
const SIGN_IN_TIMEOUT_MS = 10 * 60_000;
const MAX_BODY_BYTES = 64 * 1024;
let pendingSignIn = null; // { state, resolve, timer }

function settleSignIn(result) {
  if (!pendingSignIn) return;
  const { resolve, timer } = pendingSignIn;
  clearTimeout(timer);
  pendingSignIn = null;
  resolve(result);
}

function bringAppToFront() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  // Windows only lets the foreground app take focus; briefly pinning on top brings us forward.
  mainWindow.setAlwaysOnTop(true);
  mainWindow.focus();
  mainWindow.setAlwaysOnTop(false);
}

ipcMain.handle('auth:google', (event, options) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return { ok: false, reason: 'error', message: 'Sign-in can only start from the AMPlifier window.' };
  settleSignIn({ ok: false, reason: 'cancelled' }); // a new attempt replaces any unfinished one
  const scopes = Array.isArray(options?.scopes) ? options.scopes.filter(scope => typeof scope === 'string' && /^https:\/\/www\.googleapis\.com\/auth\/[\w.]+$/.test(scope)) : [];
  const state = crypto.randomBytes(32).toString('base64url');
  return new Promise((resolve) => {
    const timer = setTimeout(() => settleSignIn({ ok: false, reason: 'timeout' }), SIGN_IN_TIMEOUT_MS);
    pendingSignIn = { state, resolve, timer };
    const url = new URL(SIGN_IN_PAGE);
    url.searchParams.set('state', state);
    url.searchParams.set('port', String(serverPort)); // where the page sends the result back
    if (scopes.length) url.searchParams.set('scopes', scopes.join(' '));
    shell.openExternal(url.toString()).catch(() => settleSignIn({ ok: false, reason: 'error', message: 'AMPlifier could not open your web browser.' }));
  });
});

ipcMain.handle('auth:cancel', () => settleSignIn({ ok: false, reason: 'cancelled' }));

function sameSecret(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// Pages allowed to finish a sign-in: the official website, and the app's own copy of the page.
const signInOrigins = () => [OFFICIAL_SITE_ORIGIN, `http://localhost:${serverPort}`];

function corsHeaders(origin) {
  return { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' };
}

// The website (https) calling this local server is a cross-site request to a local address: browsers
// ask first (CORS preflight, including Chrome's Private/Local Network Access check), and we say yes
// only to the allowed origins.
function preflightSignIn(req, res) {
  const origin = req.headers.origin;
  if (!signInOrigins().includes(origin)) { res.writeHead(403); res.end(); return; }
  res.writeHead(204, {
    ...corsHeaders(origin),
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Private-Network': 'true',
    'Access-Control-Max-Age': '600',
  });
  res.end();
}

function completeSignIn(req, res) {
  const origin = req.headers.origin;
  const allowed = signInOrigins().includes(origin);
  const reply = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(allowed ? corsHeaders(origin) : {}) }); res.end(JSON.stringify(body)); };
  if (!allowed) { reply(403, { ok: false }); return; }
  let size = 0;
  const chunks = [];
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) { reply(413, { ok: false }); req.destroy(); return; }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (res.writableEnded) return;
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) { reply(400, { ok: false }); return; }
    if (!pendingSignIn || !sameSecret(body?.state, pendingSignIn.state)) { reply(409, { ok: false, reason: 'expired' }); return; }
    if (typeof body.error === 'string') {
      settleSignIn({ ok: false, reason: 'error', message: body.error.slice(0, 300) });
      reply(200, { ok: true });
      return;
    }
    if (typeof body.idToken !== 'string' || body.idToken.length < 20) { reply(400, { ok: false }); return; }
    settleSignIn({ ok: true, idToken: body.idToken, accessToken: typeof body.accessToken === 'string' ? body.accessToken : undefined });
    reply(200, { ok: true });
    bringAppToFront();
  });
}

function startInternalServer() {
  return new Promise((resolve, reject) => {
    const distDir = getDistPath();

    const handler = (req, res) => {
      try {
        const parsedUrl = new URL(req.url, 'http://localhost');
        if (parsedUrl.pathname === '/desktop-auth/complete') {
          if (req.method === 'POST') completeSignIn(req, res);
          else if (req.method === 'OPTIONS') preflightSignIn(req, res);
          else { res.writeHead(405); res.end(); }
          return;
        }
        let pathname = decodeURIComponent(parsedUrl.pathname);
        let targetFile = path.normalize(path.join(distDir, pathname));

        if (!targetFile.startsWith(distDir)) {
          res.writeHead(403);
          res.end('Access Denied');
          return;
        }

        if (fs.existsSync(targetFile) && fs.statSync(targetFile).isDirectory()) {
          targetFile = path.join(targetFile, 'index.html');
        }

        if (!fs.existsSync(targetFile)) {
          targetFile = path.join(distDir, 'index.html');
        }

        const ext = path.extname(targetFile).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        const content = fs.readFileSync(targetFile);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        });
        res.end(content);
      } catch (err) {
        res.writeHead(500);
        res.end('Error loading asset');
      }
    };

    // Listen on loopback only (IPv4, plus IPv6 where available) so nothing is exposed to the network
    // and Windows Firewall never asks for permission.
    const listen = (port, host) => new Promise((ok, fail) => {
      const server = http.createServer(handler);
      server.once('error', fail);
      server.listen(port, host, () => ok(server));
    });
    const attempt = async (index) => {
      if (index >= PORTS.length) { reject(new Error('AMPlifier could not open a local port.')); return; }
      try {
        const ipv4 = await listen(PORTS[index], '127.0.0.1');
        servers = [ipv4];
        try { servers.push(await listen(PORTS[index], '::1')); } catch (_) { /* no IPv6 loopback */ }
        serverPort = PORTS[index];
        resolve(serverPort);
      } catch (_) {
        attempt(index + 1);
      }
    };
    attempt(0);
  });
}

async function createMainWindow() {
  await startInternalServer();

  // Strip Electron branding from User-Agent so Google OAuth popup is not blocked with disallowed_useragent
  const customUserAgent = session.defaultSession.getUserAgent().replace(/Electron\/[0-9\.]+\s?/, '');

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'AMPlifier — Your academics, amplified.',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#080c1b',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  mainWindow.webContents.setUserAgent(customUserAgent);

  // Smooth appearance once initial DOM is ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle external navigation and OAuth popups
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.startsWith('https://accounts.google.com') ||
      url.includes('firebaseapp.com') ||
      url.startsWith(`http://localhost:${serverPort}`)
    ) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500,
          height: 650,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        }
      };
    }

    // Open any external web links in the user's default browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(`http://localhost:${serverPort}`);
}

// One AMPlifier at a time: a second launch focuses the open window instead of starting another
// server (which would land on a different port, and so a different origin).
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(createMainWindow).catch((error) => {
    console.error(error);
    app.quit();
  });
}

app.on('window-all-closed', () => {
  for (const server of servers) {
    try {
      server.close();
    } catch (_) {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
