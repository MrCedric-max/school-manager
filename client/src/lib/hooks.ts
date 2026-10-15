import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ensureSessionTransport, hasSessionToken, isEmbedded, preferQueryTransport, sessionTransport, setSessionToken } from './api';
import type { Meta } from './types';

export interface AuthStatus {
  setupRequired: boolean;
  /** `demo` is true for the public demo account (limited: no import, backups or password change). */
  user: { id: number; username: string; demo: boolean } | null;
  school: { name: string; subtitle: string; academicYear: string };
  /** Public demo account shown on the sign-in page (only while the data is invented). */
  demo: { username: string; password: string } | null;
  /** How this request proved who it is — diagnostics for embedded previews (see Settings). */
  session?: {
    /** Channel that carried the session token: `cookie`, `x-session-token`, `authorization` or `query`. */
    via: string | null;
    /** Every channel the request carried a session token in. */
    channels: string[];
    /** True when the request came with an `sm_session` cookie (browsers refuse it in an iframe). */
    cookie: boolean;
    /** True when the app asked for the embedded (partitioned) cookie. */
    embedded: boolean;
  };
}

export function useAuthStatus() {
  return useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      // Before anything authenticated: check which channel reaches the server (only does work when
      // the app is embedded, e.g. in a preview panel).
      await ensureSessionTransport();
      let status = await api.get<AuthStatus>('/auth/status');
      // We hold a token but the server does not recognise it. If the check claimed our headers arrive,
      // it was wrong (proxies can drop them only sometimes): try again over the address channel, and
      // keep it if that works — so signing in still holds where a header quietly disappears.
      if (!status.user && hasSessionToken() && isEmbedded() && sessionTransport() === 'header') {
        preferQueryTransport();
        const retry = await api.get<AuthStatus>('/auth/status');
        if (retry.user) status = retry;
      }
      if (!status.user) setSessionToken(null); // expired, signed out elsewhere, or replaced by a restore
      return status;
    },
    staleTime: Infinity,
  });
}

export function useMeta() {
  return useQuery({ queryKey: ['meta'], queryFn: () => api.get<Meta>('/meta'), staleTime: 60_000 });
}

/** Meta is always loaded before any page renders (see App), so this never returns undefined. */
export function useMetaData(): Meta {
  const { data } = useMeta();
  if (!data) throw new Error('Meta not loaded');
  return data;
}

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/**
 * Collects edits and saves them in batches shortly after the user stops typing.
 * Each item carries its full key, so changing class/week while saving is safe.
 */
export function useBatchSaver<T>(save: (items: T[]) => Promise<unknown>, keyOf: (item: T) => string, delay = 600) {
  const pending = useRef(new Map<string, T>());
  const timer = useRef<number | undefined>(undefined);
  const inFlight = useRef<Promise<void> | null>(null);
  const saveRef = useRef(save);
  const keyRef = useRef(keyOf);
  saveRef.current = save;
  keyRef.current = keyOf;
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    while (inFlight.current) await inFlight.current;
    const items = [...pending.current.values()];
    if (!items.length) return;
    pending.current.clear();
    setState('saving');
    const run = (async () => {
      try {
        await saveRef.current(items);
        setError(null);
        setState(pending.current.size ? 'pending' : 'saved');
      } catch (e) {
        for (const item of items) {
          const k = keyRef.current(item);
          if (!pending.current.has(k)) pending.current.set(k, item);
        }
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    })();
    inFlight.current = run;
    await run;
    inFlight.current = null;
  }, []);

  const queue = useCallback(
    (item: T) => {
      pending.current.set(keyRef.current(item), item);
      setState('pending');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), delay);
    },
    [delay, flush],
  );

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.current.size || inFlight.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      void flush();
    };
  }, [flush]);

  return { queue, flush, state, error };
}
