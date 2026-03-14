import React, { useEffect, useRef, useState } from 'react';
import { useConnectorData, useWidgetConfig, useHubbleSDK } from '@hubble/sdk';
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
  if (timer.mode === 'countdown' && timer.duration != null) {
    return Math.max(0, timer.duration - totalElapsed);
  }
  return totalElapsed;
}

interface StopwatchConfig {
  slug: string;
  title: string;
  size: 's' | 'm' | 'l' | 'xl';
  doneExpand: boolean;
  doneFlash: boolean;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function StopwatchViz() {
  const allStates = useConnectorData<Record<string, TimerState>>();
  const config = useWidgetConfig<StopwatchConfig>();
  const sdk = useHubbleSDK();
  const timerRef = useRef<TimerState | null>(null);

  const timer: TimerState | null = allStates?.[config.slug] ?? null;
  timerRef.current = timer;

  // Tick every second while running so the display updates client-side
  const [, setTick] = useState(0);
  useEffect(() => {
    if (timer?.status !== 'running') return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [timer?.status]);

  // Hardware buttons
  useEffect(() => {
    const unsubToggle = sdk.onButton('button1', async () => {
      const action = timerRef.current?.status === 'running' ? 'pause' : 'resume';
      await fetch(`/api/module/hubble-timer/api/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: config.slug }),
      });
    });
    const unsubReset = sdk.onButton('button2', async () => {
      await fetch('/api/module/hubble-timer/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: config.slug }),
      });
    });
    return () => { unsubToggle(); unsubReset(); };
  }, [sdk, config.slug]);

  // Done expand behavior
  useEffect(() => {
    if (timer?.status === 'done' && config.doneExpand) {
      sdk.requestAcknowledge();
    }
  }, [timer?.status, config.doneExpand, sdk]);

  // ── Derived display values ─────────────────────────────
  const status = timer?.status ?? 'idle';
  const label = timer?.label ?? config.title;
  const size = config.size ?? 'm';
  const isIdle = status === 'idle';
  const isPaused = status === 'paused';
  const isDone = status === 'done';
  const doFlash = isDone && config.doneFlash;

  let timeText = '--:--';
  if (!isIdle && timer) {
    timeText = formatTime(computeDisplayMs(timer, Date.now()));
  }

  const containerClass = [
    'stopwatch',
    `stopwatch--${size}`,
    isPaused ? 'stopwatch--paused' : '',
    doFlash ? 'stopwatch--flash' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClass}>
      {!isIdle && (
        <span className="stopwatch__label">{label}</span>
      )}
      <span className={`stopwatch__time${isIdle ? ' stopwatch__time--faded' : ''}`}>
        {timeText}
      </span>
      <span className={[
        'stopwatch__sublabel',
        isIdle ? 'stopwatch__sublabel--waiting' : '',
        isPaused ? 'stopwatch__sublabel--paused' : '',
      ].filter(Boolean).join(' ')}>
        {isIdle ? 'WAITING' : isPaused ? 'PAUSED' : 'ELAPSED'}
      </span>
    </div>
  );
}
