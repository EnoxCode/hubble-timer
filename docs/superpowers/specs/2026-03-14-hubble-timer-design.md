# Hubble Timer — Design Spec

**Date:** 2026-03-14
**Module:** `hubble-timer`
**Type:** Hybrid (connector + visualization)

---

## Overview

A cooking timer module for the Hubble dashboard. Each widget instance represents one independent timer. Multiple timer widgets can be placed on a single page (e.g. one per dish). Timers are started and configured via API call; hardware buttons control playback. Two visualization types are provided: a countdown timer (circular ring) and a stopwatch (digital elapsed display).

No config panels are needed — all properties are handled by the manifest's auto-generated property UI.

---

## Architecture

### Module type
Hybrid — `connector/index.ts` + `visualizations/countdown/` + `visualizations/stopwatch/`

### State ownership
Timer state lives in the **connector** (server-side). The connector holds all timer states in memory, persisted to `sdk.storage` so state survives restarts. It emits updates only on state *changes* (start, pause, resume, reset, done) — not every second.

Each visualization widget reads `useConnectorData<Record<string, TimerState>>()` to get the full state map, reads its own `slug` from `useWidgetConfig()`, and extracts its own timer:

```ts
const allStates = useConnectorData<Record<string, TimerState>>();
const config = useWidgetConfig<{ slug: string; title: string; size: string; ... }>();
const timer = allStates?.[config.slug] ?? null;
```

The visualization computes the display time locally. The formula differs by mode:

```
// Stopwatch — total elapsed
displayMs = timer.elapsed + (Date.now() - timer.startedAt)

// Countdown — time remaining
displayMs = timer.duration - (timer.elapsed + (Date.now() - timer.startedAt))
```

Both formulas only apply when `status === 'running'`; when `paused` use `timer.elapsed` (stopwatch) or `timer.duration - timer.elapsed` (countdown) directly.

### Done timeouts
The connector uses a `setTimeout` (not `sdk.schedule`) to fire the `done` event at the precise moment a countdown reaches zero. A timeout handle is stored per slug in a `Map<string, ReturnType<typeof setTimeout>>`. On every `/start` call `clearTimeout` is called for that slug before setting a new timeout. If the computed remaining time is ≤ 0 on start (e.g. after a crash recovery where time already elapsed), the timer fires as `done` immediately.

### Emit topic
`hubble-timer:state` — emits the full map of all timer states on every change.

```ts
// Emitted payload shape
Record<string, TimerState>

interface TimerState {
  slug: string
  label: string | null       // API-provided label for this run, or null
  status: 'idle' | 'running' | 'paused' | 'done'
  mode: 'countdown' | 'stopwatch'
  duration: number | null    // ms — set when /start is called with a duration; null for stopwatch
  startedAt: number | null   // Date.now() when last started/resumed
  elapsed: number            // ms accumulated before last pause
}
```

`mode` is derived from the `/start` call: if `duration` is present the mode is `countdown`; if absent it is `stopwatch`. The connector does not inspect which visualization type the widget uses.

---

## Visualizations

### 1. Countdown (`visualizations/countdown/`)

Circular ring that drains as time runs out. `warningThreshold` is read from `useWidgetConfig()` — it is visualization-only and does not affect connector behavior.

Ring color (use CSS variables for theme consistency):
- **Green** (`--hubble-success`) — more than `warningThreshold` seconds remaining
- **Red** (`--hubble-danger`) — `warningThreshold` seconds or fewer remaining

The visualization compares `warningThreshold * 1000` (converted to ms) against the computed `displayMs` remaining.

#### States

| State | Visual |
|---|---|
| `idle` | Dashed ring, `--:--`, "WAITING" label |
| `running` (green) | Solid green arc, white time, "REMAINING" |
| `running` (red) | Solid red arc, white time, "REMAINING" |
| `paused` | Dimmed arc (25% opacity), grey time, orange "PAUSED" label |
| `done` | Empty ring, red panel border glow, red "00:00" and "DONE" |

When `status === 'done'` the visualization reads `doneExpand` and `doneFlash` from `useWidgetConfig()` directly and acts accordingly — these are not carried in `TimerState`.

#### Sizing (controlled by `size` property)

| Size | Ring diameter | Font size |
|---|---|---|
| `s` | 80px | 14px |
| `m` | 108px | 19px |
| `l` | 140px | 26px |
| `xl` | 180px | 34px |

---

### 2. Stopwatch (`visualizations/stopwatch/`)

Digital elapsed time display. Counts up from `00:00` when started via API.

#### States

| State | Visual |
|---|---|
| `idle` | `--:--`, faded, "WAITING" |
| `running` | White bold digits, label on top, "ELAPSED" below |
| `paused` | Grey digits, orange "PAUSED" below |

#### Sizing — same `size` property, scales font size accordingly.

---

## Widget Properties

Both visualizations share the same property set (except `warningThreshold` which is countdown-only, ignored by stopwatch).

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `title` | `string` | yes | — | Display name shown when no API label is active |
| `slug` | `string` | yes | — | Stable identifier used to target this widget via API (e.g. `timer-1`) |
| `size` | `choice` | no | `m` | Widget display size: `s`, `m`, `l`, `xl` |
| `doneNotify` | `boolean` | no | `true` | Send a dashboard notification when the countdown finishes |
| `doneExpand` | `boolean` | no | `false` | Expand to full-screen and require hardware button acknowledgement when done |
| `doneFlash` | `boolean` | no | `false` | Flash the widget panel when done |
| `warningThreshold` | `range` | no | `300` | Seconds remaining at which the ring switches from green to red (countdown only; min 0, max 3600, step 30) |

---

## API Endpoints

All endpoints declared in `manifest.json` under `"endpoints"` and handled via `sdk.onApiCall`:

```ts
sdk.onApiCall(async ({ action, params, body }) => {
  switch (action) {
    case 'start': ...
    case 'pause': ...
    case 'resume': ...
    case 'reset': ...
    default: return { error: `Unknown action: ${action}` };
  }
});
```

### `POST /start`
Start or restart a timer. Cancels any existing `done` timeout for the slug before setting a new one.

**Body:**
```json
{
  "slug": "timer-1",
  "duration": 600,
  "label": "Pizza"
}
```

- `slug` — required. Identifies the target widget.
- `duration` — optional. Value in **seconds**. If present, mode is `countdown`; if absent, mode is `stopwatch`.
- `label` — optional. Overrides the widget's `title` for this run. Cleared on reset.

**Response:** `{ "ok": true }`

---

### `POST /pause`
Pause a running timer. Accumulates elapsed time. Cancels the `done` timeout for the slug.

**Body:** `{ "slug": "timer-1" }`
**Response:** `{ "ok": true }` or `{ "error": "Timer not running" }`

---

### `POST /resume`
Resume a paused timer. Re-arms the `done` timeout for remaining duration.

**Body:** `{ "slug": "timer-1" }`
**Response:** `{ "ok": true }` or `{ "error": "Timer not paused" }`

---

### `POST /reset`
Stop and reset the timer to `idle`. Cancels `done` timeout. Clears `label`, `startedAt`, `elapsed`. Preserves `duration` so it can be restarted via `/start`.

**Body:** `{ "slug": "timer-1" }`
**Response:** `{ "ok": true }`

---

## Hardware Buttons

Declared per-visualization in `manifest.json`:

| Button | Action | Behavior |
|---|---|---|
| `button1` | `toggle` | Start if idle/paused, pause if running |
| `button2` | `reset` | Reset to idle |

Button handlers live in the visualization via `useHubbleSDK()`. Since buttons must modify connector state, the handlers call the module's own API endpoints using `fetch`:

```ts
const sdk = useHubbleSDK();
useEffect(() => {
  const unsub = sdk.onButton('button1', async () => {
    const slug = config.slug;
    const action = timer?.status === 'running' ? 'pause' : 'resume';
    // Intentional design: hardware buttons cannot start a fresh timer.
    // /start must always come from an external API call (e.g. Home Assistant, shortcut).
    // When status === 'idle', resume is rejected by the connector — this is expected.
    await fetch(`/api/modules/hubble-timer/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
  });
  return unsub;
}, [sdk, timer?.status, config.slug]);
```

---

## Done Behavior

When a countdown's `done` timeout fires the connector:

1. Sets `status` to `done`, emits updated state.
2. Calls `sdk.getWidgetConfigs()` and finds the entry where `config.slug === slug`.
3. Executes enabled done behaviors from that config:
   - **`doneNotify`** — `sdk.notify('${label ?? title} is done!', { level: 'info' })` — handled by the connector because `sdk.notify` is a server-side API.
   - **`doneExpand`** and **`doneFlash`** — handled in the visualization: when `status === 'done'` arrives, the viz reads these from `useWidgetConfig()` and calls `sdk.requestAcknowledge()` / applies CSS flash class. This split exists because `requestAcknowledge()` is a client-side presentation API (`ClientSdk`) unavailable on the server.

Multiple behaviors can be active simultaneously.

---

## File Structure

```
hubble-timer/
├── manifest.json
├── connector/
│   └── index.ts                        # State machine, API handler, done timeouts
├── visualizations/
│   ├── countdown/
│   │   ├── index.tsx                   # Circular ring visualization
│   │   └── style.css
│   └── stopwatch/
│       ├── index.tsx                   # Digital elapsed visualization
│       └── style.css
└── tests/
    ├── setup.ts
    ├── connector.test.ts               # State transitions, API actions, done behavior
    └── visualizations/
        ├── countdown.test.tsx
        └── stopwatch.test.tsx
```

---

## Storage

Timer states are persisted to `sdk.storage` under the key `timerStates` (serialized as JSON) so they survive connector restarts. On load, the connector:

1. Reads `timerStates` from storage.
2. For each timer with `status === 'running'` and `mode === 'countdown'`: computes remaining = `(startedAt + duration) - Date.now()`. If remaining ≤ 0, fires `done` immediately. Otherwise re-arms the `setTimeout` for `remaining` ms.
3. Timers with `status === 'paused'` or `status === 'done'` are restored directly from storage with no additional timeout logic — their `elapsed` value is already correct.

---

## Testing Strategy

### Connector (`connector.test.ts`)
- Extract pure state-transition functions (`startTimer`, `pauseTimer`, `resumeTimer`, `resetTimer`) and test them directly.
- Assert `sdk.emit` is called with the correct full state map after each transition.
- Assert `sdk.notify` is called with the timer label when a countdown completes and `doneNotify` is true.
- Assert `sdk.storage.set` is called after every state change.
- Test restart recovery: given a stored `running` state with `startedAt` 10 seconds ago and `duration` 30s, the connector arms a timeout for ~20s (not 30s).
- Test expired recovery: given a stored `running` state where `startedAt + duration < Date.now()`, the connector immediately emits `done`.
- Test that calling `/start` on an already-running slug cancels the previous timeout (no double-fire).

### Visualizations
- Render with representative `TimerState` payloads (mocked via `useConnectorData`) and assert critical elements are visible (time display, label, status text).
- Test that slug filtering works: state map with two slugs only renders the one matching `useWidgetConfig`'s slug.
- Test the `size` property applies the correct CSS size class.
- Test that `paused` state shows "PAUSED" and dimmed ring.
- Test that `done` state shows "DONE" with red styling.
- Test that `done` + `doneFlash: true` applies the flash CSS class.
- Test that `button1` handler calls `/pause` when `status === 'running'`, calls `/resume` when `status === 'paused'`, and calls `/resume` (rejected by connector, no-op in UI) when `status === 'idle'`.
- Mock `useConnectorData`, `useWidgetConfig`, `useHubbleSDK` from `@hubble/sdk`.
