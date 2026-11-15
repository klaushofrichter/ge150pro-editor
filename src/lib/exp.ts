// The expression pedal while playing. Its toe switch (EXP or volume mode) and the value it moves in EXP mode are live
// controls, like a knob on an amp: they are not edits of the preset. See docs/protocol.md, Expression pedal.
import { expTarget } from './catalog';
import type { Preset } from './protocol/preset';

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
