///<reference types="svelte" />
;
import { catalog, formatValue, rawFraction, rawRange, type ParamSpec } from '../lib/catalog';
import type { ModuleState } from '../lib/protocol/preset';
import Toggle from './Toggle.svelte';

;type $$ComponentProps =  { slot: number; mod: ModuleState; onchange: (m: ModuleState) => void };function $$render() {

  
  
  

  let { slot, mod, onchange }:/*Ωignore_startΩ*/$$ComponentProps/*Ωignore_endΩ*/ = $props();

  const slotCatalog = $derived(catalog.slots[slot]);
  const model = $derived(slotCatalog.models[mod.type]);
  const pad = (n: number) => String(n).padStart(2, '0');

  function setValue(p: ParamSpec, raw: number) {
    const [min, max] = rawRange(p);
    const values = [...mod.values];
    values[p.pos] = Math.max(min, Math.min(max, raw));
    if (values[p.pos] !== mod.values[p.pos]) onchange({ ...mod, values });
  }

  let list: HTMLOListElement | undefined = $state();
  $effect(() => {
    // Keep the selected model visible when the preset or module changes.
    list?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  });
;
async () => {

 { svelteHTML.createElement("div", { "class":`panel`,});
   { svelteHTML.createElement("div", { "class":`models`,});
     { svelteHTML.createElement("div", { "class":`models-head`,});
       { svelteHTML.createElement("h2", {});slotCatalog.name; }
       { const $$_elggoT3C = __sveltets_2_ensureComponent(Toggle); new $$_elggoT3C({ target: __sveltets_2_any(), props: {      "checked":mod.on,"label":`${slotCatalog.name} on`,"onchange":(on) => onchange({ ...mod, on }),}});}
     }
     { const $$_ol2 = svelteHTML.createElement("ol", {     "role":`listbox`,"aria-label":`${slotCatalog.name} models`,});list = $$_ol2;
         for(let m of __sveltets_2_ensureArray(slotCatalog.models)){m.index;
         { svelteHTML.createElement("li", {   "role":`option`,"aria-selected":m.index === mod.type,});
           { svelteHTML.createElement("button", { "onclick":() => onchange({ ...mod, type: m.index }),});
            pad(m.index + 1); m.name;
           }
         }
      }
     }
   }

   { svelteHTML.createElement("div", { "class":`params`,});
     { svelteHTML.createElement("h3", {});slotCatalog.name;    model ? `${pad(mod.type + 1)}: ${model.name}` : `unknown model ${mod.type}`; }

     { svelteHTML.createElement("div", { "class":`sliders`,});
          for(let p of __sveltets_2_ensureArray(model?.params ?? [])){let i = 1;p.name;
         { svelteHTML.createElement("div", { "class":`param`,});
           { svelteHTML.createElement("label", { "for":`p-${slot}-${i}`,});p.name; }
          if(p.kind === 'enum'){
             { svelteHTML.createElement("select", {     "id":`p-${slot}-${i}`,"value":mod.values[p.pos],"onchange":(e) => setValue(p, Number(e.currentTarget.value)),});
                  for(let opt of __sveltets_2_ensureArray(p.options)){let oi = 1;oi;
                 { svelteHTML.createElement("option", { "value":oi,});opt; }
              }
             }
          }else{
             { svelteHTML.createElement("input", {               "id":`p-${slot}-${i}`,"type":`range`,"min":rawRange(p)[0],"max":rawRange(p)[1],"value":mod.values[p.pos],"style":`--fill: ${rawFraction(p, mod.values[p.pos]) * 100}%`,"oninput":(e) => setValue(p, Number(e.currentTarget.value)),});}
          }
           { svelteHTML.createElement("div", { "class":`stepper`,});
             { svelteHTML.createElement("button", {   "aria-label":`Decrease ${p.name}`,"onclick":() => setValue(p, mod.values[p.pos] - 1),});  }
             { svelteHTML.createElement("output", {});formatValue(p, mod.values[p.pos]); }
             { svelteHTML.createElement("button", {   "aria-label":`Increase ${p.name}`,"onclick":() => setValue(p, mod.values[p.pos] + 1),});  }
           }
         }
      }
     }
   }
 }


};
return { props: {} as any as $$ComponentProps, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const ModulePanel__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type ModulePanel__SvelteComponent_ = ReturnType<typeof ModulePanel__SvelteComponent_>;
/*Ωignore_endΩ*/export default ModulePanel__SvelteComponent_;