/* eslint-disable @typescript-eslint/no-explicit-any */
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
    emitEvent: vi.fn(),
    onApiCall: vi.fn(),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    notify: vi.fn(),
    getWidgetConfigs: vi.fn(() => [] as ({ id: number } & Record<string, unknown>)[]),
    selectWidget: vi.fn(),
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
    sdk.getWidgetConfigs.mockReturnValue([{ id: 1, slug: 'timer-1', title: 'Pizza Timer', doneNotify: true }]);
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
    sdk.getWidgetConfigs.mockReturnValue([{ id: 1, slug: 'timer-1', title: 'Pizza Timer', doneNotify: true }]);
    connector(sdk as any);
    await callAction(sdk, 'start', { slug: 'timer-1', duration: 10, label: 'Lasagna' });
    vi.advanceTimersByTime(10_000);
    expect(sdk.notify).toHaveBeenCalledWith('Lasagna is done!', { level: 'info' });
  });

  it('does not notify when doneNotify is false', async () => {
    const sdk = makeMockSdk();
    sdk.getWidgetConfigs.mockReturnValue([{ id: 1, slug: 'timer-1', title: 'Pizza Timer', doneNotify: false }]);
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
