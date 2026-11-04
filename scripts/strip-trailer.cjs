// Removes the landing page's trailer from dist/ before it is copied into the Android app, so the APK
// stays small. The website build keeps it. The desktop build excludes it in desktop/electron-builder.json.
const fs = require('node:fs');
const path = require('node:path');

fs.rmSync(path.join(__dirname, '..', 'dist', 'trailer'), { recursive: true, force: true });
