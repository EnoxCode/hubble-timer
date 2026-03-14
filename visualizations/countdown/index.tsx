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

interface CountdownConfig {
  slug: string;
  title: string;
  size: 's' | 'm' | 'l' | 'xl';
  doneExpand: boolean;
  doneFlash: boolean;
  warningThreshold: number;
}

const RING_RADIUS = 44;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const VIEWBOX = 100;
const CX = VIEWBOX / 2;
const CY = VIEWBOX / 2;

function formatTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function CountdownViz() {
  const allStates = useConnectorData<Record<string, TimerState>>();
  const config = useWidgetConfig<CountdownConfig>();
  const sdk = useHubbleSDK();
  const timerRef = useRef<TimerState | null>(null);

  const timer: TimerState | null = allStates?.[config.slug] ?? null;
  timerRef.current = timer;
  console.log('[countdown] config.slug:', config.slug, '| allStates keys:', allStates ? Object.keys(allStates) : null, '| timer:', timer?.status ?? 'null');

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

  // Done expand behavior (client-side presentation API)
  useEffect(() => {
    if (timer?.status === 'done' && config.doneExpand) {
      sdk.requestAcknowledge();
    }
  }, [timer?.status, config.doneExpand, sdk]);

  // ── Derived display values ─────────────────────────────
  const status = timer?.status ?? 'idle';
  const label = timer?.label ?? config.title;
  const size = config.size ?? 'm';
  const warningMs = (config.warningThreshold ?? 300) * 1000;

  let displayMs = 0;
  let arcRatio = 0;
  let timeText = '--:--';

  if (status === 'done') {
    timeText = '00:00';
    arcRatio = 0;
  } else if (status !== 'idle' && timer) {
    displayMs = computeDisplayMs(timer, Date.now());
    timeText = formatTime(displayMs);
    if (timer.duration) arcRatio = displayMs / timer.duration;
  }

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isDone = status === 'done';
  const isIdle = status === 'idle';
  const isRed = isRunning && displayMs <= warningMs && displayMs > 0;
  const doFlash = isDone && config.doneFlash;

  const arcLength = arcRatio * RING_CIRCUMFERENCE;
  const gapLength = RING_CIRCUMFERENCE - arcLength;

  const containerClass = [
    'countdown',
    `countdown--${size}`,
    isDone ? 'countdown--done' : '',
    doFlash ? 'countdown--flash' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClass}>
      {!isIdle && (
        <span className={`countdown__label${isPaused || isDone ? ' countdown__label--faded' : ''}`}>
          {label}
        </span>
      )}
      <svg
        className="countdown__ring"
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className={`countdown__track${isDone ? ' countdown__track--done' : ''}`}
          cx={CX} cy={CY} r={RING_RADIUS} strokeWidth={8}
        />
        {!isDone && (
          <circle
            className={[
              'countdown__arc',
              isIdle ? 'countdown__arc--dashed' : '',
              isRed ? 'countdown__arc--red' : '',
              isPaused ? 'countdown__arc--dimmed' : '',
            ].filter(Boolean).join(' ')}
            cx={CX} cy={CY} r={RING_RADIUS} strokeWidth={8}
            strokeDasharray={isIdle ? '7 5' : `${arcLength} ${gapLength}`}
            strokeDashoffset={0}
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        )}
        <text
          className={[
            'countdown__time',
            isPaused ? 'countdown__time--faded' : '',
            isDone ? 'countdown__time--done' : '',
          ].filter(Boolean).join(' ')}
          x={CX} y={CY - 5}
          textAnchor="middle" dominantBaseline="middle"
        >
          {timeText}
        </text>
        <text
          className={[
            'countdown__sublabel',
            isDone ? 'countdown__sublabel--done' : '',
            isPaused ? 'countdown__sublabel--paused' : '',
          ].filter(Boolean).join(' ')}
          x={CX} y={CY + 13}
          textAnchor="middle"
        >
          {isDone ? 'DONE' : isPaused ? 'PAUSED' : isIdle ? 'WAITING' : 'REMAINING'}
        </text>
      </svg>
    </div>
  );
}
