# Date Countdown Visualization — Design Spec

**Date:** 2026-03-23
**Module:** `hubble-timer`
**Type:** New visualization added to existing module

---

## Overview

A new `date-countdown` visualization for the `hubble-timer` module. Counts down to a configured target date/time with adaptive precision. Unlike the kitchen countdown timer, this is purely client-side — no connector involvement, no API calls, no server-side state.

---

## Files

```
visualizations/
  date-countdown/
    index.tsx       # React component
    style.css       # Glassmorphism styles
tests/
  visualizations/
    date-countdown.test.tsx
```

`manifest.json` gets a third entry in `"visualizations"`. No connector changes, no new endpoints, no new events.

---

## Manifest Properties

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `title` | `string` | yes | — | Event name displayed on the widget |
| `targetDate` | `datetime` | yes | — | The date/time to count down to |
| `layout` | `choice` | no | `"hero"` | `"hero"` (large number) or `"segmented"` (labeled columns) |
| `size` | `choice` | no | `"m"` | Widget size: `s`, `m`, `l`, `xl` |
| `doneNotify` | `boolean` | no | `true` | Send a notification when the date arrives |
| `doneExpand` | `boolean` | no | `false` | Expand full-screen (`requestAcknowledge`) when the date arrives |

---

## Adaptive Precision

Precision tier is derived from milliseconds remaining. Not user-configurable.

| Remaining | Display | Tick interval |
|---|---|---|
| ≥ 2 days | Days only (e.g. "47 days") | 60s |
| < 2 days, ≥ 1 hour | Days + hours + minutes (e.g. "1d 6h 23m") | 60s |
| < 1 hour | Minutes + seconds (e.g. "23m 11s") | 1s |
| ≤ 0 | "TODAY" done state | no tick |

---

## Visual Design

Glassmorphism widget shell (`backdrop-filter: blur`, semi-transparent dark background, white border) matching `dashboard-mockup-v2.html` from the existing brainstorm session. Same visual language as the countdown and stopwatch vizzes.

### Layout: Hero
Large primary number dominates (days when far, adaptive units as it closes in). Secondary line shows additional precision and the target date as subtext.

### Layout: Segmented
Each unit in its own labeled column with colon separators. Clock-like. Only the units relevant to the current precision tier are shown — unused columns are hidden, not shown as zeroes. For example, at ≥ 2 days only the days column is shown; at < 2 days the days + hours + minutes columns appear.

### States
- **Far away:** white number, muted label
- **< 1 hour:** amber number (`#f39c12`) to signal imminence
- **TODAY:** green widget tint (`rgba(10,50,25,0.6)`), green border, green "TODAY" text — matching the existing "done" green (`#1edd6e`)

---

## Component Logic

### `computeTimeRemaining(targetDate: string, now: number)`

Pure function. Returns:
```ts
{
  days: number,
  hours: number,
  minutes: number,
  seconds: number,
  totalMs: number,
  done: boolean
}
```

### Tick management

`setInterval` registered in a `useEffect` that depends on the precision tier. Interval switches from 60s to 1s automatically when `totalMs` crosses the 1-hour threshold. Done state cancels the interval.

### Done effects

Fire once on transition to done, guarded by a `useRef` to prevent re-firing on re-renders:
- `doneNotify` → `sdk.notify(title, { level: 'info' })`
- `doneExpand` → `sdk.requestAcknowledge()`

### Past target dates

If `targetDate` is already in the past when the widget mounts, it goes straight to the "TODAY" done state **without** firing done effects. A past date is not a fresh completion.

---

## Testing

File: `tests/visualizations/date-countdown.test.tsx`

### Pure function tests
- `computeTimeRemaining` returns correct breakdown for each precision tier
- Returns `done: true` when target is in the past or exactly now
- Handles boundary values (exactly 2 days, exactly 1 hour)

### Render tests
- Hero layout renders day count and title in far-away state
- Segmented layout renders labeled columns
- Done state renders "TODAY"
- `doneNotify` calls `sdk.notify` on transition to done
- `doneExpand` calls `sdk.requestAcknowledge` on transition to done
- Past target date mounts in done state without triggering done effects

SDK mocked per the pattern in CLAUDE.md (`useWidgetConfig`, `useHubbleSDK`).

---

## Out of Scope

- "Count up" after the date passes (no elapsed time display post-done)
- Warning threshold config (not relevant for calendar events)
- Hardware button support (no interactive controls needed)
- Connector / server-side involvement
- `doneFlash` property (intentionally excluded — not adding parity with kitchen timers)
- `doneSelect` property (intentionally excluded — same reason)
