<script module lang="ts">
  import Icon from './Icon.svelte'
  // Keyboard focus follows the focused card only after the user has interacted with the page,
  // so the first render never steals focus.
  let userHasInteracted = false;
  if (typeof window !== 'undefined') {
    const markInteracted = () => {
      userHasInteracted = true;
    };
    window.addEventListener('keydown', markInteracted, { capture: true, once: true });
    window.addEventListener('pointerdown', markInteracted, { capture: true, once: true });
  }
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import type { TrendshiftRepo } from './types';
  import { seenStore } from './seen.svelte';
  import RepoItem from './RepoItem.svelte';
  
  let {
    repo,
    index,
    isFocused = false,
    onExplicitDismiss
  } = $props<{
    repo: TrendshiftRepo;
    index: number;
    isFocused?: boolean;
    onExplicitDismiss?: (repo: TrendshiftRepo) => void;
  }>();

  let cardRef: HTMLElement | null = $state(null);

  // Touch Swipe Gesture State
  let startX = 0;
  let startY = 0;
  let deltaX = $state(0);
  let isSwiping = $state(false);
  let isHorizontalSwipe = false;

  let isSeen = $derived(seenStore.isSeen(repo.full_name));
  let isSaved = $derived(seenStore.isSaved(repo.full_name));

  let swipeStyle = $derived.by(() => {
    let style = seenStore.swipeGesturesEnabled ? 'touch-action: pan-y; ' : '';
    style += `transform: translateX(${deltaX}px);`;
    if (isSwiping) {
      style += ' transition: none;';
    } else {
      style += ' transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);';
    }
    return style;
  });

  function triggerDismiss() {
    if (onExplicitDismiss) {
      onExplicitDismiss(repo);
    } else {
      void seenStore.markSeen(repo);
    }
  }

  // Seen toggles: an already-seen card is restored, any other card is marked seen.
  function toggleSeen() {
    if (isSeen) {
      void seenStore.unsee(repo.full_name);
    } else {
      triggerDismiss();
    }
  }

  function isTextEntry(element: Element | null) {
    return element instanceof HTMLElement && (element.isContentEditable || element.matches('input, textarea, select'));
  }

  // Moving the focused highlight moves DOM focus onto the card, so removing a control does not drop focus to the body.
  $effect(() => {
    const card = cardRef;
    if (!isFocused || !card || !userHasInteracted) return;
    untrack(() => {
      if (card.contains(document.activeElement)) return;
      if (isTextEntry(document.activeElement)) return;
      card.focus({ preventScroll: true });
    });
  });

  // Swipe listeners exist only while gestures are enabled, so disabled cards keep native scrolling.
  $effect(() => {
    const card = cardRef;
    if (!card || !seenStore.swipeGesturesEnabled) return;

    const endGesture = () => {
      isSwiping = false;
      isHorizontalSwipe = false;
      deltaX = 0;
      card.removeEventListener('touchmove', handleTouchMove);
    };

    // Non-passive only while a gesture is in flight. It is removed once the gesture turns vertical.
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!isSwiping || !touch) return;

      const diffX = touch.clientX - startX;
      const diffY = touch.clientY - startY;

      if (!isHorizontalSwipe) {
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 8) {
          isHorizontalSwipe = true;
        } else if (Math.abs(diffY) > 8) {
          endGesture();
          return;
        } else {
          return;
        }
      }

      if (e.cancelable) {
        e.preventDefault();
      }
      deltaX = diffX;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isSwiping = true;
      isHorizontalSwipe = false;
      deltaX = 0;
      card.addEventListener('touchmove', handleTouchMove, { passive: false });
    };

    const handleTouchEnd = () => {
      const THRESHOLD = 100;

      if (isSwiping) {
        if (deltaX > THRESHOLD) {
          void seenStore.toggleSave(repo);
        } else if (deltaX < -THRESHOLD) {
          toggleSeen();
        }
      }
      endGesture();
    };

    card.addEventListener('touchstart', handleTouchStart, { passive: true });
    card.addEventListener('touchend', handleTouchEnd, { passive: true });
    // A cancelled touch only resets the gesture. It never saves or dismisses.
    card.addEventListener('touchcancel', endGesture, { passive: true });

    return () => {
      card.removeEventListener('touchstart', handleTouchStart);
      card.removeEventListener('touchend', handleTouchEnd);
      card.removeEventListener('touchcancel', endGesture);
      endGesture();
    };
  });

  function handleSaveClick(e: MouseEvent) {
    e.stopPropagation();
    void seenStore.toggleSave(repo);
  }

  function handleSeenClick(e: MouseEvent) {
    e.stopPropagation();
    toggleSeen();
  }
</script>

<div class="relative rounded-xl">
  <!-- Underlying Action Background Layer -->
  <div
    class="absolute inset-0 rounded-xl overflow-hidden flex items-center justify-between px-6 transition-all duration-150 {
      deltaX > 0
        ? 'bg-emerald-700 opacity-100'
        : deltaX < 0
          ? 'bg-rose-600 opacity-100'
          : 'bg-transparent opacity-0 pointer-events-none'
    }"
  >
    <!-- Right Swipe Action (Bookmark) -->
    <div class="flex items-center gap-2 text-white font-bold text-sm select-none">
      <Icon name="bookmark" size={18} class="text-white" />
      <span>{isSaved ? 'Unbookmark' : 'Bookmark'}</span>
    </div>

    <!-- Left Swipe Action (Seen / Unseen) -->
    <div class="flex items-center gap-2 text-white font-bold text-sm select-none">
      <span>{isSeen ? 'Unseen' : 'Seen'}</span>
      <Icon name="check" size={18} class="text-white" />
    </div>
  </div>

  <!-- Sliding Foreground Card Container -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <article
    bind:this={cardRef}
    tabindex={isFocused ? 0 : -1}
    aria-label="{repo.full_name} repository"
    style={swipeStyle}
    class="relative z-10 focus-visible:outline-none rounded-xl"
  >
    <RepoItem
      {repo}
      rank={repo.rank || index + 1}
      {isFocused}
      {isSeen}
    >
      {#snippet actions()}
        <!-- Save Bookmark Button -->
        <button
          type="button"
          onclick={handleSaveClick}
          aria-label={isSaved ? `Saved: remove ${repo.full_name} bookmark` : `Save ${repo.full_name} bookmark`}
          aria-pressed={isSaved ? 'true' : 'false'}
          title={isSaved ? 'Remove bookmark (S)' : 'Save bookmark (S)'}
          class="inline-flex items-center gap-1.5 min-h-11 sm:min-h-9 px-2.5 rounded-md border font-sans text-xs font-medium btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)] {
            isSaved
              ? 'bg-[var(--accent-signal-soft-bg)] text-[var(--accent-signal-soft-text)] border-[var(--accent-signal)]/50'
              : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-main)] hover:border-[var(--border-strong)]'
          }"
        >
          <Icon name="bookmark" size={15} filled={isSaved} aria-hidden="true" />
          <span>{isSaved ? 'Saved' : 'Save'}</span>
        </button>

        <!-- Seen Toggle Button -->
        <button
          type="button"
          onclick={handleSeenClick}
          aria-label={isSeen ? `Mark ${repo.full_name} as unseen` : `Mark ${repo.full_name} as seen`}
          aria-pressed={isSeen ? 'true' : 'false'}
          title={isSeen ? 'Mark unseen' : 'Mark seen (D)'}
          class="inline-flex items-center gap-1.5 min-h-11 sm:min-h-9 px-2.5 rounded-md border font-sans text-xs font-medium btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)] {
            isSeen
              ? 'bg-[var(--badge-green-bg)] text-[var(--badge-green-text)] border-[var(--badge-green-text)]/30'
              : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--badge-green-text)] hover:border-[var(--badge-green-text)]/30'
          }"
        >
          <Icon name="check" size={15} aria-hidden="true" />
          <span>{isSeen ? 'Unseen' : 'Seen'}</span>
        </button>
      {/snippet}
    </RepoItem>
  </article>
</div>
