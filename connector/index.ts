import type { ServerSdk } from '../hubble-sdk';
import {
  TimerState,
  makeIdleState,
  startTimer,
  pauseTimer,
  resumeTimer,
  resetTimer,
  markDone,
} from './timerState';

const STORAGE_KEY = 'timerStates';

export default function connector(sdk: ServerSdk) {
  const states: Record<string, TimerState> = {};
  const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

  function persist() {
    sdk.storage.set(STORAGE_KEY, JSON.stringify(states));
  }

  function emitAll() {
    sdk.emit('hubble-timer:state', { ...states });
  }

  function getOrCreate(slug: string): TimerState {
    if (!states[slug]) states[slug] = makeIdleState(slug);
    return states[slug];
  }

  function clearDoneTimeout(slug: string) {
    const handle = timeouts.get(slug);
    if (handle != null) {
      clearTimeout(handle);
      timeouts.delete(slug);
    }
  }

  function fireDoneNotify(slug: string) {
    const configs = sdk.getWidgetConfigs() as Record<string, unknown>[];
    const config = configs.find((c) => c['slug'] === slug);
    if (!config) {
      sdk.log.warn(`Done fired for slug "${slug}" but no widget config found`);
      return;
    }
    if (config['doneNotify'] !== false) {
      const label = (states[slug]?.label ?? config['title'] ?? slug) as string;
      sdk.notify(`${label} is done!`, { level: 'info' });
    }
  }

  function fireDone(slug: string) {
    states[slug] = markDone(states[slug]);
    persist();
    emitAll();
    fireDoneNotify(slug);
  }

  function armDoneTimeout(slug: string, remainingMs: number) {
    clearDoneTimeout(slug);
    if (remainingMs <= 0) {
      fireDone(slug);
      return;
    }
    const handle = setTimeout(() => {
      fireDone(slug);
    }, remainingMs);
    timeouts.set(slug, handle);
  }

  // ── Restore from storage ─────────────────────────────────────────
  const stored = sdk.storage.get(STORAGE_KEY);
  if (stored && typeof stored === 'string') {
    try {
      const parsed = JSON.parse(stored) as Record<string, TimerState>;
      for (const [slug, state] of Object.entries(parsed)) {
        states[slug] = state;
        if (state.status === 'running' && state.mode === 'countdown' && state.duration != null) {
          if (state.startedAt == null) {
            sdk.log.warn(`Recovered running timer "${slug}" has null startedAt — firing done immediately`);
            armDoneTimeout(slug, -1);
          } else {
            const remaining = state.startedAt + state.duration - Date.now();
            armDoneTimeout(slug, remaining);
          }
        }
      }
      emitAll();
    } catch (e) {
      sdk.log.error(`Failed to restore timer states: ${e}`);
    }
  }

  // ── API handler ──────────────────────────────────────────────────
  sdk.onApiCall(async ({ action, body }) => {
    // Button presses arrive with { config, payload }; direct API calls send flat body
    const raw = body as Record<string, unknown>;
    const flat = raw.config ? { ...(raw.config as Record<string, unknown>), ...(raw.payload as Record<string, unknown> ?? {}) } : raw;

    // start-available doesn't require a slug — handle before slug check
    if (action === 'start-available') {
      const { duration, label } = flat as { duration?: number; label?: string };
      if (duration == null || !label) return { error: 'Missing duration or label' };
      const configs = sdk.getWidgetConfigs() as Record<string, unknown>[];
      const allSlugs = configs.map((c) => c['slug'] as string).filter(Boolean);
      const availableSlug = allSlugs.find((s) => {
        const state = states[s];
        return !state || state.status === 'idle';
      });
      if (!availableSlug) return { ok: false, error: 'all-busy' };
      clearDoneTimeout(availableSlug);
      states[availableSlug] = startTimer(getOrCreate(availableSlug), { duration, label, now: Date.now() });
      if (states[availableSlug].mode === 'countdown' && states[availableSlug].duration != null) {
        armDoneTimeout(availableSlug, states[availableSlug].duration!);
      }
      persist();
      emitAll();
      return { ok: true, slug: availableSlug };
    }

    const { slug, duration, label } = flat as { slug?: string; duration?: number; label?: string };
    if (!slug) return { error: 'Missing slug' };

    switch (action) {
      case 'start': {
        clearDoneTimeout(slug);
        states[slug] = startTimer(getOrCreate(slug), { duration, label, now: Date.now() });
        if (states[slug].mode === 'countdown' && states[slug].duration != null) {
          armDoneTimeout(slug, states[slug].duration!);
        }
        persist();
        emitAll();
        return { ok: true };
      }
      case 'pause': {
        const state = getOrCreate(slug);
        if (state.status !== 'running') return { error: 'Timer not running' };
        clearDoneTimeout(slug);
        states[slug] = pauseTimer(state, Date.now());
        persist();
        emitAll();
        return { ok: true };
      }
      case 'resume': {
        const state = getOrCreate(slug);
        if (state.status !== 'paused') return { error: 'Timer not paused' };
        states[slug] = resumeTimer(state, Date.now());
        if (states[slug].mode === 'countdown' && states[slug].duration != null) {
          const remaining = states[slug].duration! - states[slug].elapsed;
          armDoneTimeout(slug, remaining);
        }
        persist();
        emitAll();
        return { ok: true };
      }
      case 'toggle': {
        const state = getOrCreate(slug);
        if (state.status === 'running') {
          clearDoneTimeout(slug);
          states[slug] = pauseTimer(state, Date.now());
        } else if (state.status === 'paused') {
          states[slug] = resumeTimer(state, Date.now());
          if (states[slug].mode === 'countdown' && states[slug].duration != null) {
            const remaining = states[slug].duration! - states[slug].elapsed;
            armDoneTimeout(slug, remaining);
          }
        } else {
          return { error: 'Timer not running or paused' };
        }
        persist();
        emitAll();
        return { ok: true };
      }
      case 'reset': {
        clearDoneTimeout(slug);
        states[slug] = resetTimer(getOrCreate(slug));
        persist();
        emitAll();
        return { ok: true };
      }
      default:
        return { error: `Unknown action: ${action}` };
    }
  });
}
