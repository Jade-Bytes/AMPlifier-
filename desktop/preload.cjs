const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, selected desktop APIs to the renderer
contextBridge.exposeInMainWorld('desktopApp', {
  isDesktop: true,
  platform: process.platform,
  version: process.env.npm_package_version || '0.2.0',
  // Google sign-in happens in the default browser; resolves with the Google credential or a reason.
  signInWithGoogle: (scopes) => ipcRenderer.invoke('auth:google', { scopes: Array.isArray(scopes) ? scopes : [] }),
  cancelSignIn: () => ipcRenderer.invoke('auth:cancel')
});
