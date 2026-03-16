/* eslint-disable @typescript-eslint/no-explicit-any */
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
  it('shows 0:00 and DONE', () => {
    setTimer({ status: 'done', duration: 600_000, elapsed: 600_000 });
    render(<CountdownViz />);
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('DONE')).toBeInTheDocument();
  });

  it('sets data-state="done" on root', () => {
    setTimer({ status: 'done', duration: 600_000, elapsed: 600_000 });
    const { container } = render(<CountdownViz />);
    expect(container.firstChild).toHaveAttribute('data-state', 'done');
  });

  it('sets data-flash="true" when doneFlash is true', () => {
    setConfig({ doneFlash: true });
    setTimer({ status: 'done', duration: 600_000, elapsed: 600_000 });
    const { container } = render(<CountdownViz />);
    expect(container.firstChild).toHaveAttribute('data-flash', 'true');
  });

  it('calls requestAcknowledge when doneExpand is true', () => {
    const mockSdk = { onButton: vi.fn(() => vi.fn()), requestAcknowledge: vi.fn() };
    (useHubbleSDK as ReturnType<typeof vi.fn>).mockReturnValue(mockSdk);
    setConfig({ doneExpand: true });
    setTimer({ status: 'done', duration: 600_000, elapsed: 600_000 });
    render(<CountdownViz />);
    expect(mockSdk.requestAcknowledge).toHaveBeenCalled();
  });
});

describe('size prop', () => {
  it('sets data-size="l" when size is l', () => {
    setConfig({ size: 'l' });
    const { container } = render(<CountdownViz />);
    expect(container.firstChild).toHaveAttribute('data-size', 'l');
  });

  it('xl size omits dash-glass shell', () => {
    setConfig({ size: 'xl' });
    const { container } = render(<CountdownViz />);
    expect(container.firstChild).not.toHaveClass('dash-glass');
  });
});

describe('hardware buttons', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  it('button1 calls /pause when timer is running', async () => {
    setTimer({ status: 'running', duration: 600_000, startedAt: Date.now(), elapsed: 0 });
    const mockSdk = {
      onButton: vi.fn((name: string, handler: () => void) => {
        if (name === 'button1') { (mockSdk as any)._button1 = handler; }
        return vi.fn();
      }),
      requestAcknowledge: vi.fn(),
    };
    (useHubbleSDK as ReturnType<typeof vi.fn>).mockReturnValue(mockSdk);
    render(<CountdownViz />);
    await (mockSdk as any)._button1();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/module/hubble-timer/api/pause',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ slug: 'timer-1' }) })
    );
  });

  it('button1 calls /resume when timer is paused', async () => {
    setTimer({ status: 'paused', duration: 600_000, elapsed: 10_000 });
    const mockSdk = {
      onButton: vi.fn((name: string, handler: () => void) => {
        if (name === 'button1') { (mockSdk as any)._button1 = handler; }
        return vi.fn();
      }),
      requestAcknowledge: vi.fn(),
    };
    (useHubbleSDK as ReturnType<typeof vi.fn>).mockReturnValue(mockSdk);
    render(<CountdownViz />);
    await (mockSdk as any)._button1();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/module/hubble-timer/api/resume',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ slug: 'timer-1' }) })
    );
  });
});

describe('warning threshold', () => {
  it('sets data-state="warning" when time remaining is below warningThreshold', () => {
    const now = Date.now();
    setConfig({ warningThreshold: 300 });
    setTimer({
      status: 'running',
      duration: 600_000,
      startedAt: now - 590_000,
      elapsed: 0,
    });
    const { container } = render(<CountdownViz />);
    expect(container.firstChild).toHaveAttribute('data-state', 'warning');
  });

  it('sets data-state="running" when above threshold', () => {
    const now = Date.now();
    setConfig({ warningThreshold: 300 });
    setTimer({
      status: 'running',
      duration: 600_000,
      startedAt: now - 10_000,
      elapsed: 0,
    });
    const { container } = render(<CountdownViz />);
    expect(container.firstChild).toHaveAttribute('data-state', 'running');
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
