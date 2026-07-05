'use client';

import clsx from 'clsx';
import React from 'react';

/**
 * Small, dependency-light design system. Everything is finger-friendly (44px
 * min targets via globals.css), readable, and consistent with the timber/
 * blueprint construction theme.
 */

export const cn = clsx;

// ---- Button ---------------------------------------------------------------
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  variant = 'secondary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const map: Record<ButtonVariant, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  };
  return <button className={cn(map[variant], className)} {...props} />;
}

// ---- Card -----------------------------------------------------------------
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card', className)} {...props} />;
}
export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />;
}

export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-timber-900">{title}</h2>
        {subtitle && <p className="text-sm text-timber-600">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

// ---- Stat -----------------------------------------------------------------
export function Stat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const toneMap = {
    default: 'text-timber-900',
    good: 'text-moss-600',
    warn: 'text-amber-600',
    bad: 'text-red-600',
  };
  return (
    <div className="rounded-xl border border-timber-200 bg-white p-3 shadow-card">
      <div className="text-xs font-semibold uppercase tracking-wide text-timber-500">{label}</div>
      <div className={cn('mt-1 text-xl font-bold sm:text-2xl', toneMap[tone])}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-timber-500">{sub}</div>}
    </div>
  );
}

// ---- Badge / Pill ---------------------------------------------------------
export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn('badge', className)}>{children}</span>;
}

// ---- Fields ---------------------------------------------------------------
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-timber-500">{hint}</span>}
    </label>
  );
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <input
        type="number"
        className="input pr-12"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(v);
          else if (e.target.value === '') onChange(0);
        }}
        inputMode="decimal"
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-timber-400">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <input
      type="range"
      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-timber-200 accent-blueprint-600"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3"
      aria-pressed={checked}
    >
      <span
        className={cn(
          'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors',
          checked ? 'bg-blueprint-600' : 'bg-timber-300',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </span>
      {label && <span className="text-sm font-medium text-timber-800">{label}</span>}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-timber-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
            value === o.value ? 'bg-white text-blueprint-700 shadow-card' : 'text-timber-600 hover:text-timber-900',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <select
      className={cn('input', className)}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ---- Progress -------------------------------------------------------------
export function ProgressBar({ value, tone = 'blueprint' }: { value: number; tone?: 'blueprint' | 'moss' | 'amber' | 'red' }) {
  const toneMap = {
    blueprint: 'bg-blueprint-600',
    moss: 'bg-moss-600',
    amber: 'bg-amber-500',
    red: 'bg-red-600',
  };
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-timber-200">
      <div
        className={cn('h-full rounded-full transition-all', toneMap[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

// ---- States ---------------------------------------------------------------
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-5 w-5 animate-spin text-blueprint-600', className)}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-timber-300 bg-white/60 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-timber-400">{icon}</div>}
      <h3 className="text-base font-semibold text-timber-800">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-timber-500">{children}</p>}
    </div>
  );
}

// ---- Modal ----------------------------------------------------------------
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-pop sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-timber-200 p-4">
          <h3 className="text-lg font-bold text-timber-900">{title}</h3>
          <button className="btn-ghost -mr-2 px-2" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-timber-200 p-4">{footer}</div>}
      </div>
    </div>
  );
}
