<script lang="ts">
  /** Label, slider over raw 0..max, and ◀ value ▶ stepper. Emits clamped raw values. */
  let {
    id,
    label,
    value,
    max,
    min = 0,
    format = (v: number) => String(v),
    onchange,
  }: {
    id: string;
    label: string;
    value: number;
    max: number;
    min?: number;
    format?: (v: number) => string;
    onchange: (v: number) => void;
  } = $props();

  const set = (v: number) => onchange(Math.max(min, Math.min(max, v)));
</script>

<div class="row">
  <label for={id}>{label}</label>
  <input {id} type="range" {min} {max} {value}
    style="--fill: {((value - min) / (max - min || 1)) * 100}%"
    oninput={(e) => set(Number(e.currentTarget.value))} />
  <div class="stepper">
    <button aria-label="Decrease {label}" onclick={() => set(value - 1)}>◀</button>
    <output>{format(value)}</output>
    <button aria-label="Increase {label}" onclick={() => set(value + 1)}>▶</button>
  </div>
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: 9.5rem 1fr 9rem;
    align-items: center;
    gap: 14px;
  }
  .stepper {
    display: grid;
    grid-template-columns: 1.6rem 1fr 1.6rem;
    align-items: center;
  }
  .stepper button {
    background: none;
    border: none;
    color: var(--text);
    cursor: pointer;
  }
  .stepper button:hover {
    color: var(--accent);
  }
  output {
    text-align: center;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  input[type='range'] {
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: linear-gradient(to right, var(--accent) var(--fill), var(--line) var(--fill));
    cursor: pointer;
  }
  input[type='range']::-webkit-slider-thumb {
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #1d1e20;
    border: 3px solid var(--accent);
  }
  @media (max-width: 640px) {
    .row {
      grid-template-columns: 1fr;
      gap: 4px;
    }
  }
</style>
