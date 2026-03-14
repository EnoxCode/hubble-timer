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
