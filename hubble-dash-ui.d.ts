/**
 * Hubble Dash UI Type Definitions
 *
 * Standalone declaration file for Hubble dashboard module developers.
 * Copy this file into your module project for full type support.
 * At runtime, components are provided by the host app.
 *
 * Usage: import { DashWidget, DashWidgetHeader, DashWidgetFooter } from 'hubble-dash-ui';
 *        import 'hubble-dash-ui/styles/dash-base.css';
 */

import * as React from 'react';

// ─── DashWidget ────────────────────────────────────────────────────

export interface DashWidgetProps {
  children: React.ReactNode;
  className?: string;
}
export declare function DashWidget(props: DashWidgetProps): React.ReactElement;

// ─── DashWidgetHeader ──────────────────────────────────────────────

export interface DashWidgetHeaderProps {
  label: string;
  meta?: string;
  right?: React.ReactNode;
}
export declare function DashWidgetHeader(props: DashWidgetHeaderProps): React.ReactElement;

// ─── DashWidgetFooter ──────────────────────────────────────────────

export interface DashWidgetFooterProps {
  updatedAt?: Date | number;
  status?: 'ok' | 'warn' | 'error';
  label?: string;
}
export declare function DashWidgetFooter(props: DashWidgetFooterProps): React.ReactElement;

// ─── DashStatusDot ────────────────────────────────────────────────

export interface DashStatusDotProps {
  status: 'ok' | 'warn' | 'error';
  className?: string;
}
export declare function DashStatusDot(props: DashStatusDotProps): React.ReactElement;

// ─── DashSkeleton ─────────────────────────────────────────────────

export interface DashSkeletonProps {
  height: number | string;
  width?: number | string;
  className?: string;
}
export declare function DashSkeleton(props: DashSkeletonProps): React.ReactElement;

// ─── DashDivider ──────────────────────────────────────────────────

export interface DashDividerProps {
  className?: string;
}
export declare function DashDivider(props: DashDividerProps): React.ReactElement;

// ─── DashBadge ────────────────────────────────────────────────────

export type DashBadgeState = 'positive' | 'warning' | 'critical' | 'info' | 'neutral';

export interface DashBadgeProps {
  state: DashBadgeState;
  children: React.ReactNode;
  className?: string;
}
export declare function DashBadge(props: DashBadgeProps): React.ReactElement;

// ─── DashPill ─────────────────────────────────────────────────────

export type DashPillState = 'positive' | 'info' | 'warning' | 'critical' | 'neutral';
export type DashPillVariant = 'glass' | 'full';

export interface DashPillProps {
  title: string;
  time?: string;
  location?: string;
  state: DashPillState;
  variant: DashPillVariant;
  className?: string;
}

export interface DashPillDotProps {
  color: string;
  label: string;
}

export declare function DashPill(props: DashPillProps): React.ReactElement;
export declare namespace DashPill {
  function Dot(props: DashPillDotProps): React.ReactElement;
}

// ─── DashCarouselDots ─────────────────────────────────────────────

export interface DashCarouselDotsProps {
  count: number;
  activeIndex: number;
  className?: string;
}
export declare function DashCarouselDots(props: DashCarouselDotsProps): React.ReactElement;

// ─── DashThumbnail ────────────────────────────────────────────────

export interface DashThumbnailProps {
  src?: string;
  alt?: string;
  size?: number;
  aspectRatio?: string;
  borderRadius?: number;
  className?: string;
}
export declare function DashThumbnail(props: DashThumbnailProps): React.ReactElement;
