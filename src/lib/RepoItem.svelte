<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { TrendshiftRepo } from './types';
  import { getLanguageBadgeStyle } from './badges';
  import { safeGithubUrl } from './repo-schema';
  import {
    StarIcon,
    ForkIcon,
    ExternalLinkIcon,
    FlameIcon
  } from './icons';

  let {
    repo,
    rank,
    isFocused = false,
    isSeen = false,
    actions,
    extraHeader,
    containerClass = ''
  } = $props<{
    repo: TrendshiftRepo;
    rank?: number;
    isFocused?: boolean;
    isSeen?: boolean;
    actions?: Snippet;
    extraHeader?: Snippet;
    containerClass?: string;
  }>();

  let [owner, repoName] = $derived(
    repo.full_name?.includes('/')
      ? [repo.full_name.split('/')[0], repo.full_name.split('/').slice(1).join('/')]
      : ['', repo.full_name || '']
  );

  function formatDate(isoStr?: string) {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
</script>

<div
  class="bg-[var(--bg-surface)] border rounded-lg p-3.5 sm:p-5 transition-all duration-200 text-left shadow-[var(--card-shadow)] {
    isFocused
      ? 'border-[var(--accent-signal)] ring-2 ring-[var(--accent-signal)]/60 shadow-md'
      : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
  } {isSeen ? 'opacity-50 grayscale-[15%]' : 'opacity-100'} {containerClass}"
>
  <!-- Header: Avatar, Rank, Name & Action Buttons -->
  <div class="flex items-center justify-between gap-2.5 sm:gap-3 mb-2.5">
    <div class="flex items-center gap-2 min-w-0 flex-1">
      {#if owner}
        <img
          src="https://avatars.githubusercontent.com/{owner}?s=64"
          width="32"
          height="32"
          class="w-8 h-8 rounded-md shrink-0 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] object-cover"
          alt={owner}
          loading="lazy"
          decoding="async"
          crossorigin="anonymous"
          onerror={(e) => ((e.currentTarget as HTMLElement).style.display = 'none')}
        />
      {/if}

      {#if rank !== undefined && rank > 0}
        <span class="inline-flex items-center justify-center px-1.5 py-0.5 font-mono text-xs font-semibold rounded shrink-0 {
          rank <= 3
            ? 'bg-[var(--accent-signal-soft-bg)] border border-[var(--accent-signal)]/60 text-[var(--accent-signal-soft-text)] font-bold'
            : 'bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-muted)]'
        }">
          #{rank}
        </span>
      {/if}

      {#if repo.timeframe}
        <span class="inline-flex items-center justify-center px-1.5 py-0.5 font-mono text-[10px] uppercase font-semibold rounded shrink-0 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
          {repo.timeframe}
        </span>
      {/if}

      <a
        href={safeGithubUrl(repo.full_name)}
        target="_blank"
        rel="noopener noreferrer"
        class="group font-mono flex flex-col justify-center min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] rounded"
        aria-label="Open {repo.full_name} on GitHub (opens in a new tab)"
      >
        {#if owner}
          <span class="text-[10px] sm:text-xs text-[var(--text-muted)] font-mono font-normal leading-tight truncate">
            {owner}
          </span>
        {/if}
        <span class="font-semibold text-sm sm:text-base text-[var(--text-main)] group-hover:underline flex items-center gap-1 min-w-0 leading-tight">
          <span class="truncate">{repoName}</span>
          <ExternalLinkIcon size={13} class="shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors" aria-hidden="true" />
        </span>
      </a>

      {#if extraHeader}
        {@render extraHeader()}
      {/if}
    </div>

    {#if actions}
      <div class="flex items-center gap-1.5 shrink-0">
        {@render actions()}
      </div>
    {/if}
  </div>

  <!-- Description -->
  {#if repo.description}
    <p class="text-xs sm:text-sm text-[var(--text-main)] leading-relaxed mb-3 font-normal">
      {repo.description}
    </p>
  {/if}

  <!-- Footer Metrics & Tags -->
  <div class="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 pt-2.5 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
    <div class="flex items-center gap-2.5 sm:gap-3 font-mono text-[11px] flex-wrap">
      {#if repo.language && repo.language !== 'Unknown'}
        <span class="px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-mono font-medium shrink-0 {getLanguageBadgeStyle(repo.language)}">
          {repo.language}
        </span>
      {/if}
      {#if (repo.stars_gained ?? 0) > 0}
        <span class="inline-flex items-center gap-1 text-[var(--accent-signal)] font-semibold" title="Stars gained in snapshot">
          <FlameIcon size={13} aria-hidden="true" />
          +{(repo.stars_gained ?? 0).toLocaleString()}
        </span>
      {/if}

      <span class="inline-flex items-center gap-1" title="Total Stars">
        <StarIcon size={13} aria-hidden="true" />
        {(repo.stars_total ?? 0).toLocaleString()}
      </span>

      {#if (repo.forks_total ?? 0) > 0}
        <span class="inline-flex items-center gap-1" title="Total Forks">
          <ForkIcon size={13} aria-hidden="true" />
          {(repo.forks_total ?? 0).toLocaleString()}
        </span>
      {/if}

      {#if repo.created_at}
        <span class="hidden lg:inline-block text-[var(--text-muted)]">
          Created {formatDate(repo.created_at)}
        </span>
      {/if}
    </div>

    {#if repo.tags && repo.tags.length > 0}
      <div class="flex items-center gap-1.5 flex-wrap">
        {#each repo.tags.slice(0, 4) as tag}
          <span class="px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--border-strong)] transition-colors">
            {tag.startsWith('#') ? tag : `#${tag}`}
          </span>
        {/each}
      </div>
    {/if}
  </div>
</div>
