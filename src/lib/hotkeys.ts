import { createMultiHotkeyHandler } from '@tanstack/hotkeys';

export interface HotkeyActions {
  onNext: () => void;
  onPrev: () => void;
  onSave: () => void;
  onDismiss: () => void;
  onReset?: () => void;
  onUndo?: () => void;
  onViewFeed?: () => void;
  onViewSaved?: () => void;
  onViewHistory?: () => void;
  onViewSettings?: () => void;
  onEscape?: () => void;
}

export function setupHotkeys(actions: HotkeyActions) {
  const handlerMap: Record<string, (e: KeyboardEvent) => void> = {
    j: () => actions.onNext(),
    k: () => actions.onPrev(),
    s: () => actions.onSave(),
    d: () => actions.onDismiss(),
    u: () => actions.onUndo?.(),
    '1': () => actions.onViewFeed?.(),
    '2': () => actions.onViewSaved?.(),
    '3': () => actions.onViewHistory?.(),
    '4': () => actions.onViewSettings?.(),
    'Shift+?': () => actions.onViewSettings?.(),
    escape: () => actions.onEscape?.(),
  };

  const handler = createMultiHotkeyHandler(handlerMap, {
    preventDefault: true,
    stopPropagation: true,
  });

  const listener = (e: KeyboardEvent) => {
    // Check if any modal dialog or dropdown menu is currently open in the DOM
    const isModalOpen = typeof document !== 'undefined' && (
      !!document.querySelector('[role="dialog"]') ||
      !!document.querySelector('[aria-modal="true"]') ||
      !!document.querySelector('[role="listbox"]')
    );

    if (isModalOpen) {
      // Active modal or dropdown handles its own Escape key
      return;
    }

    const target = e.target as Element | null;
    const isInput = target && typeof target.closest === 'function' && (
      target.tagName === 'INPUT' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'TEXTAREA' ||
      (target as HTMLElement).isContentEditable ||
      !!target.closest('[contenteditable="true"]') ||
      ['textbox', 'combobox', 'searchbox'].includes(target.getAttribute('role') || '')
    );

    if (isInput) {
      if (e.key === 'Escape' && target instanceof HTMLElement) {
        target.blur();
      }
      return;
    }

    handler(e);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', listener);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', listener);
    }
  };
}
