# Hubble Timer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hybrid Hubble module with a countdown (circular ring) and stopwatch (digital) visualization, API-driven timer management, hardware button control, and configurable done behaviors.

**Architecture:** A connector holds all timer states server-side in memory and `sdk.storage`, handles API calls, and emits state only on changes. Visualizations subscribe to the full state map, filter by their configured `slug`, and compute display time client-side. Done notifications fire from the connector; done expand/flash behaviors fire from the visualization.

**Tech Stack:** TypeScript, React, Vitest, @testing-library/react, SVG for ring, CSS custom properties for theming.

---

## Chunk 1: Manifest + Pure State Logic

### Task 1: Update manifest.json

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Rewrite manifest.json**

```json
{
  "name": "hubble-timer",
  "version": "0.1.0",
  "description": "A cooking timer with countdown and stopwatch modes.",
  "minAppVersion": "0.1.0",
  "type": ["connector", "visualization"],
  "endpoints": [
    {
      "name": "start",
      "method": "POST",
      "path": "/start",
      "description": "Start or restart a timer",
      "body": {
        "type": "object",
        "required": ["slug"],
        "properties": {
          "slug": { "type": "string", "description": "Widget slug to target" },
          "duration": { "type": "number", "description": "Duration in seconds (omit for stopwatch)" },
          "label": { "type": "string", "description": "Optional display label for this run" }
        }
      }
    },
    {
      "name": "pause",
      "method": "POST",
      "path": "/pause",
      "description": "Pause a running timer",
      "body": {
        "type": "object",
        "required": ["slug"],
        "properties": {
          "slug": { "type": "string", "description": "Widget slug to target" }
        }
      }
    },
    {
      "name": "resume",
      "method": "POST",
      "path": "/resume",
      "description": "Resume a paused timer",
      "body": {
        "type": "object",
        "required": ["slug"],
        "properties": {
          "slug": { "type": "string", "description": "Widget slug to target" }
        }
      }
    },
    {
      "name": "reset",
      "method": "POST",
      "path": "/reset",
      "description": "Reset a timer to idle",
      "body": {
        "type": "object",
        "required": ["slug"],
        "properties": {
          "slug": { "type": "string", "description": "Widget slug to target" }
        }
      }
    }
  ],
  "visualizations": [
    {
      "name": "Countdown",
      "description": "Circular ring countdown timer, green to red",
      "path": "countdown",
      "selectable": true,
      "hardwareButtons": {
        "button1": "toggle",
        "button2": "reset"
      },
      "properties": [
        { "name": "title", "type": "string", "required": true, "description": "Display name when no API label is active" },
        { "name": "slug", "type": "string", "required": true, "description": "Stable API identifier (e.g. timer-1)" },
        { "name": "size", "type": "choice", "required": false, "default": "m", "description": "Widget size", "choices": [{"label": "Small", "value": "s"}, {"label": "Medium", "value": "m"}, {"label": "Large", "value": "l"}, {"label": "Extra Large", "value": "xl"}] },
        { "name": "doneNotify", "type": "boolean", "required": false, "default": true, "description": "Send notification when done" },
        { "name": "doneExpand", "type": "boolean", "required": false, "default": false, "description": "Expand full-screen when done (requires hardware button to dismiss)" },
        { "name": "doneFlash", "type": "boolean", "required": false, "default": false, "description": "Flash the widget when done" },
        { "name": "warningThreshold", "type": "range", "required": false, "default": 300, "description": "Seconds remaining when ring turns red", "min": 0, "max": 3600, "step": 30 }
      ]
    },
    {
      "name": "Stopwatch",
      "description": "Digital elapsed time stopwatch",
      "path": "stopwatch",
      "selectable": true,
      "hardwareButtons": {
        "button1": "toggle",
        "button2": "reset"
      },
      "properties": [
        { "name": "title", "type": "string", "required": true, "description": "Display name when no API label is active" },
        { "name": "slug", "type": "string", "required": true, "description": "Stable API identifier (e.g. timer-1)" },
        { "name": "size", "type": "choice", "required": false, "default": "m", "description": "Widget size", "choices": [{"label": "Small", "value": "s"}, {"label": "Medium", "value": "m"}, {"label": "Large", "value": "l"}, {"label": "Extra Large", "value": "xl"}] },
        { "name": "doneNotify", "type": "boolean", "required": false, "default": true, "description": "Send notification when done" },
        { "name": "doneExpand", "type": "boolean", "required": false, "default": false, "description": "Expand full-screen when done (requires hardware button to dismiss)" },
        { "name": "doneFlash", "type": "boolean", "required": false, "default": false, "description": "Flash the widget when done" }
      ]
    }
  ]
}
```

- [ ] **Step 2: Validate manifest**

Run: `npm run validate`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "feat: update manifest with countdown/stopwatch visualizations and API endpoints"
```

---

### Task 2: Pure state-transition logic

**Files:**
- Create: `connector/timerState.ts`
- Modify: `tests/connector.test.ts` (replace scaffold placeholder)
- Delete: `tests/hubble-timer.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/connector.test.ts` (the connector integration tests in Task 3 will expand this same file with more imports and tests — write it now with only the pure-function tests):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import connector from '../connector/index';
import {
  makeIdleState,
  startTimer,
  pauseTimer,
  resumeTimer,
  resetTimer,
  markDone,
  computeDisplayMs,
} from '../connector/timerState';

const NOW = 1_000_000;

describe('makeIdleState', () => {
  it('creates a valid idle state', () => {
    const s = makeIdleState('timer-1');
    expect(s.slug).toBe('timer-1');
    expect(s.status).toBe('idle');
    expect(s.elapsed).toBe(0);
    expect(s.startedAt).toBeNull();
  });
});

describe('startTimer', () => {
  it('creates countdown state when duration is provided', () => {
    const s = startTimer(makeIdleState('t'), { duration: 600, now: NOW });
    expect(s.status).toBe('running');
    expect(s.mode).toBe('countdown');
    expect(s.duration).toBe(600_000);
    expect(s.startedAt).toBe(NOW);
    expect(s.elapsed).toBe(0);
  });

  it('creates stopwatch state when duration is omitted', () => {
    const s = startTimer(makeIdleState('t'), { now: NOW });
    expect(s.status).toBe('running');
    expect(s.mode).toBe('stopwatch');
    expect(s.duration).toBeNull();
  });

  it('sets label when provided', () => {
    const s = startTimer(makeIdleState('t'), { duration: 60, label: 'Pizza', now: NOW });
    expect(s.label).toBe('Pizza');
  });

  it('resets elapsed to 0 on restart', () => {
    const running = startTimer(makeIdleState('t'), { duration: 60, now: NOW });
    const paused = pauseTimer(running, NOW + 10_000);
    const restarted = startTimer(paused, { duration: 60, now: NOW + 20_000 });
    expect(restarted.elapsed).toBe(0);
  });
});

describe('pauseTimer', () => {
  it('accumulates elapsed time', () => {
    const running = startTimer(makeIdleState('t'), { duration: 60, now: NOW });
    const paused = pauseTimer(running, NOW + 5_000);
    expect(paused.status).toBe('paused');
    expect(paused.elapsed).toBe(5_000);
    expect(paused.startedAt).toBeNull();
  });

  it('throws if timer is not running', () => {
    expect(() => pauseTimer(makeIdleState('t'), NOW)).toThrow('Timer not running');
  });
});

describe('resumeTimer', () => {
  it('resumes a paused timer and preserves elapsed', () => {
    const running = startTimer(makeIdleState('t'), { duration: 60, now: NOW });
    const paused = pauseTimer(running, NOW + 5_000);
    const resumed = resumeTimer(paused, NOW + 10_000);
    expect(resumed.status).toBe('running');
    expect(resumed.startedAt).toBe(NOW + 10_000);
    expect(resumed.elapsed).toBe(5_000);
  });

  it('throws if timer is not paused', () => {
    expect(() => resumeTimer(makeIdleState('t'), NOW)).toThrow('Timer not paused');
  });
});

describe('resetTimer', () => {
  it('returns to idle and clears label/elapsed/startedAt, preserves duration', () => {
    const running = startTimer(makeIdleState('t'), { duration: 60, label: 'Pizza', now: NOW });
    const reset = resetTimer(running);
    expect(reset.status).toBe('idle');
    expect(reset.label).toBeNull();
    expect(reset.elapsed).toBe(0);
    expect(reset.startedAt).toBeNull();
    expect(reset.duration).toBe(60_000);
  });
});

describe('markDone', () => {
  it('sets status to done and clears startedAt', () => {
    const running = startTimer(makeIdleState('t'), { duration: 10, now: NOW });
    const done = markDone(running);
    expect(done.status).toBe('done');
    expect(done.startedAt).toBeNull();
  });
});

describe('computeDisplayMs', () => {
  it('returns elapsed for running stopwatch', () => {
    const s = startTimer(makeIdleState('t'), { now: NOW });
    expect(computeDisplayMs(s, NOW + 3_000)).toBe(3_000);
  });

  it('returns elapsed for paused stopwatch', () => {
    const s = pauseTimer(startTimer(makeIdleState('t'), { now: NOW }), NOW + 7_000);
    expect(computeDisplayMs(s, NOW + 99_000)).toBe(7_000);
  });

  it('returns remaining ms for running countdown', () => {
    const s = startTimer(makeIdleState('t'), { duration: 60, now: NOW });
    expect(computeDisplayMs(s, NOW + 10_000)).toBe(50_000);
  });

  it('returns remaining for paused countdown', () => {
    const running = startTimer(makeIdleState('t'), { duration: 60, now: NOW });
    const paused = pauseTimer(running, NOW + 20_000);
    expect(computeDisplayMs(paused, NOW + 99_000)).toBe(40_000);
  });

  it('clamps countdown to 0 (never negative)', () => {
    const s = startTimer(makeIdleState('t'), { duration: 10, now: NOW });
    expect(computeDisplayMs(s, NOW + 999_000)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test`
Expected: FAIL — "Cannot find module '../connector/timerState'"

- [ ] **Step 3: Implement connector/timerState.ts**

```ts
export interface TimerState {
  slug: string;
  label: string | null;
  status: 'idle' | 'running' | 'paused' | 'done';
  mode: 'countdown' | 'stopwatch';
  duration: number | null; // ms
  startedAt: number | null;
  elapsed: number; // ms
}

export function makeIdleState(slug: string): TimerState {
  return {
    slug,
    label: null,
    status: 'idle',
    mode: 'stopwatch',
    duration: null,
    startedAt: null,
    elapsed: 0,
  };
}

export function startTimer(
  state: TimerState,
  params: { duration?: number; label?: string; now: number }
): TimerState {
  const mode: TimerState['mode'] = params.duration != null ? 'countdown' : 'stopwatch';
  return {
    ...state,
    label: params.label ?? null,
    status: 'running',
    mode,
    duration: params.duration != null ? params.duration * 1000 : null,
    startedAt: params.now,
    elapsed: 0,
  };
}

export function pauseTimer(state: TimerState, now: number): TimerState {
  if (state.status !== 'running') throw new Error('Timer not running');
  return {
    ...state,
    status: 'paused',
    elapsed: state.elapsed + (now - (state.startedAt ?? now)),
    startedAt: null,
  };
}

export function resumeTimer(state: TimerState, now: number): TimerState {
  if (state.status !== 'paused') throw new Error('Timer not paused');
  return {
    ...state,
    status: 'running',
    startedAt: now,
  };
}

export function resetTimer(state: TimerState): TimerState {
  return {
    ...state,
    label: null,
    status: 'idle',
    startedAt: null,
    elapsed: 0,
  };
}

export function markDone(state: TimerState): TimerState {
  return {
    ...state,
    status: 'done',
    startedAt: null,
  };
}

/**
 * Compute the display value in milliseconds.
 * - Stopwatch: total elapsed (count up)
 * - Countdown: remaining time (count down)
 */
export function computeDisplayMs(state: TimerState, now: number): number {
  const totalElapsed =
    state.status === 'running'
      ? state.elapsed + (now - (state.startedAt ?? now))
      : state.elapsed;
  if (state.mode === 'countdown' && state.duration != null) {
    return Math.max(0, state.duration - totalElapsed);
  }
  return totalElapsed;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm test`
Expected: All 13 tests in `tests/connector.test.ts` PASS.

- [ ] **Step 5: Delete scaffold file and commit**

```bash
rm tests/hubble-timer.test.tsx
git add connector/timerState.ts tests/connector.test.ts
git rm tests/hubble-timer.test.tsx
git commit -m "feat: add pure timer state-transition functions with tests"
```

---

## Chunk 2: Connector

### Task 3: Full connector with API, storage recovery, and done timeouts

**Files:**
- Modify: `connector/index.ts`
- Modify: `tests/connector.test.ts` (append connector integration tests)

- [ ] **Step 1: Replace tests/connector.test.ts with the complete file**

Write the entire file — do not append. All imports must be at the top:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import connector from '../connector/index';
import {
  makeIdleState,
  startTimer,
  pauseTimer,
  resumeTimer,
  resetTimer,
  markDone,
  computeDisplayMs,
} from '../connector/timerState';

// ─── Connector integration helpers ───────────────────────────────────────────

type MockSdk = ReturnType<typeof makeMockSdk>;

// storedStates is a JSON string (as sdk.storage.get returns) or null
function makeMockSdk(storedStates?: string | null) {
  return {
    emit: vi.fn(),
    onApiCall: vi.fn(),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    notify: vi.fn(),
    getWidgetConfigs: vi.fn(() => [] as Record<string, unknown>[]),
    storage: {
      get: vi.fn((key: string) => (key === 'timerStates' ? (storedStates ?? null) : null)),
      set: vi.fn(),
      delete: vi.fn(),
      collection: vi.fn(),
    },
  };
}

async function callAction(sdk: MockSdk, action: string, body: Record<string, unknown>) {
  const handler = sdk.onApiCall.mock.calls[0][0];
  return handler({ action, params: {}, body });
}

describe('connector: API actions', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('start creates a running countdown and emits state', async () => {
    const sdk = makeMockSdk();
    connector(sdk as any);
    const result = await callAction(sdk, 'start', { slug: 'timer-1', duration: 60, label: 'Pizza' });
    expect(result).toEqual({ ok: true });
    expect(sdk.emit).toHaveBeenCalledWith('hubble-timer:state', expect.objectContaining({
      'timer-1': expect.objectContaining({ status: 'running', mode: 'countdown', label: 'Pizza' }),
    }));
    expect(sdk.storage.set).toHaveBeenCalledWith('timerStates', expect.any(String));
  });

  it('start with no duration creates a stopwatch', async () => {
    const sdk = makeMockSdk();
    connector(sdk as any);
    await callAction(sdk, 'start', { slug: 'sw-1' });
    expect(sdk.emit).toHaveBeenCalledWith('hubble-timer:state', expect.objectContaining({
      'sw-1': expect.objectContaining({ status: 'running', mode: 'stopwatch' }),
    }));
  });

  it('pause accumulates elapsed time', async () => {
    const sdk = makeMockSdk();
    connector(sdk as any);
    await callAction(sdk, 'start', { slug: 'timer-1', duration: 60 });
    vi.advanceTimersByTime(10_000);
    const result = await callAction(sdk, 'pause', { slug: 'timer-1' });
    expect(result).toEqual({ ok: true });
    expect(sdk.emit).toHaveBeenLastCalledWith('hubble-timer:state', expect.objectContaining({
      'timer-1': expect.objectContaining({ status: 'paused', elapsed: 10_000 }),
    }));
  });

  it('pause returns error if timer is not running', async () => {
    const sdk = makeMockSdk();
    connector(sdk as any);
    const result = await callAction(sdk, 'pause', { slug: 'timer-1' });
    expect(result).toEqual({ error: 'Timer not running' });
  });

  it('resume re-arms the countdown and emits running state', async () => {
    const sdk = makeMockSdk();
    connector(sdk as any);
    await callAction(sdk, 'start', { slug: 'timer-1', duration: 60 });
    await callAction(sdk, 'pause', { slug: 'timer-1' });
    const result = await callAction(sdk, 'resume', { slug: 'timer-1' });
    expect(result).toEqual({ ok: true });
    expect(sdk.emit).toHaveBeenLastCalledWith('hubble-timer:state', expect.objectContaining({
      'timer-1': expect.objectContaining({ status: 'running' }),
    }));
  });

  it('resume returns error if timer is not paused', async () => {
    const sdk = makeMockSdk();
    connector(sdk as any);
    const result = await callAction(sdk, 'resume', { slug: 'timer-1' });
    expect(result).toEqual({ error: 'Timer not paused' });
  });

  it('reset returns timer to idle and clears label', async () => {
    const sdk = makeMockSdk();
    connector(sdk as any);
    await callAction(sdk, 'start', { slug: 'timer-1', duration: 60, label: 'Pizza' });
    const result = await callAction(sdk, 'reset', { slug: 'timer-1' });
    expect(result).toEqual({ ok: true });
    expect(sdk.emit).toHaveBeenLastCalledWith('hubble-timer:state', expect.objectContaining({
      'timer-1': expect.objectContaining({ status: 'idle', label: null }),
    }));
  });

  it('fires done event when countdown expires', async () => {
    const sdk = makeMockSdk();
    sdk.getWidgetConfigs.mockReturnValue([{ slug: 'timer-1', title: 'Pizza Timer', doneNotify: true }]);
    connector(sdk as any);
    await callAction(sdk, 'start', { slug: 'timer-1', duration: 10 });
    vi.advanceTimersByTime(10_000);
    expect(sdk.emit).toHaveBeenLastCalledWith('hubble-timer:state', expect.objectContaining({
      'timer-1': expect.objectContaining({ status: 'done' }),
    }));
    expect(sdk.notify).toHaveBeenCalledWith('Pizza Timer is done!', { level: 'info' });
  });

  it('uses API label for done notification when label is set', async () => {
    const sdk = makeMockSdk();
    sdk.getWidgetConfigs.mockReturnValue([{ slug: 'timer-1', title: 'Pizza Timer', doneNotify: true }]);
    connector(sdk as any);
    await callAction(sdk, 'start', { slug: 'timer-1', duration: 10, label: 'Lasagna' });
    vi.advanceTimersByTime(10_000);
    expect(sdk.notify).toHaveBeenCalledWith('Lasagna is done!', { level: 'info' });
  });

  it('does not notify when doneNotify is false', async () => {
    const sdk = makeMockSdk();
    sdk.getWidgetConfigs.mockReturnValue([{ slug: 'timer-1', title: 'Pizza Timer', doneNotify: false }]);
    connector(sdk as any);
    await callAction(sdk, 'start', { slug: 'timer-1', duration: 10 });
    vi.advanceTimersByTime(10_000);
    expect(sdk.notify).not.toHaveBeenCalled();
  });

  it('restart cancels previous timeout — no double-fire', async () => {
    const sdk = makeMockSdk();
    connector(sdk as any);
    await callAction(sdk, 'start', { slug: 'timer-1', duration: 10 });
    await callAction(sdk, 'start', { slug: 'timer-1', duration: 20 });
    vi.advanceTimersByTime(15_000);
    const doneCalls = sdk.emit.mock.calls.filter(
      ([, s]: [string, Record<string, unknown>]) => (s['timer-1'] as any)?.status === 'done'
    );
    expect(doneCalls.length).toBe(0);
    vi.advanceTimersByTime(10_000);
    expect(sdk.emit).toHaveBeenLastCalledWith('hubble-timer:state', expect.objectContaining({
      'timer-1': expect.objectContaining({ status: 'done' }),
    }));
  });

  it('returns error for unknown action', async () => {
    const sdk = makeMockSdk();
    connector(sdk as any);
    const result = await callAction(sdk, 'explode', { slug: 'timer-1' });
    expect(result).toEqual({ error: 'Unknown action: explode' });
  });
});

describe('connector: storage recovery', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('restores running countdown and re-arms timeout for remaining duration', () => {
    const startedAt = Date.now() - 10_000;
    const stored = JSON.stringify({
      'timer-1': { slug: 'timer-1', label: null, status: 'running', mode: 'countdown', duration: 30_000, startedAt, elapsed: 0 },
    });
    const sdk = makeMockSdk(stored);
    connector(sdk as any);
    expect(sdk.emit).toHaveBeenCalledWith('hubble-timer:state', expect.objectContaining({
      'timer-1': expect.objectContaining({ status: 'running' }),
    }));
    vi.advanceTimersByTime(20_000);
    expect(sdk.emit).toHaveBeenLastCalledWith('hubble-timer:state', expect.objectContaining({
      'timer-1': expect.objectContaining({ status: 'done' }),
    }));
  });

  it('fires done immediately if recovered countdown has already expired', () => {
    const startedAt = Date.now() - 120_000;
    const stored = JSON.stringify({
      'timer-1': { slug: 'timer-1', label: null, status: 'running', mode: 'countdown', duration: 30_000, startedAt, elapsed: 0 },
    });
    const sdk = makeMockSdk(stored);
    connector(sdk as any);
    expect(sdk.emit).toHaveBeenLastCalledWith('hubble-timer:state', expect.objectContaining({
      'timer-1': expect.objectContaining({ status: 'done' }),
    }));
  });

  it('restores paused timer as-is with no timeout', () => {
    const stored = JSON.stringify({
      'timer-1': { slug: 'timer-1', label: 'Pizza', status: 'paused', mode: 'countdown', duration: 60_000, startedAt: null, elapsed: 20_000 },
    });
    const sdk = makeMockSdk(stored);
    connector(sdk as any);
    expect(sdk.emit).toHaveBeenCalledWith('hubble-timer:state', expect.objectContaining({
      'timer-1': expect.objectContaining({ status: 'paused', elapsed: 20_000 }),
    }));
    vi.advanceTimersByTime(999_000);
    const doneCalls = sdk.emit.mock.calls.filter(
      ([, s]: [string, Record<string, unknown>]) => (s['timer-1'] as any)?.status === 'done'
    );
    expect(doneCalls.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm new tests fail**

Run: `npm test`
Expected: New connector integration tests FAIL — "connector/index does not export default"

- [ ] **Step 3: Rewrite connector/index.ts**

```ts
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
    if (!config) return;
    if (config['doneNotify'] !== false) {
      const label = (states[slug]?.label ?? config['title'] ?? slug) as string;
      sdk.notify(`${label} is done!`, { level: 'info' });
    }
  }

  function armDoneTimeout(slug: string, remainingMs: number) {
    clearDoneTimeout(slug);
    const handle = setTimeout(() => {
      states[slug] = markDone(states[slug]);
      persist();
      emitAll();
      fireDoneNotify(slug);
    }, Math.max(0, remainingMs));
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
          const remaining = (state.startedAt ?? 0) + state.duration - Date.now();
          armDoneTimeout(slug, remaining);
        }
      }
      emitAll();
    } catch (e) {
      sdk.log.error(`Failed to restore timer states: ${e}`);
    }
  }

  // ── API handler ──────────────────────────────────────────────────
  sdk.onApiCall(async ({ action, params: _params, body }) => {
    const { slug, duration, label } = body as { slug?: string; duration?: number; label?: string };
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
```

- [ ] **Step 4: Run all tests and confirm they pass**

Run: `npm test`
Expected: All tests PASS (pure state tests + connector integration tests).

- [ ] **Step 5: Commit**

```bash
git add connector/index.ts tests/connector.test.ts
git commit -m "feat: implement connector with API handler, done timeouts, and storage recovery"
```

---

## Chunk 3: Countdown Visualization

### Task 4: Countdown circular ring visualization

**Files:**
- Create: `visualizations/countdown/index.tsx`
- Create: `visualizations/countdown/style.css`
- Create: `tests/visualizations/countdown.test.tsx`

- [ ] **Step 1: Create test file**

Create `tests/visualizations/countdown.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useConnectorData, useWidgetConfig, useHubbleSDK } from '@hubble/sdk';
import CountdownViz from '../../visualizations/countdown/index';

vi.mock('@hubble/sdk', () => ({
  useConnectorData: vi.fn(),
  useWidgetConfig: vi.fn(),
  useHubbleSDK: vi.fn(() => ({ onButton: vi.fn(() => vi.fn()), requestAcknowledge: vi.fn() })),
}));

const mockData = useConnectorData as ReturnType<typeof vi.fn>;
const mockConfig = useWidgetConfig as ReturnType<typeof vi.fn>;

function setConfig(overrides = {}) {
  mockConfig.mockReturnValue({
    slug: 'timer-1', title: 'Pizza', size: 'm',
    doneNotify: true, doneExpand: false, doneFlash: false, warningThreshold: 300,
    ...overrides,
  });
}

function setTimer(overrides = {}) {
  mockData.mockReturnValue({
    'timer-1': {
      slug: 'timer-1', label: null, status: 'idle', mode: 'countdown',
      duration: null, startedAt: null, elapsed: 0,
      ...overrides,
    },
  });
}

beforeEach(() => { setConfig(); setTimer(); });

describe('idle state', () => {
  it('shows --:-- and WAITING', () => {
    render(<CountdownViz />);
    expect(screen.getByText('--:--')).toBeInTheDocument();
    expect(screen.getByText('WAITING')).toBeInTheDocument();
  });
});

describe('running state', () => {
  it('shows REMAINING and label', () => {
    setTimer({ status: 'running', label: 'Pizza', duration: 600_000, startedAt: Date.now(), elapsed: 0 });
    render(<CountdownViz />);
    expect(screen.getByText('REMAINING')).toBeInTheDocument();
    expect(screen.getByText('Pizza')).toBeInTheDocument();
  });

  it('falls back to title when label is null', () => {
    setConfig({ slug: 'timer-1', title: 'Oven Timer', size: 'm', doneNotify: true, doneExpand: false, doneFlash: false, warningThreshold: 300 });
    setTimer({ status: 'running', label: null, duration: 600_000, startedAt: Date.now(), elapsed: 0 });
    render(<CountdownViz />);
    expect(screen.getByText('Oven Timer')).toBeInTheDocument();
  });
});

describe('paused state', () => {
  it('shows PAUSED', () => {
    setTimer({ status: 'paused', duration: 600_000, elapsed: 10_000 });
    render(<CountdownViz />);
    expect(screen.getByText('PAUSED')).toBeInTheDocument();
  });
});

describe('done state', () => {
  it('shows 00:00 and DONE', () => {
    setTimer({ status: 'done', duration: 600_000, elapsed: 600_000 });
    render(<CountdownViz />);
    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(screen.getByText('DONE')).toBeInTheDocument();
  });

  it('applies countdown--done class', () => {
    setTimer({ status: 'done', duration: 600_000, elapsed: 600_000 });
    const { container } = render(<CountdownViz />);
    expect(container.firstChild).toHaveClass('countdown--done');
  });

  it('applies countdown--flash when doneFlash is true', () => {
    setConfig({ doneFlash: true });
    setTimer({ status: 'done', duration: 600_000, elapsed: 600_000 });
    const { container } = render(<CountdownViz />);
    expect(container.firstChild).toHaveClass('countdown--flash');
  });
});

describe('size prop', () => {
  it('applies countdown--l class when size is l', () => {
    setConfig({ size: 'l' });
    const { container } = render(<CountdownViz />);
    expect(container.firstChild).toHaveClass('countdown--l');
  });
});

describe('slug filtering', () => {
  it('shows idle when state map has no entry for this slug', () => {
    mockData.mockReturnValue({ 'other': { slug: 'other', status: 'running' } });
    render(<CountdownViz />);
    expect(screen.getByText('WAITING')).toBeInTheDocument();
  });

  it('shows idle when connector data is null', () => {
    mockData.mockReturnValue(null);
    render(<CountdownViz />);
    expect(screen.getByText('WAITING')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm tests fail**

Run: `npm test tests/visualizations/countdown.test.tsx`
Expected: FAIL — "Cannot find module '../../visualizations/countdown/index'"

- [ ] **Step 3: Create directory and style.css**

```bash
mkdir -p visualizations/countdown
```

Create `visualizations/countdown/style.css`:

```css
/* ── Container ─────────────────────────────────────────── */
.countdown {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px;
}

/* ── Size variants (CSS custom properties for SVG scaling) */
.countdown--s  { --ring-size: 80px;  --ring-font: 14px; }
.countdown--m  { --ring-size: 108px; --ring-font: 19px; }
.countdown--l  { --ring-size: 140px; --ring-font: 26px; }
.countdown--xl { --ring-size: 180px; --ring-font: 34px; }

/* ── Label above ring ──────────────────────────────────── */
.countdown__label {
  font-size: 12px;
  letter-spacing: 2.5px;
  color: rgba(255, 255, 255, 0.75);
  text-transform: uppercase;
  font-weight: 600;
}

.countdown__label--faded {
  color: rgba(255, 255, 255, 0.3);
}

/* ── SVG ring wrapper ──────────────────────────────────── */
.countdown__ring {
  width: var(--ring-size);
  height: var(--ring-size);
}

/* ── Time text (SVG) ───────────────────────────────────── */
.countdown__time {
  font-size: var(--ring-font);
  font-weight: 800;
  font-family: monospace;
  fill: rgba(255, 255, 255, 0.95);
}

.countdown__time--faded { fill: rgba(255, 255, 255, 0.45); }
.countdown__time--done  { fill: var(--hubble-danger); }

/* ── Sub-label text (SVG) ──────────────────────────────── */
.countdown__sublabel {
  font-size: 8px;
  letter-spacing: 2px;
  fill: rgba(255, 255, 255, 0.35);
  text-transform: uppercase;
}

.countdown__sublabel--paused { fill: var(--hubble-warning); }
.countdown__sublabel--done   { fill: var(--hubble-danger); }

/* ── Ring track ────────────────────────────────────────── */
.countdown__track {
  fill: none;
  stroke: rgba(255, 255, 255, 0.08);
}

.countdown__track--done { stroke: transparent; }

/* ── Ring arc ──────────────────────────────────────────── */
.countdown__arc {
  fill: none;
  stroke: var(--hubble-success);
  stroke-linecap: round;
  transition: stroke-dasharray 0.5s linear;
}

.countdown__arc--red    { stroke: var(--hubble-danger); }
.countdown__arc--dimmed { opacity: 0.25; }
.countdown__arc--dashed { stroke: rgba(255, 255, 255, 0.15); }

/* ── Done state: subtle red outline on panel ───────────── */
.countdown--done {
  outline: 1px solid rgba(231, 76, 60, 0.4);
  border-radius: var(--hubble-radius-lg);
}

/* ── Flash animation ───────────────────────────────────── */
@keyframes countdown-flash {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.2; }
}

.countdown--flash {
  animation: countdown-flash 0.8s ease-in-out infinite;
}
```

- [ ] **Step 4: Create visualizations/countdown/index.tsx**

```tsx
import React, { useEffect, useRef } from 'react';
import { useConnectorData, useWidgetConfig, useHubbleSDK } from '@hubble/sdk';
import { TimerState, computeDisplayMs } from '../../connector/timerState';
import './style.css';

interface CountdownConfig {
  slug: string;
  title: string;
  size: 's' | 'm' | 'l' | 'xl';
  doneExpand: boolean;
  doneFlash: boolean;
  warningThreshold: number;
}

const RING_RADIUS = 44;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const VIEWBOX = 100;
const CX = VIEWBOX / 2;
const CY = VIEWBOX / 2;

function formatTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function CountdownViz() {
  const allStates = useConnectorData<Record<string, TimerState>>();
  const config = useWidgetConfig<CountdownConfig>();
  const sdk = useHubbleSDK();
  const timerRef = useRef<TimerState | null>(null);

  const timer: TimerState | null = allStates?.[config.slug] ?? null;
  timerRef.current = timer;

  // Hardware buttons
  useEffect(() => {
    const unsubToggle = sdk.onButton('button1', async () => {
      const action = timerRef.current?.status === 'running' ? 'pause' : 'resume';
      await fetch(`/api/modules/hubble-timer/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: config.slug }),
      });
    });
    const unsubReset = sdk.onButton('button2', async () => {
      await fetch('/api/modules/hubble-timer/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: config.slug }),
      });
    });
    return () => { unsubToggle(); unsubReset(); };
  }, [sdk, config.slug]);

  // Done expand behavior (client-side presentation API)
  useEffect(() => {
    if (timer?.status === 'done' && config.doneExpand) {
      sdk.requestAcknowledge();
    }
  }, [timer?.status, config.doneExpand, sdk]);

  // ── Derived display values ─────────────────────────────
  const status = timer?.status ?? 'idle';
  const label = timer?.label ?? config.title;
  const size = config.size ?? 'm';
  const warningMs = (config.warningThreshold ?? 300) * 1000;

  let displayMs = 0;
  let arcRatio = 0;
  let timeText = '--:--';

  if (status === 'done') {
    timeText = '00:00';
    arcRatio = 0;
  } else if (status !== 'idle' && timer) {
    displayMs = computeDisplayMs(timer, Date.now());
    timeText = formatTime(displayMs);
    if (timer.duration) arcRatio = displayMs / timer.duration;
  }

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isDone = status === 'done';
  const isIdle = status === 'idle';
  const isRed = isRunning && displayMs <= warningMs && displayMs > 0;
  const doFlash = isDone && config.doneFlash;

  const arcLength = arcRatio * RING_CIRCUMFERENCE;
  const gapLength = RING_CIRCUMFERENCE - arcLength;

  const containerClass = [
    'countdown',
    `countdown--${size}`,
    isDone ? 'countdown--done' : '',
    doFlash ? 'countdown--flash' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClass}>
      {!isIdle && (
        <span className={`countdown__label${isPaused || isDone ? ' countdown__label--faded' : ''}`}>
          {label}
        </span>
      )}
      <svg
        className="countdown__ring"
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className={`countdown__track${isDone ? ' countdown__track--done' : ''}`}
          cx={CX} cy={CY} r={RING_RADIUS} strokeWidth={8}
        />
        {!isDone && (
          <circle
            className={[
              'countdown__arc',
              isIdle ? 'countdown__arc--dashed' : '',
              isRed ? 'countdown__arc--red' : '',
              isPaused ? 'countdown__arc--dimmed' : '',
            ].filter(Boolean).join(' ')}
            cx={CX} cy={CY} r={RING_RADIUS} strokeWidth={8}
            strokeDasharray={isIdle ? '7 5' : `${arcLength} ${gapLength}`}
            strokeDashoffset={0}
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        )}
        <text
          className={[
            'countdown__time',
            isPaused ? 'countdown__time--faded' : '',
            isDone ? 'countdown__time--done' : '',
          ].filter(Boolean).join(' ')}
          x={CX} y={CY - 5}
          textAnchor="middle" dominantBaseline="middle"
        >
          {timeText}
        </text>
        <text
          className={[
            'countdown__sublabel',
            isDone ? 'countdown__sublabel--done' : '',
            isPaused ? 'countdown__sublabel--paused' : '',
          ].filter(Boolean).join(' ')}
          x={CX} y={CY + 13}
          textAnchor="middle"
        >
          {isDone ? 'DONE' : isPaused ? 'PAUSED' : isIdle ? 'WAITING' : 'REMAINING'}
        </text>
      </svg>
    </div>
  );
}
```

- [ ] **Step 5: Run tests and confirm they pass**

Run: `npm test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add visualizations/countdown/ tests/visualizations/countdown.test.tsx
git commit -m "feat: add countdown circular ring visualization with tests"
```

---

## Chunk 4: Stopwatch Visualization + Cleanup

### Task 5: Stopwatch digital visualization

**Files:**
- Create: `visualizations/stopwatch/index.tsx`
- Create: `visualizations/stopwatch/style.css`
- Create: `tests/visualizations/stopwatch.test.tsx`

- [ ] **Step 1: Create test file**

Create `tests/visualizations/stopwatch.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useConnectorData, useWidgetConfig, useHubbleSDK } from '@hubble/sdk';
import StopwatchViz from '../../visualizations/stopwatch/index';

vi.mock('@hubble/sdk', () => ({
  useConnectorData: vi.fn(),
  useWidgetConfig: vi.fn(),
  useHubbleSDK: vi.fn(() => ({ onButton: vi.fn(() => vi.fn()), requestAcknowledge: vi.fn() })),
}));

const mockData = useConnectorData as ReturnType<typeof vi.fn>;
const mockConfig = useWidgetConfig as ReturnType<typeof vi.fn>;

function setConfig(overrides = {}) {
  mockConfig.mockReturnValue({
    slug: 'sw-1', title: 'Soup', size: 'm',
    doneExpand: false, doneFlash: false,
    ...overrides,
  });
}

function setTimer(overrides = {}) {
  mockData.mockReturnValue({
    'sw-1': {
      slug: 'sw-1', label: null, status: 'idle', mode: 'stopwatch',
      duration: null, startedAt: null, elapsed: 0,
      ...overrides,
    },
  });
}

beforeEach(() => { setConfig(); setTimer(); });

describe('idle state', () => {
  it('shows --:-- and WAITING', () => {
    render(<StopwatchViz />);
    expect(screen.getByText('--:--')).toBeInTheDocument();
    expect(screen.getByText('WAITING')).toBeInTheDocument();
  });
});

describe('running state', () => {
  it('shows ELAPSED and label', () => {
    setTimer({ status: 'running', label: 'Soup', startedAt: Date.now(), elapsed: 0 });
    render(<StopwatchViz />);
    expect(screen.getByText('ELAPSED')).toBeInTheDocument();
    expect(screen.getByText('Soup')).toBeInTheDocument();
  });

  it('falls back to title when label is null', () => {
    setConfig({ slug: 'sw-1', title: 'Stock Pot', size: 'm', doneExpand: false, doneFlash: false });
    setTimer({ status: 'running', label: null, startedAt: Date.now(), elapsed: 0 });
    render(<StopwatchViz />);
    expect(screen.getByText('Stock Pot')).toBeInTheDocument();
  });
});

describe('paused state', () => {
  it('shows PAUSED', () => {
    setTimer({ status: 'paused', elapsed: 12_000 });
    render(<StopwatchViz />);
    expect(screen.getByText('PAUSED')).toBeInTheDocument();
  });

  it('applies stopwatch--paused class', () => {
    setTimer({ status: 'paused', elapsed: 12_000 });
    const { container } = render(<StopwatchViz />);
    expect(container.firstChild).toHaveClass('stopwatch--paused');
  });
});

describe('size prop', () => {
  it('applies stopwatch--xl class when size is xl', () => {
    setConfig({ size: 'xl' });
    const { container } = render(<StopwatchViz />);
    expect(container.firstChild).toHaveClass('stopwatch--xl');
  });
});

describe('slug filtering', () => {
  it('shows idle when no entry for this slug', () => {
    mockData.mockReturnValue({ 'other': { slug: 'other', status: 'running' } });
    render(<StopwatchViz />);
    expect(screen.getByText('WAITING')).toBeInTheDocument();
  });

  it('shows idle when connector data is null', () => {
    mockData.mockReturnValue(null);
    render(<StopwatchViz />);
    expect(screen.getByText('WAITING')).toBeInTheDocument();
  });
});

describe('flash', () => {
  it('applies stopwatch--flash class when doneFlash true and status done', () => {
    setConfig({ doneFlash: true });
    setTimer({ status: 'done', elapsed: 0 });
    const { container } = render(<StopwatchViz />);
    expect(container.firstChild).toHaveClass('stopwatch--flash');
  });
});
```

- [ ] **Step 2: Run to confirm tests fail**

Run: `npm test tests/visualizations/stopwatch.test.tsx`
Expected: FAIL — "Cannot find module '../../visualizations/stopwatch/index'"

- [ ] **Step 3: Create directory and style.css**

```bash
mkdir -p visualizations/stopwatch
```

Create `visualizations/stopwatch/style.css`:

```css
/* ── Container ─────────────────────────────────────────── */
.stopwatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 24px 20px;
}

/* ── Size variants ─────────────────────────────────────── */
.stopwatch--s  { --sw-font: 32px; }
.stopwatch--m  { --sw-font: 42px; }
.stopwatch--l  { --sw-font: 56px; }
.stopwatch--xl { --sw-font: 72px; }

/* ── Label ─────────────────────────────────────────────── */
.stopwatch__label {
  font-size: 12px;
  letter-spacing: 2.5px;
  color: rgba(255, 255, 255, 0.75);
  text-transform: uppercase;
  font-weight: 600;
}

/* ── Time digits ───────────────────────────────────────── */
.stopwatch__time {
  font-size: var(--sw-font);
  font-weight: 800;
  color: rgba(255, 255, 255, 0.95);
  font-family: monospace;
  letter-spacing: 2px;
  line-height: 1;
}

.stopwatch__time--faded { color: rgba(255, 255, 255, 0.2); }

/* ── Sub-label ─────────────────────────────────────────── */
.stopwatch__sublabel {
  font-size: 9px;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.35);
  text-transform: uppercase;
  margin-top: 2px;
}

.stopwatch__sublabel--waiting { color: rgba(255, 255, 255, 0.2); }
.stopwatch__sublabel--paused  { color: var(--hubble-warning); }

/* ── Paused state dims the time ────────────────────────── */
.stopwatch--paused .stopwatch__time { color: rgba(255, 255, 255, 0.4); }

/* ── Flash animation ───────────────────────────────────── */
@keyframes stopwatch-flash {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.2; }
}

.stopwatch--flash {
  animation: stopwatch-flash 0.8s ease-in-out infinite;
}
```

- [ ] **Step 4: Create visualizations/stopwatch/index.tsx**

```tsx
import React, { useEffect, useRef } from 'react';
import { useConnectorData, useWidgetConfig, useHubbleSDK } from '@hubble/sdk';
import { TimerState, computeDisplayMs } from '../../connector/timerState';
import './style.css';

interface StopwatchConfig {
  slug: string;
  title: string;
  size: 's' | 'm' | 'l' | 'xl';
  doneExpand: boolean;
  doneFlash: boolean;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function StopwatchViz() {
  const allStates = useConnectorData<Record<string, TimerState>>();
  const config = useWidgetConfig<StopwatchConfig>();
  const sdk = useHubbleSDK();
  const timerRef = useRef<TimerState | null>(null);

  const timer: TimerState | null = allStates?.[config.slug] ?? null;
  timerRef.current = timer;

  // Hardware buttons
  useEffect(() => {
    const unsubToggle = sdk.onButton('button1', async () => {
      const action = timerRef.current?.status === 'running' ? 'pause' : 'resume';
      await fetch(`/api/modules/hubble-timer/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: config.slug }),
      });
    });
    const unsubReset = sdk.onButton('button2', async () => {
      await fetch('/api/modules/hubble-timer/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: config.slug }),
      });
    });
    return () => { unsubToggle(); unsubReset(); };
  }, [sdk, config.slug]);

  // Done expand behavior
  useEffect(() => {
    if (timer?.status === 'done' && config.doneExpand) {
      sdk.requestAcknowledge();
    }
  }, [timer?.status, config.doneExpand, sdk]);

  // ── Derived display values ─────────────────────────────
  const status = timer?.status ?? 'idle';
  const label = timer?.label ?? config.title;
  const size = config.size ?? 'm';
  const isIdle = status === 'idle';
  const isPaused = status === 'paused';
  const isDone = status === 'done';
  const doFlash = isDone && config.doneFlash;

  let timeText = '--:--';
  if (!isIdle && timer) {
    timeText = formatTime(computeDisplayMs(timer, Date.now()));
  }

  const containerClass = [
    'stopwatch',
    `stopwatch--${size}`,
    isPaused ? 'stopwatch--paused' : '',
    doFlash ? 'stopwatch--flash' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClass}>
      {!isIdle && (
        <span className="stopwatch__label">{label}</span>
      )}
      <span className={`stopwatch__time${isIdle ? ' stopwatch__time--faded' : ''}`}>
        {timeText}
      </span>
      <span className={[
        'stopwatch__sublabel',
        isIdle ? 'stopwatch__sublabel--waiting' : '',
        isPaused ? 'stopwatch__sublabel--paused' : '',
      ].filter(Boolean).join(' ')}>
        {isIdle ? 'WAITING' : isPaused ? 'PAUSED' : 'ELAPSED'}
      </span>
    </div>
  );
}
```

- [ ] **Step 5: Run all tests and confirm they pass**

Run: `npm test`
Expected: All tests PASS across all 4 test files.

- [ ] **Step 6: Remove old default visualization**

The scaffold `visualizations/default/` is superseded. Verify manifest no longer references `"default"` path:

```bash
grep '"default"' manifest.json
```

Expected: No output. Then stage the removal:

```bash
git rm -r visualizations/default/
```

Expected: `rm 'visualizations/default/index.tsx'` and `rm 'visualizations/default/style.css'`

- [ ] **Step 7: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 8: Final test run**

Run: `npm test`
Expected: All tests PASS. Confirm test count across:
- `tests/connector.test.ts` — ~20 tests
- `tests/visualizations/countdown.test.tsx` — ~10 tests
- `tests/visualizations/stopwatch.test.tsx` — ~9 tests

- [ ] **Step 9: Commit**

```bash
git add visualizations/stopwatch/ tests/visualizations/stopwatch.test.tsx
git commit -m "feat: add stopwatch digital visualization with tests"
```

The `visualizations/default/` removal was staged by `git rm` in Step 6 — commit it now:

```bash
git commit -m "chore: remove scaffold default visualization"
```
