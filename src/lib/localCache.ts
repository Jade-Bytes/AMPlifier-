/** Per-account browser cache. Never authoritative: Firestore is the source of truth for signed-in users. */
const key = (uid: string, name: string) => `amplifier-user-${uid}-${name}`;

export function loadCached<T>(uid: string, name: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key(uid, name));
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

export function saveCached<T>(uid: string, name: string, value: T): void {
  try {
    localStorage.setItem(key(uid, name), JSON.stringify(value));
  } catch {
    // Storage can be full or blocked (private mode). The cache is optional, so ignore.
  }
}
