// The expression pedal while playing. Its toe switch (EXP or volume mode) and the value it moves in EXP mode are live
// controls, like a knob on an amp: they are not edits of the preset. See docs/protocol.md, Expression pedal.
import { expTarget } from './catalog';
import type { ModuleState, Preset } from './protocol/preset';

/**
 * `live` with the value of the parameter the expression pedal moves put back to `stored`'s: what Store keeps when the
 * pedal, not the editor, changed it. Unchanged when the module's model differs (another parameter set) or there is no
 * stored copy.
 */
export function withoutPedalMove(live: Preset, stored: Preset | undefined): Preset {
  const t = expTarget(live.exp, live.modules);
  const slot = t?.slot ?? -1;
  if (!stored || !t?.spec || live.modules[slot].type !== stored.modules[slot].type) return live;
  const values = live.modules[slot].values.with(t.spec.pos, stored.modules[slot].values[t.spec.pos]);
  if (values.every((v, i) => v === live.modules[slot].values[i])) return live;
  return { ...live, modules: live.modules.with(slot, { ...live.modules[slot], values }) };
}

/**
 * A module report that differs from the live module in more than the value the expression pedal moves: a knob or a
 * switch on the pedal itself was used.
 */
export function turnedOnPedal(live: Preset, slot: number, m: ModuleState): boolean {
  const cur = live.modules[slot];
  if (!cur || cur.on !== m.on || cur.type !== m.type) return true;
  const t = expTarget(live.exp, live.modules);
  const moved = t?.spec && t.slot === slot ? t.spec.pos : -1;
  return m.values.some((v, i) => i !== moved && v !== cur.values[i]);
}
