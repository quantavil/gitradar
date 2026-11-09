<script lang="ts">
  import ConfirmDialog from './ConfirmDialog.svelte'
  import { triage } from './triage.svelte'
  import { THEMES } from './types'

  let message = $state<{ ok: boolean; text: string } | null>(null)
  let pendingImport = $state<{ name: string; text: string } | null>(null)
  let clearing = $state<'saved' | 'seen' | null>(null)

  function localDate(now: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  }

  function exportTriage() {
    const url = URL.createObjectURL(new Blob([triage.exportJson()], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `gitradar-${localDate()}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function chooseImport(event: Event) {
    const input = event.currentTarget
    if (!(input instanceof HTMLInputElement)) return
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      pendingImport = { name: file.name, text: await file.text() }
      message = null
    } catch {
      message = { ok: false, text: 'Could not read that file.' }
    }
  }

  function confirmImport() {
    if (!pendingImport) return
    const result = triage.importJson(pendingImport.text)
    pendingImport = null
    message = result.ok
      ? { ok: true, text: `Imported ${result.saved} saved and ${result.seen} seen repos.` }
      : { ok: false, text: result.error }
  }

  function clearSaved() {
    triage.clearSaved()
    clearing = null
  }

  function clearSeen() {
    triage.clearSeen()
    clearing = null
  }
</script>

<section class="view">
  <header class="head">
    <h1>Settings</h1>
  </header>

  <section class="set wide" aria-labelledby="theme-title">
    <div>
      <h2 id="theme-title">Theme</h2>
      <p>System follows your device. The others stay fixed.</p>
    </div>
    <div class="themes" role="group" aria-label="Theme">
      {#each THEMES as theme (theme.id)}
        <button
          type="button"
          class="theme"
          aria-pressed={triage.theme === theme.id}
          onclick={() => (triage.theme = theme.id)}
        >
          <span class="swatch" style:background={theme.swatch[0]} style:color={theme.swatch[1]}>
            {#if theme.id === 'system'}
              <span class="half"></span>
            {/if}
            <span class="aa">Aa</span>
            <span class="pip" style:background={theme.swatch[2]}></span>
          </span>
          <span class="tl">{theme.label}</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="set" aria-labelledby="data-title">
    <div>
      <h2 id="data-title">Data</h2>
      <p>Saved and seen repos live only in this browser. Export a JSON copy to move them, or import one to replace them.</p>
    </div>
    <div class="stack">
      <div class="actions">
        <button type="button" class="btn" onclick={exportTriage}>Export JSON</button>
        <label class="btn file">
          Import JSON
          <input type="file" accept="application/json,.json" onchange={chooseImport} />
        </label>
      </div>
      {#if message}
        <p class="msg" class:error={!message.ok} role="status">{message.text}</p>
      {/if}
    </div>
  </section>

  <section class="set" aria-labelledby="remove-title">
    <div>
      <h2 id="remove-title">Remove data</h2>
      <p>Clearing cannot be undone. Repos cleared from Seen return to Discover.</p>
    </div>
    <div class="actions">
      <button type="button" class="btn" onclick={() => (clearing = 'saved')}>Clear saved</button>
      <button type="button" class="btn" onclick={() => (clearing = 'seen')}>Clear seen</button>
    </div>
  </section>

  <section class="set" aria-labelledby="about-title">
    <div>
      <h2 id="about-title">About</h2>
      <p>GitRadar is open source. Trending repository data comes from <a href="https://trendshift.io" target="_blank" rel="noopener noreferrer">trendshift.io</a>.</p>
    </div>
    <ul class="links">
      <li><a href="https://github.com/quantavil/gitradar" target="_blank" rel="noopener noreferrer">github.com/quantavil/gitradar</a></li>
      <li><a href="https://github.com/quantavil/trendshift" target="_blank" rel="noopener noreferrer">github.com/quantavil/trendshift</a></li>
    </ul>
  </section>
</section>

<ConfirmDialog
  open={pendingImport !== null}
  title="Replace your data?"
  body={`This replaces every saved and seen repo in this browser with the contents of ${pendingImport?.name ?? 'the selected file'}. Export first if you want to keep the current data.`}
  confirmLabel="Replace data"
  danger
  onconfirm={confirmImport}
  oncancel={() => (pendingImport = null)}
/>

<ConfirmDialog
  open={clearing === 'saved'}
  title="Clear all saved repos?"
  body="This removes every saved repo from this browser and cannot be undone."
  confirmLabel="Clear saved"
  danger
  onconfirm={clearSaved}
  oncancel={() => (clearing = null)}
/>

<ConfirmDialog
  open={clearing === 'seen'}
  title="Clear all seen repos?"
  body="This removes every seen repo from this browser and cannot be undone. Discover will show them again."
  confirmLabel="Clear seen"
  danger
  onconfirm={clearSeen}
  oncancel={() => (clearing = null)}
/>

<style>
  .head {
    padding: 22px 12px 14px;
  }
  h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .set {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 14px 32px;
    padding: 20px 12px;
    border-top: 1px solid var(--hair);
  }
  h2 {
    margin: 0 0 4px;
    font-size: 15px;
    font-weight: 600;
  }
  .set p {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--ink-2);
  }
  .set a {
    color: var(--ink);
    text-decoration-color: var(--hair-2);
    text-underline-offset: 3px;
  }
  .set a:hover {
    text-decoration-color: var(--accent);
  }
  .set.wide .themes {
    grid-column: 1 / -1;
  }
  .themes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 10px;
  }
  .theme {
    display: grid;
    gap: 6px;
    padding: 6px;
    border: 1px solid var(--hair-2);
    border-radius: 10px;
    background: var(--panel);
    color: var(--ink-2);
    font: 500 12.5px/1 var(--font-ui);
    text-align: left;
    cursor: pointer;
  }
  .theme:hover {
    background: var(--hover);
  }
  .theme[aria-pressed="true"] {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
    color: var(--ink);
  }
  .theme:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .swatch {
    position: relative;
    display: flex;
    align-items: center;
    height: 44px;
    padding: 0 10px;
    overflow: hidden;
    border: 1px solid rgb(127 127 127 / 0.25);
    border-radius: 6px;
    font: 700 15px/1 var(--font-ui);
  }
  /* "System" shows the dark half it may resolve to. */
  .half {
    position: absolute;
    inset: 0 0 0 50%;
    background: #0e0e0d;
  }
  .aa {
    position: relative;
  }
  .swatch:has(.half) .aa {
    mix-blend-mode: difference;
    color: #fff;
  }
  .pip {
    position: relative;
    margin-left: auto;
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  .tl {
    padding: 0 2px 2px;
  }
  .stack {
    display: grid;
    gap: 10px;
    justify-items: start;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  /* Buttons are shared from app.css. */
  .file {
    cursor: pointer;
  }
  .file input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .file:focus-within,
  .btn:focus-visible,
  .set a:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .msg {
    font-size: 13px;
    color: var(--ink-2);
  }
  .msg.error {
    color: var(--accent);
  }
  .links {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-family: var(--font-mono);
    font-size: 12.5px;
  }
  @media (pointer: coarse) {
    .btn {
      height: 44px;
    }
    .links a {
      display: inline-block;
      padding: 10px 0;
    }
  }
  @media (max-width: 719px) {
    .head {
      padding: 18px 16px 12px;
    }
    .set {
      grid-template-columns: minmax(0, 1fr);
      padding: 20px 16px;
    }
  }
</style>
