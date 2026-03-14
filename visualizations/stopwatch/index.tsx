import React, { useEffect, useRef } from 'react';
import { useConnectorData, useWidgetConfig, useHubbleSDK } from '@hubble/sdk';
import { TimerState, computeDisplayMs } from '../../connector/timerState';
import './style.css';

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

  // Hardware buttons
  useEffect(() => {
    const unsubToggle = sdk.onButton('button1', async () => {
      const action = timerRef.current?.status === 'running' ? 'pause' : 'resume';
      await fetch(`/api/modules/hubble-timer/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: config.slug }),
      });
    });
    const unsubReset = sdk.onButton('button2', async () => {
      await fetch('/api/modules/hubble-timer/reset', {
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
