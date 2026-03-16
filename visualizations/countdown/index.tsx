import React, { useEffect, useState } from 'react';
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

const CIRCUMFERENCE = 2 * Math.PI * 40; // r=40, ≈251.3

function formatTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getArcDasharray(secondsRemaining: number, totalSeconds: number): string {
  const progress = Math.max(0, Math.min(1, secondsRemaining / totalSeconds));
  const arcLength = CIRCUMFERENCE * progress;
  const gapLength = CIRCUMFERENCE - arcLength;
  return `${arcLength.toFixed(1)} ${gapLength.toFixed(1)}`;
}

export default function CountdownViz() {
  const allStates = useConnectorData<Record<string, TimerState>>('hubble-timer', 'hubble-timer:state');
  const config = useWidgetConfig<CountdownConfig>();
  const sdk = useHubbleSDK();

  const timer: TimerState | null = allStates?.[config.slug] ?? null;

  const [, setTick] = useState(0);
  useEffect(() => {
    if (timer?.status !== 'running') return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [timer?.status]);

  useEffect(() => {
    if (timer?.status === 'done' && config.doneExpand) {
      sdk.requestAcknowledge();
    }
  }, [timer?.status, config.doneExpand, sdk]);

  // ── Derived display values ─────────────────────────────
  const baseStatus = timer?.status ?? 'idle';
  const label = timer?.label ?? config.title;
  const size = config.size ?? 'm';
  const warningMs = (config.warningThreshold ?? 300) * 1000;
  const isXl = size === 'xl';

  let displayMs = 0;
  let timeText = '--:--';
  let dasharray = `0 ${CIRCUMFERENCE.toFixed(1)}`;

  if (baseStatus === 'done') {
    timeText = '0:00';
  } else if (baseStatus !== 'idle' && timer) {
    displayMs = computeDisplayMs(timer, Date.now());
    timeText = formatTime(displayMs);
    if (timer.duration) {
      dasharray = getArcDasharray(displayMs / 1000, timer.duration / 1000);
    }
  }

  // Warning auto-derives from running state
  const isWarning = baseStatus === 'running' && displayMs > 0 && displayMs <= warningMs;
  const state = isWarning ? 'warning' : baseStatus;

  const stateLabel = state === 'done'
    ? 'DONE'
    : state === 'paused'
      ? 'PAUSED'
      : state === 'idle'
        ? 'WAITING'
        : 'REMAINING';

  const showShell = !isXl;

  return (
    <div
      className={`timer-countdown${showShell ? ' dash-glass dash-widget' : ''}`}
      data-state={state}
      data-size={size}
      data-flash={config.doneFlash && state === 'done' ? 'true' : undefined}
    >
      {showShell && label && (
        <div className="dash-widget-header">
          <span className="t-label">{label}</span>
        </div>
      )}

      <div className="timer-ring-wrap">
        <svg width="100" height="100" viewBox="0 0 100 100" className="timer-ring-svg">
          {/* Track — always full circle */}
          <circle
            className={`timer-ring-track${state === 'done' ? ' timer-ring-track--done' : ''}`}
            cx="50" cy="50" r="40"
            fill="none"
            stroke={state === 'done' ? 'rgba(248,113,113,0.20)' : 'rgba(255,255,255,0.07)'}
            strokeWidth="4"
          />
          {/* Arc */}
          {state === 'idle' ? (
            <circle
              className="timer-ring-arc timer-ring-arc--idle"
              cx="50" cy="50" r="40"
              fill="none"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="3"
              strokeDasharray="6 8"
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
          ) : state !== 'done' && (
            <circle
              className="timer-ring-arc"
              cx="50" cy="50" r="40"
              fill="none"
              stroke="var(--timer-arc-color)"
              strokeWidth="4"
              strokeDasharray={dasharray}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
            />
          )}
        </svg>

        <div className="timer-ring-center">
          <div className="timer-time">{timeText}</div>
          <div className="timer-state-label">{stateLabel}</div>
        </div>
      </div>

      {!showShell && label && (
        <div className="timer-ambient-label t-label">{label}</div>
      )}
    </div>
  );
}
