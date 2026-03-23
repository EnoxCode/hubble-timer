import { describe, it, expect } from 'vitest';
import { computeTimeRemaining, getPrecisionTier } from '../../visualizations/date-countdown/index';
import React from 'react';
import { vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useWidgetConfig, useHubbleSDK } from '@hubble/sdk';
import DateCountdownViz from '../../visualizations/date-countdown/index';

const mockConfig = useWidgetConfig as ReturnType<typeof vi.fn>;

const FAR_FUTURE = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(); // 10 days + 30 min buffer

function setConfig(overrides = {}) {
  mockConfig.mockReturnValue({
    title: 'Summer Vacation',
    targetDate: FAR_FUTURE,
    layout: 'hero',
    size: 'm',
    doneNotify: true,
    doneExpand: false,
    ...overrides,
  });
}

beforeEach(() => setConfig());

describe('hero layout — days tier (>= 2 days away)', () => {
  it('shows the day count', () => {
    render(<DateCountdownViz />);
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('shows "days remaining" label', () => {
    render(<DateCountdownViz />);
    expect(screen.getByText('days remaining')).toBeInTheDocument();
  });

  it('shows the widget title', () => {
    render(<DateCountdownViz />);
    expect(screen.getByText('Summer Vacation')).toBeInTheDocument();
  });

  it('sets data-state="active"', () => {
    const { container } = render(<DateCountdownViz />);
    expect(container.querySelector('.date-countdown')).toHaveAttribute('data-state', 'active');
  });
});

describe('hero layout — dhm tier (>= 1 hour, < 2 days)', () => {
  it('shows d+h+m format', () => {
    const target = new Date(Date.now() + 1 * 86400000 + 6 * 3600000 + 23 * 60000 + 30000).toISOString();
    setConfig({ targetDate: target });
    render(<DateCountdownViz />);
    expect(screen.getByText(/1d.*6h.*23m/)).toBeInTheDocument();
  });
});

describe('hero layout — ms tier (< 1 hour)', () => {
  it('shows m+s format', () => {
    const target = new Date(Date.now() + 23 * 60000 + 11000 + 500).toISOString();
    setConfig({ targetDate: target });
    render(<DateCountdownViz />);
    expect(screen.getByText(/23m.*11s/)).toBeInTheDocument();
  });

  it('sets data-state="imminent"', () => {
    const target = new Date(Date.now() + 23 * 60000).toISOString();
    setConfig({ targetDate: target });
    const { container } = render(<DateCountdownViz />);
    expect(container.querySelector('.date-countdown')).toHaveAttribute('data-state', 'imminent');
  });
});

describe('done state (target in the past)', () => {
  it('shows TODAY', () => {
    setConfig({ targetDate: new Date(Date.now() - 1000).toISOString() });
    render(<DateCountdownViz />);
    expect(screen.getByText('TODAY')).toBeInTheDocument();
  });

  it('sets data-state="done"', () => {
    setConfig({ targetDate: new Date(Date.now() - 1000).toISOString() });
    const { container } = render(<DateCountdownViz />);
    expect(container.querySelector('.date-countdown')).toHaveAttribute('data-state', 'done');
  });
});

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

describe('segmented layout — days tier', () => {
  it('shows only the days column', () => {
    setConfig({
      layout: 'segmented',
      targetDate: new Date(Date.now() + 10 * 86400000 + 30 * 60000).toISOString(), // +30min buffer
    });
    const { container } = render(<DateCountdownViz />);
    const segs = container.querySelectorAll('.dc-seg');
    expect(segs).toHaveLength(1);
    expect(screen.getByText('days')).toBeInTheDocument();
  });
});

describe('segmented layout — dhm tier', () => {
  it('shows days, hrs, min columns when days > 0', () => {
    setConfig({
      layout: 'segmented',
      targetDate: new Date(Date.now() + 1 * 86400000 + 6 * 3600000 + 23 * 60000 + 30000).toISOString(), // +30s buffer
    });
    const { container } = render(<DateCountdownViz />);
    const segs = container.querySelectorAll('.dc-seg');
    expect(segs).toHaveLength(3);
    expect(screen.getByText('hrs')).toBeInTheDocument();
    expect(screen.getByText('min')).toBeInTheDocument();
  });

  it('omits days column when days is 0', () => {
    setConfig({
      layout: 'segmented',
      targetDate: new Date(Date.now() + 3 * 3600000 + 30 * 60000 + 30000).toISOString(), // +30s buffer
    });
    const { container } = render(<DateCountdownViz />);
    const segs = container.querySelectorAll('.dc-seg');
    expect(segs).toHaveLength(2); // hrs + min only
    expect(screen.queryByText('days')).not.toBeInTheDocument();
  });
});

describe('segmented layout — ms tier', () => {
  it('shows min and sec columns', () => {
    setConfig({
      layout: 'segmented',
      targetDate: new Date(Date.now() + 23 * 60000 + 11000 + 500).toISOString(), // +500ms buffer
    });
    const { container } = render(<DateCountdownViz />);
    expect(screen.getByText('min')).toBeInTheDocument();
    expect(screen.getByText('sec')).toBeInTheDocument();
  });
});

describe('segmented layout — done state', () => {
  it('shows TODAY', () => {
    setConfig({
      layout: 'segmented',
      targetDate: new Date(Date.now() - 1000).toISOString(),
    });
    render(<DateCountdownViz />);
    expect(screen.getByText('TODAY')).toBeInTheDocument();
  });
});
