// Demo mode (?demo): 200 generated presets, so the editor can be tried without a pedal. Names and sounds are made up
// here; every value is a valid raw value of its model (catalog ranges).
import { catalog, rawRange } from './catalog';
import { PRESET_COUNT, SLOT_COUNT, type ModuleState, type Preset } from './protocol/preset';

const KINDS = ['Clean', 'Crunch', 'Drive', 'Lead'] as const;

/** Small deterministic generator, so the demo looks the same every time. */
function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  };
}

/** Which modules are on for each kind: FX, DS, AMP, CAB, NS, EQ, MOD, DLY, REV. */
const ON: Record<(typeof KINDS)[number], number[]> = {
  Clean: [0, 0, 1, 1, 0, 0, 1, 0, 1],
  Crunch: [0, 1, 1, 1, 1, 0, 0, 0, 1],
  Drive: [1, 1, 1, 1, 1, 1, 0, 1, 1],
  Lead: [0, 1, 1, 1, 1, 0, 1, 1, 1],
};

export function demoPresets(): Preset[] {
  return Array.from({ length: PRESET_COUNT }, (_, i) => {
    const kind = KINDS[i % 4];
    const bank = Math.floor(i / 4) + 1;
    const r = rng(i * 7919 + 17);
    const modules: ModuleState[] = Array.from({ length: SLOT_COUNT }, (_, s) => {
      const models = catalog.slots[s].models;
      const model = models[(bank * 3 + s * 5 + i) % models.length];
      const values = Array<number>(10).fill(0);
      for (const p of model.params) {
        const [lo, hi] = rawRange(p);
        values[p.pos] = lo + Math.round((hi - lo) * (0.25 + 0.5 * r()));
      }
      return { on: ON[kind][s] === 1, type: model.index, values };
    });
    return {
      index: i + 1,
      name: `${kind} ${bank}`,
      modules,
      exp: { MODULE_CTRL: 8, PARA_CTRL: 58, FUN_SWITCH: kind === 'Lead' ? 1 : 0, VOL_SWITCH: 0, VOL_MIN: 0, VOL_MAX: 100 },
    };
  });
}
