<script lang="ts">
  let {
    checked,
    label,
    disabled = false,
    onchange,
  }: { checked: boolean; label: string; disabled?: boolean; onchange?: (v: boolean) => void } = $props();
</script>

<label class="toggle" class:disabled title={label}>
  <input type="checkbox" {checked} {disabled} onchange={(e) => onchange?.(e.currentTarget.checked)} />
  <span aria-hidden="true"></span>
  <span class="sr-only">{label}</span>
</label>

<style>
  .toggle {
    position: relative;
    display: inline-block;
    width: 54px;
    height: 28px;
    cursor: pointer;
    flex: none;
  }
  .toggle.disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
  input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }
  span[aria-hidden] {
    position: absolute;
    inset: 0;
    background: var(--line);
    border-radius: 14px;
    transition: background 0.15s;
  }
  span[aria-hidden]::after {
    content: '';
    position: absolute;
    top: 4px;
    left: 4px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #f2f2f2;
    transition: transform 0.15s;
  }
  input:checked + span[aria-hidden] {
    background: var(--accent);
  }
  input:checked + span[aria-hidden]::after {
    transform: translateX(26px);
  }
  input:focus-visible + span[aria-hidden] {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
