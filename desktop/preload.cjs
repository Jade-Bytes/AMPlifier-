const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, selected desktop APIs to the renderer
contextBridge.exposeInMainWorld('desktopApp', {
  isDesktop: true,
  platform: process.platform,
  version: process.env.npm_package_version || '0.2.0'
});
