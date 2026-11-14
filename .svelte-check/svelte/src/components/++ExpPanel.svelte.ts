///<reference types="svelte" />
;
import { editor } from '../lib/store.svelte';
import { catalog, formatValue, model, rawFraction } from '../lib/catalog';
import { EXP_MODULES, EXP_PARAMS, EXP_VOL_MAX } from '../lib/protocol/exp';
import Dialog from './Dialog.svelte';
import SliderRow from './SliderRow.svelte';
import Toggle from './Toggle.svelte';

;type $$ComponentProps =  { onclose: () => void };function $$render() {

  
  
  
  
  
  

  let { onclose }:/*Ωignore_startΩ*/$$ComponentProps/*Ωignore_endΩ*/ = $props();

  const exp = $derived(editor.live?.exp);

  /** Catalog spellings that differ from the EXP panel's. */
  const ALIASES: Record<string, string> = { FEEDBACK: 'F.BACK' };
  const norm = (n: string) => ALIASES[n.toUpperCase()] ?? n.toUpperCase();

  /** The controlled parameter in the current model and its live value (moves with the pedal). */
  const target = $derived.by(() => {
    const live = editor.live;
    if (!exp || !live) return null;
    const slot = exp.MODULE_CTRL;
    const name = EXP_PARAMS[slot]?.find((p) => p.id === exp.PARA_CTRL)?.name;
    const mod = live.modules[slot];
    const m = mod && model(slot, mod.type);
    if (!name || !m) return null;
    const i = m.params.findIndex((p) => norm(p.name) === name);
    if (i < 0) return { name, slotName: catalog.slots[slot].name, model: m.name, spec: null, raw: 0 };
    return { name, slotName: catalog.slots[slot].name, model: m.name, spec: m.params[i], raw: mod.values[m.params[i].pos], on: mod.on };
  });

  function pickModule(m: number) {
    if (!exp || m === exp.MODULE_CTRL) return;
    // The editor selects the module's first parameter when switching modules (session 5).
    editor.editExp({ MODULE_CTRL: m, PARA_CTRL: EXP_PARAMS[m][0].id });
  }
;
async () => {

 { const $$_golaiD0C = __sveltets_2_ensureComponent(Dialog); new $$_golaiD0C({ target: __sveltets_2_any(), props: {    children:() => { return __sveltets_2_any(0); },"title":`EXP`,onclose,"footer":`Changes apply to the current preset right away; save the preset to keep them. CALIBRATE is only available on the pedal.`,}});
  if(!exp){
     { svelteHTML.createElement("p", { "class":`muted`,});    }
  }else{
     { svelteHTML.createElement("section", {});
       { svelteHTML.createElement("div", { "class":`inline`,});
         { svelteHTML.createElement("h3", {});  }
         { const $$_elggoT3C = __sveltets_2_ensureComponent(Toggle); new $$_elggoT3C({ target: __sveltets_2_any(), props: {      "checked":exp.FUN_SWITCH === 1,"label":`EXP function`,"onchange":(on) => editor.editExp({ FUN_SWITCH: on ? 1 : 0 }),}});}
       }
       { svelteHTML.createElement("div", {  "class":`pick`,});exp.FUN_SWITCH !== 1;
         { svelteHTML.createElement("div", {     "class":`modules`,"role":`radiogroup`,"aria-label":`Module`,});
              for(let name of __sveltets_2_ensureArray(EXP_MODULES)){let m = 1;name;
             { svelteHTML.createElement("button", {        "class":`btn`,"role":`radio`,"aria-checked":exp.MODULE_CTRL === m,"onclick":() => pickModule(m),});exp.MODULE_CTRL === m;name; }
          }
         }
        if(target){
           { svelteHTML.createElement("div", {   "class":`live`,"aria-live":`polite`,});
            if(target.spec){
               { svelteHTML.createElement("span", { "class":`muted`,});target.slotName;  target.model;  target.name; }
               { svelteHTML.createElement("div", {   "class":`meter`,"style":`--fill: ${rawFraction(target.spec, target.raw) * 100}%`,}); }
               { svelteHTML.createElement("output", {});formatValue(target.spec, target.raw); }
              if(!target.on){ { svelteHTML.createElement("span", { "class":`warn`,});   }}
            }else{
               { svelteHTML.createElement("span", { "class":`warn`,});  target.slotName;  target.model;   target.name;      }
            }
           }
        }
         { svelteHTML.createElement("div", {     "class":`params`,"role":`radiogroup`,"aria-label":`Parameter`,});
             for(let p of __sveltets_2_ensureArray(EXP_PARAMS[exp.MODULE_CTRL] ?? [])){p.id;
             { svelteHTML.createElement("button", {        "class":`btn`,"role":`radio`,"aria-checked":exp.PARA_CTRL === p.id,"onclick":() => editor.editExp({ PARA_CTRL: p.id }),});exp.PARA_CTRL === p.id;p.name; }
          }
         }
       }
     }

     { svelteHTML.createElement("section", {});
       { svelteHTML.createElement("div", { "class":`inline`,});
         { svelteHTML.createElement("h3", {});  }
         { const $$_elggoT3C = __sveltets_2_ensureComponent(Toggle); new $$_elggoT3C({ target: __sveltets_2_any(), props: {      "checked":exp.VOL_SWITCH === 1,"label":`EXP volume`,"onchange":(on) => editor.editExp({ VOL_SWITCH: on ? 1 : 0 }),}});}
       }
       { svelteHTML.createElement("div", {  "class":`rows`,});exp.VOL_SWITCH !== 1;
         { const $$_woRredilS3C = __sveltets_2_ensureComponent(SliderRow); new $$_woRredilS3C({ target: __sveltets_2_any(), props: {          "id":`exp-min`,"label":`MIN`,"value":exp.VOL_MIN,"max":EXP_VOL_MAX,"onchange":(v) => editor.editExp({ VOL_MIN: v }),}});}
         { const $$_woRredilS3C = __sveltets_2_ensureComponent(SliderRow); new $$_woRredilS3C({ target: __sveltets_2_any(), props: {          "id":`exp-max`,"label":`MAX`,"value":exp.VOL_MAX,"max":EXP_VOL_MAX,"onchange":(v) => editor.editExp({ VOL_MAX: v }),}});}
       }
     }
  }
 Dialog}


};
return { props: {} as any as $$ComponentProps, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const ExpPanel__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type ExpPanel__SvelteComponent_ = ReturnType<typeof ExpPanel__SvelteComponent_>;
/*Ωignore_endΩ*/export default ExpPanel__SvelteComponent_;