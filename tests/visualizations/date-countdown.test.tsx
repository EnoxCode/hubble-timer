import { describe, it, expect } from 'vitest';
import { computeTimeRemaining, getPrecisionTier } from '../../visualizations/date-countdown/index';

const MS = {
  sec: 1000,
  min: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
};

describe('computeTimeRemaining', () => {
  it('returns done:true when target is in the past', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(computeTimeRemaining(past, Date.now()).done).toBe(true);
  });

  it('returns done:true when target is exactly now', () => {
    const now = Date.now();
    expect(computeTimeRemaining(new Date(now).toISOString(), now).done).toBe(true);
  });

  it('returns done:false and correct breakdown for a future target', () => {
    const now = Date.now();
    const target = new Date(now + 3 * MS.day + 2 * MS.hour + 30 * MS.min).toISOString();
    const result = computeTimeRemaining(target, now);
    expect(result.done).toBe(false);
    expect(result.days).toBe(3);
    expect(result.hours).toBe(2);
    expect(result.minutes).toBe(30);
    expect(result.seconds).toBe(0);
  });

  it('returns correct minutes and seconds for sub-hour remaining', () => {
    const now = Date.now();
    const target = new Date(now + 23 * MS.min + 11 * MS.sec).toISOString();
    const result = computeTimeRemaining(target, now);
    expect(result.minutes).toBe(23);
    expect(result.seconds).toBe(11);
  });

  it('returns totalMs:0 and all zeros when done', () => {
    const past = new Date(Date.now() - 5000).toISOString();
    const result = computeTimeRemaining(past, Date.now());
    expect(result.totalMs).toBe(0);
    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(0);
  });
});

describe('getPrecisionTier', () => {
  it('returns "days" for >= 2 days', () => {
    expect(getPrecisionTier(2 * MS.day)).toBe('days');
    expect(getPrecisionTier(10 * MS.day)).toBe('days');
  });

  it('returns "dhm" for >= 1 hour and < 2 days', () => {
    expect(getPrecisionTier(MS.hour)).toBe('dhm');
    expect(getPrecisionTier(2 * MS.day - 1)).toBe('dhm');
  });

  it('returns "ms" for < 1 hour', () => {
    expect(getPrecisionTier(MS.hour - 1)).toBe('ms');
    expect(getPrecisionTier(0)).toBe('ms');
  });
});
