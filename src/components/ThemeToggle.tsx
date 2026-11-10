'use client';

import React, { useEffect, useId, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

export type ColorSchemePreference = 'light' | 'dark' | 'light dark';

export function applyColorScheme(pref: ColorSchemePreference): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) {
    meta.content = pref;
  }
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const resolved: 'light' | 'dark' =
    pref === 'dark' || (pref === 'light dark' && prefersDark) ? 'dark' : 'light';
  document.documentElement.dataset.theme = resolved;
  return resolved;
}

interface ThemeToggleProps {
  onResolvedThemeChange?: (resolved: 'light' | 'dark', pref: ColorSchemePreference) => void;
}

export function ThemeToggle({ onResolvedThemeChange }: ThemeToggleProps) {
  const groupId = useId();
  const [scheme, setScheme] = useState<ColorSchemePreference>('light');

  useEffect(() => {
    let initial: ColorSchemePreference = 'light';
    try {
      const saved = localStorage.getItem('color-scheme');
      if (saved === 'light' || saved === 'dark' || saved === 'light dark') {
        initial = saved;
      }
    } catch {
      // Ignore storage access errors in restricted contexts
    }
    setScheme(initial);
    const resolved = applyColorScheme(initial);
    onResolvedThemeChange?.(resolved, initial);

    const handleStorage = (e: StorageEvent) => {
      if (e.key !== 'color-scheme') return;
      const next: ColorSchemePreference =
        e.newValue === 'dark' || e.newValue === 'light dark' || e.newValue === 'light'
          ? e.newValue
          : 'light';
      setScheme(next);
      const nextResolved = applyColorScheme(next);
      onResolvedThemeChange?.(nextResolved, next);
    };

    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    const handleMediaChange = () => {
      let current: ColorSchemePreference = 'light';
      try {
        const saved = localStorage.getItem('color-scheme');
        if (saved === 'light' || saved === 'dark' || saved === 'light dark') {
          current = saved;
        }
      } catch {
        // Ignore
      }
      if (current === 'light dark') {
        const nextResolved = applyColorScheme(current);
        onResolvedThemeChange?.(nextResolved, current);
      }
    };

    window.addEventListener('storage', handleStorage);
    mediaQuery?.addEventListener?.('change', handleMediaChange);
    return () => {
      window.removeEventListener('storage', handleStorage);
      mediaQuery?.removeEventListener?.('change', handleMediaChange);
    };
  }, [onResolvedThemeChange]);

  const handleSelect = (next: ColorSchemePreference) => {
    setScheme(next);
    const resolved = applyColorScheme(next);
    try {
      localStorage.setItem('color-scheme', next);
    } catch {
      // Ignore storage write errors
    }
    onResolvedThemeChange?.(resolved, next);
  };

  const options: Array<{
    value: ColorSchemePreference;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  }> = [
    { value: 'light', label: 'Giao diện Sáng (Light Mode)', shortLabel: 'Sáng', icon: Sun },
    { value: 'dark', label: 'Giao diện Tối (Dark Mode)', shortLabel: 'Tối', icon: Moon },
    { value: 'light dark', label: 'Theo hệ thống (Auto)', shortLabel: 'Hệ thống', icon: Monitor },
  ];

  return (
    <fieldset className="inline-flex items-center gap-0.5 rounded-2xl border border-slate-200/90 bg-slate-100/90 p-1 shadow-2xs">
      <legend className="visually-hidden">Chế độ màu giao diện (Sáng / Tối / Hệ thống)</legend>
      {options.map((opt) => {
        const Icon = opt.icon;
        const checked = scheme === opt.value;
        const inputId = `${groupId}-${opt.value.replace(/\s+/g, '-')}`;
        return (
          <label
            key={opt.value}
            htmlFor={inputId}
            title={opt.label}
            className={`relative inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all select-none ${
              checked
                ? 'bg-white text-teal-800 shadow-xs ring-1 ring-teal-500/30'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <input
              id={inputId}
              type="radio"
              name={`color-scheme-${groupId}`}
              value={opt.value}
              checked={checked}
              onChange={() => handleSelect(opt.value)}
              className="visually-hidden"
            />
            <Icon
              className={`h-3.5 w-3.5 ${
                checked
                  ? opt.value === 'light'
                    ? 'text-amber-500'
                    : opt.value === 'dark'
                    ? 'text-indigo-500'
                    : 'text-teal-600'
                  : 'text-slate-400'
              }`}
              aria-hidden={true}
            />
            <span className="hidden md:inline">{opt.shortLabel}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
