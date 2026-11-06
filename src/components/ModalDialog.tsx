'use client';

import React, { useCallback, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

let supportsDisplayTransition: boolean | undefined;

function canTransitionDisplay(): boolean {
  if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
  if (
    typeof window === 'undefined' ||
    !window.CSS?.supports?.('transition-behavior', 'allow-discrete') ||
    !document.body
  ) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  supportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return supportsDisplayTransition;
}

function supportsTopLayerExit(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.CSS?.supports?.('overlay', 'auto')) &&
    canTransitionDisplay()
  );
}

async function closeTopLayer(element: HTMLDialogElement) {
  if (!element.open) return;
  if (!supportsTopLayerExit()) {
    element.setAttribute('data-closing', '');
    const animations = element.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((r) => setTimeout(r, 2000)),
      ]);
    }
    if (!element.hasAttribute('data-closing')) return;
    element.removeAttribute('data-closing');
  }
  if (element.open) {
    element.close();
  }
}

export function ModalDialog({
  open,
  onClose,
  title,
  subtitle,
  maxWidthClass = 'max-w-3xl',
  children,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const requestClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    void closeTopLayer(dialog);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.removeAttribute('data-closing');
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        void closeTopLayer(dialog);
      }
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };

    const handleCancel = (event: Event) => {
      event.preventDefault();
      void closeTopLayer(dialog);
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('cancel', handleCancel);

    // Fallback for browsers without native closedby="any" support
    let cleanupFallback: (() => void) | undefined;
    if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const isOutside = (e: PointerEvent) => {
        const rect = dialog.getBoundingClientRect();
        return (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        );
      };
      const onPointerDown = (e: PointerEvent) => {
        if (e.target !== dialog) {
          pressedOutside = false;
          return;
        }
        pressedOutside = isOutside(e);
      };
      const onPointerUp = (e: PointerEvent) => {
        if (e.target === dialog && pressedOutside && isOutside(e)) {
          void closeTopLayer(dialog);
        }
        pressedOutside = false;
      };
      dialog.addEventListener('pointerdown', onPointerDown);
      dialog.addEventListener('pointerup', onPointerUp);
      cleanupFallback = () => {
        dialog.removeEventListener('pointerdown', onPointerDown);
        dialog.removeEventListener('pointerup', onPointerUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('cancel', handleCancel);
      if (cleanupFallback) cleanupFallback();
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, unknown>)}
      className={`m-auto w-[95vw] ${maxWidthClass} overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-0 text-slate-900 shadow-2xl ring-1 ring-slate-900/5`}
    >
      <div className="h-1.5 w-full bg-gradient-to-r from-teal-600 via-emerald-500 to-sky-500 no-print" />
      <div className="flex items-start justify-between border-b border-slate-200/80 bg-gradient-to-b from-slate-50/90 to-white px-6 py-4">
        <div className="pr-4">
          <h2 id={titleId} className="text-lg font-extrabold tracking-tight text-slate-900">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs font-medium text-slate-500">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={requestClose}
          aria-label="Đóng cửa sổ"
          className="no-print rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-2xs hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-colors"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="max-h-[80vh] overflow-y-auto p-6">{children}</div>
    </dialog>
  );
}
