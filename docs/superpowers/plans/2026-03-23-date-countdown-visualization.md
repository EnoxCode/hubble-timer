# Date Countdown Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `date-countdown` visualization to the `hubble-timer` module that counts down to a configured target date with adaptive precision and an optional "TODAY" done state with notify/expand effects.

**Architecture:** Pure visualization — no connector involvement. All time math happens client-side in React using `useWidgetConfig` to read `targetDate`. A `setInterval` ticks every minute when far away, every second when under an hour. Done effects are guarded by a ref to prevent re-firing on re-render and to skip firing for dates that were already past on mount.

**Tech Stack:** React 18 + TypeScript, Vitest + @testing-library/react, `hubble-dash-ui` (DashWidget + DashWidgetHeader), `@hubble/sdk` (useWidgetConfig + useHubbleSDK)

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `visualizations/date-countdown/index.tsx` | Component + exported helper functions |
| Create | `visualizations/date-countdown/style.css` | Data-attribute-driven styles (no inline styles) |
| Create | `tests/visualizations/date-countdown.test.tsx` | All unit + render tests |
| Modify | `manifest.json` | Add `date-countdown` visualization entry |

---

## Task 1: Pure helper functions

**Files:**
- Create: `visualizations/date-countdown/index.tsx` (helpers only for now)
- Create: `tests/visualizations/date-countdown.test.tsx`

- [ ] **Step 1: Create the test file with failing pure-function tests**

```tsx
// tests/visualizations/date-countdown.test.tsx
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
```

- [ ] **Step 2: Run tests — expect import errors**

```bash
npx vitest run tests/visualizations/date-countdown.test.tsx
```

Expected: `Error: Cannot find module '../../visualizations/date-countdown/index'`

- [ ] **Step 3: Create the file with only the exported helpers**

```tsx
// visualizations/date-countdown/index.tsx
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  done: boolean;
}

export type PrecisionTier = 'days' | 'dhm' | 'ms';

export function computeTimeRemaining(targetDate: string, now: number): TimeRemaining {
  const targetMs = new Date(targetDate).getTime();
  const totalMs = Math.max(0, targetMs - now);
  if (totalMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, done: true };
  }
  const totalSec = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds, totalMs, done: false };
}

export function getPrecisionTier(totalMs: number): PrecisionTier {
  if (totalMs >= TWO_DAYS_MS) return 'days';
  if (totalMs >= ONE_HOUR_MS) return 'dhm';
  return 'ms';
}
```

- [ ] **Step 4: Run tests — expect all pure-function tests to pass**

```bash
npx vitest run tests/visualizations/date-countdown.test.tsx
```

Expected: All 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add visualizations/date-countdown/index.tsx tests/visualizations/date-countdown.test.tsx
git commit -m "feat: add computeTimeRemaining and getPrecisionTier helpers"
```

---

## Task 2: Update SDK mock + manifest entry

**Files:**
- Modify: `__mocks__/@hubble/sdk.ts`
- Modify: `manifest.json`

- [ ] **Step 1: Add `notify` to the shared `useHubbleSDK` mock**

The project uses a module-alias mock at `__mocks__/@hubble/sdk.ts`. The date-countdown component calls `sdk.notify(...)`, so add it to the mock's return value to prevent runtime errors in tests. Open `__mocks__/@hubble/sdk.ts` and update the `useHubbleSDK` line:

```ts
export const useHubbleSDK = vi.fn(() => ({ onButton: vi.fn(() => vi.fn()), requestAcknowledge: vi.fn(), notify: vi.fn() }));
```

- [ ] **Step 2: Run existing tests to confirm no regressions**

```bash
npm test
```

Expected: All countdown and stopwatch tests still pass.

- [ ] **Step 3: Commit**

```bash
git add __mocks__/@hubble/sdk.ts
git commit -m "chore: add notify to useHubbleSDK mock"
```

- [ ] **Step 4: Add the visualization entry to `manifest.json`**

In `manifest.json`, add this object to the end of the `"visualizations"` array (after the `"Stopwatch"` entry):

```json
{
  "name": "Date Countdown",
  "description": "Counts down to a configured date/time with adaptive precision",
  "path": "date-countdown",
  "selectable": true,
  "properties": [
    {
      "name": "title",
      "type": "string",
      "required": true,
      "description": "Event name displayed on the widget"
    },
    {
      "name": "targetDate",
      "type": "datetime",
      "required": true,
      "description": "The date/time to count down to"
    },
    {
      "name": "layout",
      "type": "choice",
      "required": false,
      "default": "hero",
      "description": "Display layout",
      "choices": [
        { "label": "Hero Number", "value": "hero" },
        { "label": "Segmented", "value": "segmented" }
      ]
    },
    {
      "name": "size",
      "type": "choice",
      "required": false,
      "default": "m",
      "description": "Widget size",
      "choices": [
        { "label": "Small",       "value": "s" },
        { "label": "Medium",      "value": "m" },
        { "label": "Large",       "value": "l" },
        { "label": "Extra Large", "value": "xl" }
      ]
    },
    {
      "name": "doneNotify",
      "type": "boolean",
      "required": false,
      "default": true,
      "description": "Send a notification when the date arrives"
    },
    {
      "name": "doneExpand",
      "type": "boolean",
      "required": false,
      "default": false,
      "description": "Expand full-screen (requires hardware button to dismiss) when the date arrives"
    }
  ]
}
```

- [ ] **Step 5: Validate the manifest**

```bash
npm run validate
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add manifest.json
git commit -m "feat: add date-countdown visualization manifest entry"
```

---

## Task 3: Component — hero layout

**Files:**
- Modify: `visualizations/date-countdown/index.tsx` (add full component)
- Create: `visualizations/date-countdown/style.css`

- [ ] **Step 1: Add hero layout render tests to the test file**

Add these test blocks to `tests/visualizations/date-countdown.test.tsx` (after the existing pure-function tests).

The `@hubble/sdk` module is already mocked via the `resolve.alias` in `vitest.config.ts` — do **not** add an inline `vi.mock('@hubble/sdk', ...)` call. Just import the hooks and cast them:

```tsx
// Add these imports at the top of the test file:
import React from 'react';
import { vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useWidgetConfig, useHubbleSDK } from '@hubble/sdk';
import DateCountdownViz from '../../visualizations/date-countdown/index';

const mockConfig = useWidgetConfig as ReturnType<typeof vi.fn>;

const FAR_FUTURE = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days

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
    const target = new Date(Date.now() + 1 * 86400000 + 6 * 3600000 + 23 * 60000).toISOString();
    setConfig({ targetDate: target });
    render(<DateCountdownViz />);
    expect(screen.getByText(/1d.*6h.*23m/)).toBeInTheDocument();
  });
});

describe('hero layout — ms tier (< 1 hour)', () => {
  it('shows m+s format', () => {
    const target = new Date(Date.now() + 23 * 60000 + 11000).toISOString();
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
```

- [ ] **Step 2: Run — expect component-not-found or missing default export errors**

```bash
npx vitest run tests/visualizations/date-countdown.test.tsx
```

Expected: FAIL — `DateCountdownViz` is not found / is not a React component.

- [ ] **Step 3: Replace `visualizations/date-countdown/index.tsx` with the full component**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { useWidgetConfig, useHubbleSDK } from '@hubble/sdk';
import { DashWidget, DashWidgetHeader } from 'hubble-dash-ui';
import 'hubble-dash-ui/styles/dash-base.css';
import './style.css';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  done: boolean;
}

export type PrecisionTier = 'days' | 'dhm' | 'ms';

export function computeTimeRemaining(targetDate: string, now: number): TimeRemaining {
  const targetMs = new Date(targetDate).getTime();
  const totalMs = Math.max(0, targetMs - now);
  if (totalMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, done: true };
  }
  const totalSec = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds, totalMs, done: false };
}

export function getPrecisionTier(totalMs: number): PrecisionTier {
  if (totalMs >= TWO_DAYS_MS) return 'days';
  if (totalMs >= ONE_HOUR_MS) return 'dhm';
  return 'ms';
}

interface DateCountdownConfig {
  title: string;
  targetDate: string;
  layout: 'hero' | 'segmented';
  size: 's' | 'm' | 'l' | 'xl';
  doneNotify: boolean;
  doneExpand: boolean;
}

function HeroContent({ remaining, tier }: { remaining: TimeRemaining; tier: PrecisionTier | 'done' }) {
  if (tier === 'done') {
    return (
      <div className="dc-hero">
        <div className="dc-hero-num dc-hero-num--today">TODAY</div>
      </div>
    );
  }
  if (tier === 'days') {
    return (
      <div className="dc-hero">
        <div className="dc-hero-num">{remaining.days}</div>
        <div className="dc-hero-unit">days remaining</div>
        <div className="dc-hero-sub">{remaining.hours}h {remaining.minutes}m</div>
      </div>
    );
  }
  if (tier === 'dhm') {
    const parts: string[] = [];
    if (remaining.days > 0) parts.push(`${remaining.days}d`);
    parts.push(`${remaining.hours}h`);
    parts.push(`${remaining.minutes}m`);
    return (
      <div className="dc-hero">
        <div className="dc-hero-num dc-hero-num--close">{parts.join(' ')}</div>
        <div className="dc-hero-unit">remaining</div>
      </div>
    );
  }
  return (
    <div className="dc-hero">
      <div className="dc-hero-num dc-hero-num--imminent">{remaining.minutes}m {remaining.seconds}s</div>
      <div className="dc-hero-unit">remaining</div>
    </div>
  );
}

export default function DateCountdownViz() {
  const config = useWidgetConfig<DateCountdownConfig>();
  const sdk = useHubbleSDK();

  const [remaining, setRemaining] = useState<TimeRemaining>(() =>
    computeTimeRemaining(config.targetDate, Date.now())
  );

  const wasInitiallyDoneRef = useRef(remaining.done);
  const hasFiredDoneRef = useRef(false);

  const tier: PrecisionTier | 'done' = remaining.done
    ? 'done'
    : getPrecisionTier(remaining.totalMs);

  const intervalMs = tier === 'ms' ? 1000 : 60000;

  useEffect(() => {
    if (remaining.done) return;
    const id = setInterval(() => {
      setRemaining(computeTimeRemaining(config.targetDate, Date.now()));
    }, intervalMs);
    return () => clearInterval(id);
  }, [tier, config.targetDate, remaining.done]);

  useEffect(() => {
    if (!remaining.done) return;
    if (wasInitiallyDoneRef.current) return;
    if (hasFiredDoneRef.current) return;
    hasFiredDoneRef.current = true;
    if (config.doneNotify) sdk.notify(config.title, { level: 'info' });
    if (config.doneExpand) sdk.requestAcknowledge();
  }, [remaining.done]);

  const layout = config.layout ?? 'hero';
  const size = config.size ?? 'm';
  const isXl = size === 'xl';

  const dataState = remaining.done ? 'done' : tier === 'ms' ? 'imminent' : 'active';

  const inner = (
    <div
      className="date-countdown"
      data-state={dataState}
      data-layout={layout}
      data-size={size}
    >
      {!isXl && <DashWidgetHeader label={config.title} />}
      <HeroContent remaining={remaining} tier={tier} />
    </div>
  );

  if (!isXl) {
    return (
      <DashWidget
        className="date-countdown-shell"
        statusBorder={remaining.done ? 'positive' : undefined}
      >
        {inner}
      </DashWidget>
    );
  }
  return inner;
}
```

- [ ] **Step 4: Create `visualizations/date-countdown/style.css`**

```css
/* ── Shell ── */
.date-countdown {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

/* ── Hero layout ── */
.dc-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.dc-hero-num {
  font-weight: 800;
  line-height: 1;
  color: var(--dash-text-primary, rgba(255, 255, 255, 0.85));
}

.dc-hero-unit {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--dash-text-muted, rgba(255, 255, 255, 0.25));
}

.dc-hero-sub {
  font-size: 11px;
  color: var(--dash-text-muted, rgba(255, 255, 255, 0.25));
}

/* imminent — amber */
.date-countdown[data-state="imminent"] .dc-hero-num {
  color: var(--dash-state-warning, #fbbf24);
}
.date-countdown[data-state="imminent"] .dc-hero-unit {
  color: rgba(251, 191, 36, 0.45);
}

/* done — green */
.date-countdown[data-state="done"] .dc-hero-num {
  color: var(--dash-state-positive, #4ade80);
  letter-spacing: 3px;
}

/* ── Segmented layout ── */
.dc-segs {
  display: flex;
  gap: 4px;
  align-items: flex-end;
}

.dc-seg {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.dc-seg-num {
  font-weight: 800;
  font-family: monospace;
  line-height: 1;
  color: var(--dash-text-primary, rgba(255, 255, 255, 0.85));
}

.dc-seg-lbl {
  font-size: 8px;
  font-weight: 500;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--dash-text-muted, rgba(255, 255, 255, 0.25));
  margin-top: 2px;
}

.dc-seg-sep {
  font-family: monospace;
  color: rgba(255, 255, 255, 0.15);
  padding-bottom: 12px;
}

.date-countdown[data-state="imminent"] .dc-seg-num {
  color: var(--dash-state-warning, #fbbf24);
}

.date-countdown[data-state="done"] .dc-seg-num {
  color: var(--dash-state-positive, #4ade80);
  letter-spacing: 2px;
}

/* ── Size variants ── */
.date-countdown[data-size="s"] .dc-hero-num  { font-size: 36px; }
.date-countdown[data-size="s"] .dc-seg-num   { font-size: 22px; }
.date-countdown[data-size="s"] .dc-seg-sep   { font-size: 18px; padding-bottom: 8px; }

.date-countdown[data-size="m"] .dc-hero-num  { font-size: 52px; }
.date-countdown[data-size="m"] .dc-seg-num   { font-size: 30px; }
.date-countdown[data-size="m"] .dc-seg-sep   { font-size: 22px; padding-bottom: 10px; }

.date-countdown[data-size="l"] .dc-hero-num  { font-size: 72px; letter-spacing: -2px; }
.date-countdown[data-size="l"] .dc-seg-num   { font-size: 42px; }
.date-countdown[data-size="l"] .dc-seg-sep   { font-size: 30px; padding-bottom: 14px; }

.date-countdown[data-size="xl"] .dc-hero-num  { font-size: 96px; letter-spacing: -4px; }
.date-countdown[data-size="xl"] .dc-seg-num   { font-size: 56px; }
.date-countdown[data-size="xl"] .dc-seg-sep   { font-size: 40px; padding-bottom: 18px; }
```

- [ ] **Step 5: Run hero layout tests**

```bash
npx vitest run tests/visualizations/date-countdown.test.tsx
```

Expected: All hero layout + pure-function tests pass. Segmented tests (not yet written) are absent.

- [ ] **Step 6: Commit**

```bash
git add visualizations/date-countdown/index.tsx visualizations/date-countdown/style.css
git commit -m "feat: add DateCountdownViz component with hero layout"
```

---

## Task 4: Component — segmented layout

**Files:**
- Modify: `visualizations/date-countdown/index.tsx` (add SegmentedContent component)
- Modify: `tests/visualizations/date-countdown.test.tsx` (add segmented tests)

- [ ] **Step 1: Add failing segmented layout tests**

Add these blocks to `tests/visualizations/date-countdown.test.tsx`:

```tsx
describe('segmented layout — days tier', () => {
  it('shows only the days column', () => {
    setConfig({
      layout: 'segmented',
      targetDate: new Date(Date.now() + 10 * 86400000).toISOString(),
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
      targetDate: new Date(Date.now() + 1 * 86400000 + 6 * 3600000 + 23 * 60000).toISOString(),
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
      targetDate: new Date(Date.now() + 3 * 3600000 + 30 * 60000).toISOString(),
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
      targetDate: new Date(Date.now() + 23 * 60000 + 11000).toISOString(),
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
```

- [ ] **Step 2: Run — expect segmented tests to fail**

```bash
npx vitest run tests/visualizations/date-countdown.test.tsx
```

Expected: FAIL — segmented tests fail (hero layout renders for all layouts).

- [ ] **Step 3: Add `SegmentedContent` component and wire up layout switching**

Add this component to `visualizations/date-countdown/index.tsx` (before `DateCountdownViz`):

```tsx
function SegmentedContent({ remaining, tier }: { remaining: TimeRemaining; tier: PrecisionTier | 'done' }) {
  if (tier === 'done') {
    return (
      <div className="dc-segs">
        <div className="dc-seg">
          <div className="dc-seg-num">TODAY</div>
        </div>
      </div>
    );
  }

  type Seg = { num: number; lbl: string };
  const segments: Seg[] = [];

  if (tier === 'days') {
    segments.push({ num: remaining.days, lbl: 'days' });
  } else if (tier === 'dhm') {
    if (remaining.days > 0) segments.push({ num: remaining.days, lbl: remaining.days === 1 ? 'day' : 'days' });
    segments.push({ num: remaining.hours, lbl: 'hrs' });
    segments.push({ num: remaining.minutes, lbl: 'min' });
  } else {
    segments.push({ num: remaining.minutes, lbl: 'min' });
    segments.push({ num: remaining.seconds, lbl: 'sec' });
  }

  return (
    <div className="dc-segs">
      {segments.map((seg, i) => (
        <React.Fragment key={seg.lbl}>
          {i > 0 && <div className="dc-seg-sep">:</div>}
          <div className="dc-seg">
            <div className="dc-seg-num">{String(seg.num).padStart(2, '0')}</div>
            <div className="dc-seg-lbl">{seg.lbl}</div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
```

Then in `DateCountdownViz`, replace the `<HeroContent .../>` line with:

```tsx
{layout === 'segmented'
  ? <SegmentedContent remaining={remaining} tier={tier} />
  : <HeroContent remaining={remaining} tier={tier} />
}
```

- [ ] **Step 4: Run all tests**

```bash
npx vitest run tests/visualizations/date-countdown.test.tsx
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add visualizations/date-countdown/index.tsx tests/visualizations/date-countdown.test.tsx
git commit -m "feat: add segmented layout to DateCountdownViz"
```

---

## Task 5: Done effects

**Files:**
- Modify: `tests/visualizations/date-countdown.test.tsx` (add done-effects tests)

The implementation is already in place from Task 3. This task adds tests to verify correct behavior.

- [ ] **Step 1: Add done-effects tests**

Add these blocks to `tests/visualizations/date-countdown.test.tsx`:

```tsx
describe('done effects — past target on mount', () => {
  it('does not call sdk.notify when mounted with a past target date', () => {
    const mockSdk = { requestAcknowledge: vi.fn(), notify: vi.fn() };
    (useHubbleSDK as ReturnType<typeof vi.fn>).mockReturnValue(mockSdk);
    setConfig({
      targetDate: new Date(Date.now() - 5000).toISOString(),
      doneNotify: true,
      doneExpand: true,
    });
    render(<DateCountdownViz />);
    expect(mockSdk.notify).not.toHaveBeenCalled();
    expect(mockSdk.requestAcknowledge).not.toHaveBeenCalled();
  });
});

describe('done effects — countdown reaches zero during session', () => {
  afterEach(() => vi.useRealTimers());

  it('calls sdk.notify when countdown reaches zero and doneNotify is true', () => {
    vi.useFakeTimers();
    const mockSdk = { requestAcknowledge: vi.fn(), notify: vi.fn() };
    (useHubbleSDK as ReturnType<typeof vi.fn>).mockReturnValue(mockSdk);

    // Target is 500ms in the future — well within the 1s tick interval
    const target = new Date(Date.now() + 500).toISOString();
    setConfig({ targetDate: target, doneNotify: true, doneExpand: false });

    const { rerender } = render(<DateCountdownViz />);
    expect(mockSdk.notify).not.toHaveBeenCalled();

    // Advance past target (interval fires, setRemaining updates, effect runs)
    act(() => { vi.advanceTimersByTime(2000); });
    rerender(<DateCountdownViz />);

    expect(mockSdk.notify).toHaveBeenCalledWith('Summer Vacation', { level: 'info' });
    expect(mockSdk.requestAcknowledge).not.toHaveBeenCalled();
  });

  it('calls sdk.requestAcknowledge when doneExpand is true', () => {
    vi.useFakeTimers();
    const mockSdk = { requestAcknowledge: vi.fn(), notify: vi.fn() };
    (useHubbleSDK as ReturnType<typeof vi.fn>).mockReturnValue(mockSdk);

    const target = new Date(Date.now() + 500).toISOString();
    setConfig({ targetDate: target, doneNotify: false, doneExpand: true });

    const { rerender } = render(<DateCountdownViz />);
    act(() => { vi.advanceTimersByTime(2000); });
    rerender(<DateCountdownViz />);

    expect(mockSdk.requestAcknowledge).toHaveBeenCalled();
  });

  it('does not call sdk.notify more than once', () => {
    vi.useFakeTimers();
    const mockSdk = { requestAcknowledge: vi.fn(), notify: vi.fn() };
    (useHubbleSDK as ReturnType<typeof vi.fn>).mockReturnValue(mockSdk);

    const target = new Date(Date.now() + 500).toISOString();
    setConfig({ targetDate: target, doneNotify: true });

    const { rerender } = render(<DateCountdownViz />);
    act(() => { vi.advanceTimersByTime(2000); });
    rerender(<DateCountdownViz />);
    act(() => { vi.advanceTimersByTime(2000); });
    rerender(<DateCountdownViz />);

    expect(mockSdk.notify).toHaveBeenCalledTimes(1);
  });
});
```

Also add `import { act } from '@testing-library/react';` to the imports at the top.

- [ ] **Step 2: Run all tests**

```bash
npx vitest run tests/visualizations/date-countdown.test.tsx
```

Expected: All tests pass.

- [ ] **Step 3: Run full test suite to check for regressions**

```bash
npm test
```

Expected: All tests pass (countdown, stopwatch, date-countdown).

- [ ] **Step 4: Commit**

```bash
git add tests/visualizations/date-countdown.test.tsx
git commit -m "test: add done-effects tests for DateCountdownViz"
```
