<script lang="ts" module>
  /**
   * A phone: touch is the only pointer (no mouse or trackpad) and the screen is small. Narrow desktop windows and
   * tablets are not phones. The editor needs USB from a computer, and its layout is made for a computer screen.
   */
  export function isPhone(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    const touchOnly = matchMedia('(hover: none) and (pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
    return touchOnly && Math.min(screen.width, screen.height) < 600;
  }
</script>

<script lang="ts">
  let { oncontinue }: { oncontinue: () => void } = $props();
</script>

<main class="desktop-only" aria-labelledby="desktop-only-title">
  <h1 id="desktop-only-title">GE150 Pro Editor</h1>
  <p class="lead">Desktop only</p>
  <p>
    This editor talks to the Mooer GE150 Pro over USB, which needs <strong>Chrome or Edge on a computer</strong>
    (Windows, macOS or Linux) with the pedal connected by cable. Phones and tablets cannot connect to it, and the screen
    is laid out for a computer.
  </p>
  <p>Open this page on your computer:<span class="url">klaushofrichter.github.io/<wbr />ge150pro-editor</span></p>
  <p class="links">
    <a href="https://github.com/klaushofrichter/ge150pro-editor" target="_blank" rel="noopener">About and source code</a>
    · <a href="./terms.html">Terms of use</a>
  </p>
  <button class="anyway" onclick={oncontinue}>Show it anyway</button>
</main>

<style>
  .desktop-only {
    max-width: 520px;
    margin: 0 auto;
    padding: 40px 24px;
    line-height: 1.5;
  }
  h1 {
    font-weight: 500;
    font-size: 1.6rem;
    margin: 0;
  }
  .lead {
    color: var(--accent);
    font-size: 1.3rem;
    font-weight: 600;
    margin: 4px 0 18px;
  }
  .url {
    display: block;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  a {
    color: var(--accent);
  }
  .links {
    margin-top: 18px;
  }
  .anyway {
    margin-top: 24px;
    background: none;
    border: 1px solid var(--muted);
    color: var(--muted);
    border-radius: 4px;
    padding: 8px 16px;
    font: inherit;
    cursor: pointer;
  }
</style>
