import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { TONE_BADGE, type Tone } from '../lib/status.ts';

export function PrimaryButton({
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-base font-semibold text-white hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 text-base font-semibold text-white hover:bg-red-600 disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function CallAnchor({
  href,
  children,
  className = '',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={`inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-lg font-bold text-white hover:bg-emerald-500 ${className}`}
    >
      <i className="fa-solid fa-phone" aria-hidden="true" />
      {children}
    </a>
  );
}

export function Card({
  children,
  className = '',
  toneBar,
}: {
  children: ReactNode;
  className?: string;
  toneBar?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${toneBar ?? ''} ${className}`}>
      {children}
    </section>
  );
}

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${TONE_BADGE[tone]}`}>
      {children}
    </span>
  );
}

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:ring-2 focus:ring-indigo-500 ${className}`}
      {...props}
    />
  );
}

export function TextArea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:ring-2 focus:ring-indigo-500 ${className}`}
      rows={4}
      {...props}
    />
  );
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:ring-2 focus:ring-indigo-500 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
