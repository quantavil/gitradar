<script lang="ts">
  import { onMount } from 'svelte';
  import type { TrendshiftRepo } from './types';
  import { seenStore } from './seen.svelte';
  import RepoItem from './RepoItem.svelte';
  import {
    BookmarkIcon,
    CheckIcon
  } from './icons';

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

  let cardRef: HTMLElement | null = null;

  // Touch Swipe Gesture State
  let startX = 0;
  let startY = 0;
  let deltaX = $state(0);
  let isSwiping = $state(false);
  let isHorizontalSwipe = false;

  let isSeen = $derived(seenStore.isSeen(repo.full_name));
  let isSaved = $derived(seenStore.isSaved(repo.full_name));

  let swipeStyle = $derived.by(() => {
    let style = `touch-action: pan-y; transform: translateX(${deltaX}px);`;
    if (isSwiping) {
      style += ' transition: none;';
    } else {
      style += ' transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);';
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

  onMount(() => {
    if (!cardRef || typeof window === 'undefined') return;

    const handleTouchStart = (e: TouchEvent) => {
      if (!seenStore.swipeGesturesEnabled) return;
      if (e.touches.length !== 1) return;

      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isSwiping = true;
      isHorizontalSwipe = false;
      deltaX = 0;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!seenStore.swipeGesturesEnabled || !isSwiping) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - startX;
      const diffY = currentY - startY;

      // Lock vertical scroll if horizontal swipe intent detected
      if (!isHorizontalSwipe) {
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 8) {
          isHorizontalSwipe = true;
        } else if (Math.abs(diffY) > 8) {
          isSwiping = false;
          deltaX = 0;
          return;
        }
      }

      if (isHorizontalSwipe) {
        if (e.cancelable) {
          e.preventDefault();
        }
        deltaX = diffX;
      }
    };

    const handleTouchEnd = () => {
      if (!seenStore.swipeGesturesEnabled || !isSwiping) {
        isSwiping = false;
        deltaX = 0;
        return;
      }

      const THRESHOLD = 100;

      if (deltaX > THRESHOLD) {
        void seenStore.toggleSave(repo);
      } else if (deltaX < -THRESHOLD) {
        triggerDismiss();
      }

      isSwiping = false;
      deltaX = 0;
    };

    cardRef.addEventListener('touchstart', handleTouchStart, { passive: true });
    cardRef.addEventListener('touchmove', handleTouchMove, { passive: false });
    cardRef.addEventListener('touchend', handleTouchEnd, { passive: true });
    cardRef.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      if (cardRef) {
        cardRef.removeEventListener('touchstart', handleTouchStart);
        cardRef.removeEventListener('touchmove', handleTouchMove);
        cardRef.removeEventListener('touchend', handleTouchEnd);
        cardRef.removeEventListener('touchcancel', handleTouchEnd);
      }
    };
  });

  function handleSaveClick(e: MouseEvent) {
    e.stopPropagation();
    void seenStore.toggleSave(repo);
  }

  function handleSeenClick(e: MouseEvent) {
    e.stopPropagation();
    triggerDismiss();
  }
</script>

<div class="relative rounded-lg overflow-hidden">
  <!-- Underlying Action Background Layer -->
  <div
    class="absolute inset-0 rounded-lg overflow-hidden flex items-center justify-between px-6 transition-all duration-150 {
      deltaX > 0
        ? 'bg-emerald-600 opacity-100'
        : deltaX < 0
          ? 'bg-rose-600 opacity-100'
          : 'bg-transparent opacity-0 pointer-events-none'
    }"
  >
    <!-- Right Swipe Action (Bookmark) -->
    <div class="flex items-center gap-2 text-white font-bold text-sm select-none">
      <BookmarkIcon size={18} class="text-white" />
      <span>{isSaved ? 'Unbookmark' : 'Bookmark'}</span>
    </div>

    <!-- Left Swipe Action (Seen / Unseen) -->
    <div class="flex items-center gap-2 text-white font-bold text-sm select-none">
      <span>{isSeen ? 'Unseen' : 'Seen'}</span>
      <CheckIcon size={18} class="text-white" />
    </div>
  </div>

  <!-- Sliding Foreground Card Container -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <article
    bind:this={cardRef}
    tabindex={isFocused ? 0 : -1}
    aria-label="{repo.full_name} repository"
    style={swipeStyle}
    class="relative z-10 focus-visible:outline-none rounded-lg"
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
          onclick={handleSaveClick}
          aria-label={isSaved ? `Remove ${repo.full_name} bookmark` : `Save ${repo.full_name} bookmark`}
          title={isSaved ? "Unsave Bookmark (S)" : "Save Bookmark (S)"}
          class="p-2 sm:p-1.5 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 rounded border transition-all btn-press active:scale-95 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] {
            isSaved
              ? 'bg-[var(--accent-signal-soft-bg)] text-[var(--accent-signal-soft-text)] border-[var(--accent-signal)]/50'
              : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-main)] hover:border-[var(--border-strong)]'
          }"
        >
          <BookmarkIcon size={14} filled={isSaved} aria-hidden="true" />
        </button>

        <!-- Mark Seen Button -->
        <button
          onclick={handleSeenClick}
          aria-label="Mark {repo.full_name} as seen"
          title="Mark Seen (D)"
          class="p-2 sm:p-1.5 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 rounded border transition-all btn-press active:scale-95 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] {
            isSeen
              ? 'bg-[var(--badge-green-bg)] text-[var(--badge-green-text)] border-[var(--badge-green-text)]/30'
              : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--badge-green-text)] hover:border-[var(--badge-green-text)]/30'
          }"
        >
          <CheckIcon size={14} aria-hidden="true" />
        </button>
      {/snippet}
    </RepoItem>
  </article>
</div>
