const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let server = null;
let serverPort = null;

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

function startInternalServer() {
  return new Promise((resolve, reject) => {
    const distDir = getDistPath();

    server = http.createServer((req, res) => {
      try {
        const parsedUrl = new URL(req.url, 'http://127.0.0.1');
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
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      serverPort = address.port;
      resolve(serverPort);
    });

    server.on('error', (err) => {
      reject(err);
    });
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
      url.startsWith(`http://127.0.0.1:${serverPort}`)
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

  await mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
}

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (server) {
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
