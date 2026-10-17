<script lang="ts">
  import Icon from './Icon.svelte'
  import type { Snippet } from 'svelte';
  import type { TrendshiftRepo } from './types';
  import { getLanguageBadgeStyle } from './badges';
  import { safeGithubUrl } from './repo-schema';
  
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

  function formatRank(value: number) {
    return String(value).padStart(2, '0');
  }
</script>

<div
  class="relative overflow-hidden bg-[var(--bg-surface)] border rounded-xl p-4 sm:p-5 text-left shadow-[var(--card-shadow)] transition-[border-color,opacity] duration-200 {
    isFocused
      ? 'border-[var(--border-strong)] before:content-[""] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[var(--accent-signal)]'
      : 'border-[var(--border-subtle)] pointer-fine:hover:border-[var(--border-strong)]'
  } {isSeen ? 'opacity-60' : 'opacity-100'} {containerClass}"
>
  <!-- Meta line: rank, timeframe, owner -->
  <div class="mb-2 flex items-center gap-2 min-w-0 font-mono text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
    {#if rank !== undefined && rank > 0}
      <span class="shrink-0 tabular-nums {rank <= 3 ? 'font-semibold text-[var(--accent-signal-soft-text)]' : ''}">
        {formatRank(rank)}
      </span>
    {/if}

    {#if repo.timeframe}
      <span class="shrink-0">{repo.timeframe}</span>
    {/if}

    {#if owner}
      <span class="flex items-center gap-1.5 min-w-0">
        <img
          src="https://avatars.githubusercontent.com/{owner}?s=64"
          width="24"
          height="24"
          class="size-6 rounded shrink-0 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] object-cover"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          crossorigin="anonymous"
          onerror={(e) => ((e.currentTarget as HTMLElement).style.display = 'none')}
        />
        <span class="truncate">{owner}</span>
      </span>
    {/if}

    {#if extraHeader}
      {@render extraHeader()}
    {/if}
  </div>

  <!-- Title: the repo name links to GitHub -->
  <h3 class="min-w-0">
    <a
      href={safeGithubUrl(repo.full_name)}
      target="_blank"
      rel="noopener noreferrer"
      class="group inline-flex max-w-full items-start gap-1.5 rounded-sm font-sans font-semibold text-lg sm:text-xl leading-tight text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]"
      aria-label="Open {repo.full_name} on GitHub (opens in a new tab)"
    >
      <span class="break-words group-hover:underline underline-offset-2">{repoName}</span>
      <Icon name="external-link" size={14} class="mt-1 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors" aria-hidden="true" />
    </a>
  </h3>

  <!-- Description -->
  {#if repo.description}
    <p class="mt-2 max-w-[68ch] font-sans text-sm sm:text-[15px] leading-relaxed text-[var(--text-main)] break-words">
      {repo.description}
    </p>
  {/if}

  <!-- Quiet tags -->
  {#if repo.tags && repo.tags.length > 0}
    <div class="mt-2.5 flex flex-wrap gap-1.5">
      {#each repo.tags.slice(0, 3) as tag}
        <span class="rounded px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-muted)] bg-[var(--bg-canvas)]">
          {tag.startsWith('#') ? tag : `#${tag}`}
        </span>
      {/each}
    </div>
  {/if}

  <!-- Footer: metrics on the left, actions on the right -->
  <div class="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 pt-3 border-t border-[var(--border-subtle)]">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-xs tabular-nums text-[var(--text-muted)]">
      {#if repo.language && repo.language !== 'Unknown'}
        <span class="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium {getLanguageBadgeStyle(repo.language)}">
          {repo.language}
        </span>
      {/if}

      <span class="inline-flex items-center gap-1" title="Total Stars">
        <Icon name="star" size={13} aria-hidden="true" />
        {(repo.stars_total ?? 0).toLocaleString()}
      </span>

      {#if (repo.forks_total ?? 0) > 0}
        <span class="inline-flex items-center gap-1" title="Total Forks">
          <Icon name="fork" size={13} aria-hidden="true" />
          {(repo.forks_total ?? 0).toLocaleString()}
        </span>
      {/if}

      {#if (repo.stars_gained ?? 0) > 0}
        <span class="inline-flex items-center gap-1 font-semibold text-[var(--accent-signal)]" title="Stars gained in snapshot">
          <Icon name="flame" size={13} aria-hidden="true" />
          +{(repo.stars_gained ?? 0).toLocaleString()}
        </span>
      {/if}

      {#if repo.created_at}
        <span class="hidden lg:inline">
          Created {formatDate(repo.created_at)}
        </span>
      {/if}
    </div>

    {#if actions}
      <div class="flex flex-wrap items-center gap-2 shrink-0">
        {@render actions()}
      </div>
    {/if}
  </div>
</div>
