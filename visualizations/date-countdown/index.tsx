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
        <div className="dc-hero-num">TODAY</div>
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
        <div className="dc-hero-num">{parts.join(' ')}</div>
        <div className="dc-hero-unit">remaining</div>
      </div>
    );
  }
  return (
    <div className="dc-hero">
      <div className="dc-hero-num">{remaining.minutes}m {remaining.seconds}s</div>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
