<script lang="ts" module>
  // Shown on the first visit, and again after the terms of use change; closed only by accepting them. The accepted
  // terms version is remembered in this browser (localStorage); when storage is not available (some private windows)
  // the panel simply shows again next time. Opened from the About button, it closes like any dialog.
  import { ACCEPTED_KEY, TERMS_VERSION } from '../lib/terms';

  export function termsAccepted(): boolean {
    try {
      return localStorage.getItem(ACCEPTED_KEY) === TERMS_VERSION;
    } catch {
      return false;
    }
  }

  function remember() {
    try {
      localStorage.setItem(ACCEPTED_KEY, TERMS_VERSION);
    } catch {
      // not remembered: shown again next time
    }
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { termsHtml } from '../lib/terms';

  /** `accepted`: opened again from the About button, so it can simply be closed. */
  let { onconfirm, accepted = false }: { onconfirm: () => void; accepted?: boolean } = $props();
  let button: HTMLButtonElement | undefined = $state();
  let showTerms = $state(false);

  const REPO = 'https://github.com/klaushofrichter/ge150pro-editor';
  const PRODUCT = 'https://www.mooeraudio.com/products/207.html';
  const DOWNLOADS = 'https://www.mooeraudio.com/Downloads_xq/6.html';

  onMount(() => button?.focus());

  function confirm() {
    remember();
    onconfirm();
  }
</script>

<svelte:window onkeydown={(e) => accepted && e.key === 'Escape' && onconfirm()} />
<div class="backdrop" role="presentation" onclick={() => accepted && onconfirm()}></div>
<div class="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title" aria-describedby="welcome-what">
  <h2 id="welcome-title">GE150 Pro Editor</h2>

  <p id="welcome-what">
    An unofficial editor for the <a href={PRODUCT} target="_blank" rel="noopener">Mooer GE150 Pro</a> that runs in this
    browser tab. It talks to the pedal over USB (Chrome or Edge on a computer), edits presets, effects and settings in
    real time, arranges the 200 preset slots and keeps backups in this browser. Nothing is sent anywhere else.
    <a href="./?demo">Try the demo</a> to look around without a pedal.
  </p>

  <h3>Before you change anything</h3>
  <p>
    Close Mooer's editor (only one program can use the pedal at a time). Then open <strong>Arrange and back up
    presets</strong> (the grid icon next to PRESET) and choose <strong>Back up the pedal now</strong>.
  </p>

  <h3>The factory presets</h3>
  <p>The editor can read Mooer's original 200 presets from Mooer's firmware file and keep them as a locked original to compare with and restore from:</p>
  <ol>
    <li>Download the GE150 Pro package from <a href={DOWNLOADS} target="_blank" rel="noopener">Mooer's download page</a>.</li>
    <li>
      Find the firmware file (<code>GE150PRO_V2.1.x.mr</code>) inside it. On a Mac: open the <code>.dmg</code>,
      right-click <code>GE150PRO.app</code>, <em>Show Package Contents</em>, then <code>Contents/MacOS/Firmware</code>.
      On Windows: in the folder where Mooer's editor is installed.
    </li>
    <li>Here: <strong>Arrange and back up presets</strong>, then <strong>Read the factory presets from a firmware file (.mr)</strong>.</li>
  </ol>
  <p class="muted">The file is only read. Nothing is installed on the pedal.</p>

  <h3>Use at your own risk</h3>
  <p class="risk">
    This is not a Mooer product and is not affiliated with or endorsed by Mooer. It was developed and tested with a
    GE150 Pro on firmware V2.1.2; it may not work with other models or firmware versions. It comes without any warranty
    or guarantee (<a href="{REPO}/blob/main/LICENSE" target="_blank" rel="noopener">MIT license</a>). Writing presets
    replaces what is stored on the pedal, so keep backups.
  </p>

  <h3>Terms of use</h3>
  <p>
    Using this app means you agree to its terms of use: you use it at your own risk, there is no warranty, no liability
    and no support, and your data stays in your browser.
    <button class="link" aria-expanded={showTerms} onclick={() => (showTerms = !showTerms)}>{showTerms ? 'Hide' : 'Read'} the terms of use</button>
  </p>
  {#if showTerms}
    <div class="terms" role="region" aria-label="Terms of use">
      <!-- the app's own TERMS.md, escaped in termsHtml() -->
      {@html termsHtml()}
    </div>
  {/if}

  <p class="muted">Source code: <a href={REPO} target="_blank" rel="noopener">github.com/klaushofrichter/ge150pro-editor</a></p>

  <div class="actions">
    {#if accepted}
      <button bind:this={button} class="confirm" onclick={onconfirm}>Close</button>
    {:else}
      <button bind:this={button} class="confirm" onclick={confirm}>I agree to the terms and accept the risk</button>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.65);
    z-index: 20;
  }
  .welcome {
    position: fixed;
    z-index: 21;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(720px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    background: var(--panel);
    border: 1px solid var(--accent);
    border-radius: 8px;
    padding: 22px 30px 18px;
    box-shadow: 0 10px 40px rgb(0 0 0 / 0.6);
    line-height: 1.45;
  }
  h2 {
    margin: 0 0 10px;
    font-weight: 500;
    font-size: 1.5rem;
  }
  h3 {
    margin: 16px 0 4px;
    font-weight: 500;
    font-size: 1.05rem;
  }
  p,
  ol {
    margin: 6px 0;
  }
  ol {
    padding-left: 1.4em;
  }
  li {
    margin: 3px 0;
  }
  a {
    color: var(--accent);
  }
  code {
    font-size: 0.9em;
  }
  .muted {
    color: var(--muted);
    font-size: 0.9rem;
  }
  .risk {
    border-left: 3px solid var(--accent);
    padding-left: 10px;
  }
  .link {
    background: none;
    border: none;
    padding: 0;
    color: var(--accent);
    text-decoration: underline;
    font: inherit;
    cursor: pointer;
  }
  .terms {
    background: var(--well);
    border-radius: 4px;
    padding: 4px 14px;
    margin: 8px 0;
    font-size: 0.88rem;
    max-height: 40vh;
    overflow-y: auto;
  }
  .terms :global(h4) {
    margin: 12px 0 2px;
    font-weight: 600;
  }
  .terms :global(a) {
    color: var(--accent);
  }
  .terms :global(p) {
    margin: 4px 0;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 14px;
  }
  .confirm {
    background: var(--accent);
    color: #111;
    border: none;
    border-radius: 4px;
    padding: 10px 20px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
</style>
