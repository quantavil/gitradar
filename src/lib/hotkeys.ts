import { createMultiHotkeyHandler } from '@tanstack/hotkeys';

export interface HotkeyActions {
  onNext: () => void;
  onPrev: () => void;
  onSave: () => void;
  onDismiss: () => void;
  onUndo?: () => void;
  onViewFeed?: () => void;
  onViewSaved?: () => void;
  onViewHistory?: () => void;
  onViewSettings?: () => void;
  onEscape?: () => void;
}

export interface HotkeyOptions {
  /**
   * Whether single-key (character) shortcuts are active. Escape is always active.
   * Lets users turn off character keys (WCAG 2.1.4 Character Key Shortcuts).
   */
  characterShortcutsEnabled?: () => boolean;
}

export function setupHotkeys(actions: HotkeyActions, options: HotkeyOptions = {}) {
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
      !!document.querySelector('dialog[open]') ||
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
      // A combobox trigger (for example the language picker button) is not text entry.
      // Its open listbox is handled by the [role="listbox"] guard above.
      ['textbox', 'searchbox'].includes(target.getAttribute('role') || '')
    );

    if (isInput) {
      if (e.key === 'Escape' && target instanceof HTMLElement) {
        target.blur();
      }
      return;
    }

    const characterShortcutsOn = options.characterShortcutsEnabled?.() ?? true;
    if (e.key !== 'Escape' && !characterShortcutsOn) {
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
