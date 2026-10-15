/**
 * localStorage / sessionStorage that never throw. Some browsers block site storage when the app is
 * shown inside another site (e.g. a preview panel); the app must keep working there, just without
 * remembering things between page loads.
 */
function safeStorage(kind: 'localStorage' | 'sessionStorage') {
  return {
    get(key: string): string | null {
      try {
        return window[kind].getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string) {
      try {
        window[kind].setItem(key, value);
      } catch {
        // Storage blocked or full: carry on without it.
      }
    },
    remove(key: string) {
      try {
        window[kind].removeItem(key);
      } catch {
        // Storage blocked: nothing to remove.
      }
    },
  };
}

/** Kept across visits (interface language). */
export const localStore = safeStorage('localStorage');
/** Kept for this browser tab only (session token, current class/week selection). */
export const sessionStore = safeStorage('sessionStorage');
