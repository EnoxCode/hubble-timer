/**
 * Hubble UI Type Definitions
 *
 * Standalone declaration file for Hubble module developers.
 * Copy this file into your module project for full type support.
 * At runtime, these components are provided by the host app via globalThis.__hubbleExternals.HubbleUI.
 */

import * as React from 'react';

// ─── Button ───────────────────────────────────────────────────────

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export declare function Button(props: ButtonProps): React.ReactElement;

export interface IconButtonProps {
  variant?: 'default' | 'danger';
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export declare function IconButton(props: IconButtonProps): React.ReactElement;

// ─── Input ────────────────────────────────────────────────────────

export interface InputProps {
  type?: 'text' | 'url' | 'number' | 'password' | 'datetime' | 'textarea';
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  suffix?: string;
  trailingIcon?: React.ReactNode;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  disabled?: boolean;
  rows?: number;
  'aria-label'?: string;
}

export declare function Input(props: InputProps): React.ReactElement;

// ─── Select ───────────────────────────────────────────────────────

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  'aria-label'?: string;
}

export declare function Select(props: SelectProps): React.ReactElement;

// ─── Slider ───────────────────────────────────────────────────────

export interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  'aria-label'?: string;
}

export declare function Slider(props: SliderProps): React.ReactElement;

// ─── Toggle ───────────────────────────────────────────────────────

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export declare function Toggle(props: ToggleProps): React.ReactElement;

// ─── ColorPicker ──────────────────────────────────────────────────

export interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  'aria-label'?: string;
}

export declare function ColorPicker(props: ColorPickerProps): React.ReactElement;

// ─── StatusDot ────────────────────────────────────────────────────

export interface StatusDotProps {
  status: 'success' | 'warning' | 'danger' | 'muted';
  label: string;
}

export declare function StatusDot(props: StatusDotProps): React.ReactElement;

// ─── Badge ────────────────────────────────────────────────────────

export interface BadgeProps {
  variant?: 'success' | 'warning' | 'accent' | 'muted';
  children: React.ReactNode;
}

export declare function Badge(props: BadgeProps): React.ReactElement;

// ─── Field ────────────────────────────────────────────────────────

export interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

export declare function Field(props: FieldProps): React.ReactElement;

// ─── Collapsible ──────────────────────────────────────────────────

export interface CollapsibleProps {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export declare function Collapsible(props: CollapsibleProps): React.ReactElement;
