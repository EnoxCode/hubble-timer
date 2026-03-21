import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useConnectorData, useWidgetConfig } from '@hubble/sdk';
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
    showMilliseconds: false,
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
    setConfig({ slug: 'sw-1', title: 'Stock Pot', size: 'm' });
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

  it('sets data-state="paused" on root', () => {
    setTimer({ status: 'paused', elapsed: 12_000 });
    const { container } = render(<StopwatchViz />);
    expect(container.querySelector('.timer-stopwatch')).toHaveAttribute('data-state', 'paused');
  });
});

describe('size prop', () => {
  it('sets data-size="xl" when size is xl', () => {
    setConfig({ size: 'xl' });
    const { container } = render(<StopwatchViz />);
    expect(container.firstChild).toHaveAttribute('data-size', 'xl');
  });

  it('xl size omits dash-glass shell', () => {
    setConfig({ size: 'xl' });
    const { container } = render(<StopwatchViz />);
    expect(container.firstChild).not.toHaveClass('dash-glass');
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

describe('milliseconds', () => {
  it('shows ms suffix when showMilliseconds is true', () => {
    setConfig({ showMilliseconds: true });
    setTimer({ status: 'running', startedAt: Date.now() - 5432, elapsed: 0 });
    const { container } = render(<StopwatchViz />);
    expect(container.querySelector('.timer-sw-ms')).not.toBeNull();
  });

  it('hides ms suffix when showMilliseconds is false', () => {
    setConfig({ showMilliseconds: false });
    setTimer({ status: 'running', startedAt: Date.now(), elapsed: 0 });
    const { container } = render(<StopwatchViz />);
    expect(container.querySelector('.timer-sw-ms')).toBeNull();
  });
});
