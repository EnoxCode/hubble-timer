import React from 'react';

export const DashWidget = ({ children, className, statusBorder, ...rest }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode; className?: string; statusBorder?: string }) =>
  React.createElement('div', { className, 'data-status-border': statusBorder, ...rest }, children);

export const DashWidgetHeader = ({ label, meta, right }: { label: string; meta?: string; right?: React.ReactNode }) =>
  React.createElement('div', { className: 'dash-widget-header' },
    React.createElement('span', null, label),
    meta && React.createElement('span', null, meta),
    right,
  );

export const DashWidgetFooter = ({ label, status, updatedAt }: { label?: string; status?: string; updatedAt?: Date | number }) =>
  React.createElement('div', { className: 'dash-widget-footer' }, label);

export const DashStatusDot = ({ status, className }: { status: string; className?: string }) =>
  React.createElement('span', { className });

export const DashSkeleton = ({ height, width, className }: { height: number | string; width?: number | string; className?: string }) =>
  React.createElement('div', { className });

export const DashDivider = ({ className }: { className?: string }) =>
  React.createElement('hr', { className });

export const DashBadge = ({ children, state, className }: { children: React.ReactNode; state: string; className?: string }) =>
  React.createElement('span', { className }, children);

export const DashPill = ({ title }: { title: string }) =>
  React.createElement('span', null, title);

export const DashCarouselDots = ({ count, activeIndex }: { count: number; activeIndex: number }) =>
  React.createElement('div', null);

export const DashThumbnail = ({ src, alt }: { src?: string; alt?: string }) =>
  React.createElement('img', { src, alt });
