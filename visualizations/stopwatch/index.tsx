import React, { useEffect, useState } from 'react';
import { useConnectorData, useWidgetConfig } from '@hubble/sdk';
import { DashWidget, DashWidgetHeader } from 'hubble-dash-ui';
import 'hubble-dash-ui/styles/dash-base.css';
import './style.css';

interface TimerState {
  slug: string;
  label: string | null;
  status: 'idle' | 'running' | 'paused' | 'done';
  mode: 'countdown' | 'stopwatch';
  duration: number | null;
  startedAt: number | null;
  elapsed: number;
}

function computeDisplayMs(timer: TimerState, now: number): number {
  const totalElapsed =
    timer.status === 'running'
      ? timer.elapsed + (now - (timer.startedAt ?? now))
      : timer.elapsed;
  return totalElapsed;
}

interface StopwatchConfig {
  slug: string;
  title: string;
  size: 's' | 'm' | 'l' | 'xl';
  showMilliseconds: boolean;
}

function formatTime(ms: number): { main: string; subsec: string } {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return {
    main: `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`,
    subsec: `.${centiseconds.toString().padStart(2, '0')}`,
  };
}

export default function StopwatchViz() {
  const allStates = useConnectorData<Record<string, TimerState>>('hubble-timer', 'hubble-timer:state');
  const config = useWidgetConfig<StopwatchConfig>();

  const timer: TimerState | null = allStates?.[config.slug] ?? null;

  const showMs = config.showMilliseconds ?? false;

  const [, setTick] = useState(0);
  useEffect(() => {
    if (timer?.status !== 'running') return;
    const interval = showMs ? 50 : 1000;
    const id = setInterval(() => setTick((n) => n + 1), interval);
    return () => clearInterval(id);
  }, [timer?.status, showMs]);

  // ── Derived display values ─────────────────────────────
  const state = timer?.status ?? 'idle';
  const label = timer?.label ?? config.title;
  const size = config.size ?? 'm';
  const isXl = size === 'xl';
  const isIdle = state === 'idle';

  let timeMain = '--:--';
  let timeMs = '.00';
  if (!isIdle && timer) {
    const ms = computeDisplayMs(timer, Date.now());
    const formatted = formatTime(ms);
    timeMain = formatted.main;
    timeMs = formatted.subsec;
  }

  const stateLabel = isIdle ? 'WAITING' : state === 'paused' ? 'PAUSED' : 'ELAPSED';
  const showShell = !isXl;

  const inner = (
    <div
      className="timer-stopwatch"
      data-state={state}
      data-size={size}
    >
      {showShell && label && <DashWidgetHeader label={label} />}

      <div className="timer-sw-display">
        <div className="timer-sw-time">
          <span className="timer-time">{timeMain}</span>
          {showMs && <span className="timer-sw-ms">{timeMs}</span>}
        </div>
        <div className="timer-state-label">{stateLabel}</div>
      </div>

      {!showShell && label && (
        <div className="timer-ambient-label t-label">{label}</div>
      )}
    </div>
  );

  if (showShell) {
    return <DashWidget>{inner}</DashWidget>;
  }
  return inner;
}
