///<reference types="svelte" />
;
import { editor } from '../lib/store.svelte';
import { BRIGHTNESS_MAX, GLOBAL_EQ_PARAMS, LEVEL_LABELS, eqRawMax, formatEq } from '../lib/protocol/system';
import Dialog from './Dialog.svelte';
import SliderRow from './SliderRow.svelte';
import Toggle from './Toggle.svelte';

;type $$ComponentProps =  { onclose: () => void };function $$render() {

  
  
  
  
  

  let { onclose }:/*Ωignore_startΩ*/$$ComponentProps/*Ωignore_endΩ*/ = $props();

  const sys = $derived(editor.system);
  const eq = $derived(editor.globalEq);

  function setEq(i: number, raw: number) {
    if (!eq) return;
    const values = [...eq.values];
    values[i] = raw;
    editor.updateGlobalEq({ ...eq, values });
  }

  function exportBackup() {
    const out = editor.exportBackup();
    if (!out) return;
    const url = URL.createObjectURL(new Blob([out.json], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: out.filename }).click();
    URL.revokeObjectURL(url);
  }

  const levels = [
    { key: 'inputLevel', label: 'INPUT LEVEL' },
    { key: 'otgLevel', label: 'OTG LEVEL' },
  ] as const;
  const levelLabel = (v: number) => LEVEL_LABELS[v] ?? String(v);
;
async () => {

 { const $$_golaiD0C = __sveltets_2_ensureComponent(Dialog); new $$_golaiD0C({ target: __sveltets_2_any(), props: {    children:() => { return __sveltets_2_any(0); },"title":`SYSTEM`,onclose,"footer":`Settings take effect on the pedal immediately. Factory RESET is intentionally not offered here.`,}});
  if(!sys){
     { svelteHTML.createElement("p", { "class":`muted`,});        }
  }else{
     { svelteHTML.createElement("section", { "class":`rows`,});
         for(let l of __sveltets_2_ensureArray(levels)){l.key;
         { const $$_woRredilS2C = __sveltets_2_ensureComponent(SliderRow); new $$_woRredilS2C({ target: __sveltets_2_any(), props: {            "id":l.key,"label":l.label,"value":sys[l.key],"max":LEVEL_LABELS.length - 1,"format":levelLabel,"onchange":(v) => editor.updateSystem({ [l.key]: v }),}});}
      }
       { const $$_woRredilS2C = __sveltets_2_ensureComponent(SliderRow); new $$_woRredilS2C({ target: __sveltets_2_any(), props: {          "id":`brightness`,"label":`BRIGHTNESS`,"value":sys.brightness,"max":BRIGHTNESS_MAX,"onchange":(v) => editor.updateSystem({ brightness: v }),}});}
     }

     { svelteHTML.createElement("section", { "class":`inline`,});
       { svelteHTML.createElement("h3", {});   }
       { svelteHTML.createElement("span", {});   }
       { const $$_elggoT2C = __sveltets_2_ensureComponent(Toggle); new $$_elggoT2C({ target: __sveltets_2_any(), props: {      "checked":sys.cabLeft,"label":`Left out cab`,"onchange":(v) => editor.updateSystem({ cabLeft: v }),}});}
       { svelteHTML.createElement("span", {});   }
       { const $$_elggoT2C = __sveltets_2_ensureComponent(Toggle); new $$_elggoT2C({ target: __sveltets_2_any(), props: {      "checked":sys.cabRight,"label":`Right out cab`,"onchange":(v) => editor.updateSystem({ cabRight: v }),}});}
     }

    if(eq){
       { svelteHTML.createElement("section", {});
         { svelteHTML.createElement("div", { "class":`inline`,});
           { svelteHTML.createElement("h3", {});  }
           { const $$_elggoT3C = __sveltets_2_ensureComponent(Toggle); new $$_elggoT3C({ target: __sveltets_2_any(), props: {      "checked":eq.on,"label":`Global EQ`,"onchange":(on) => editor.updateGlobalEq({ ...eq, on }),}});}
         }
         { svelteHTML.createElement("div", {  "class":`rows`,});!eq.on;
              for(let p of __sveltets_2_ensureArray(GLOBAL_EQ_PARAMS)){let i = 1;p.name;
             { const $$_woRredilS3C = __sveltets_2_ensureComponent(SliderRow); new $$_woRredilS3C({ target: __sveltets_2_any(), props: {            "id":`eq-${i}`,"label":p.name,"value":eq.values[i],"max":eqRawMax(p),"format":(v) => formatEq(p, v),"onchange":(v) => setEq(i, v),}});}
          }
         }
       }
    }

    if(editor.spillOver !== null){
       { svelteHTML.createElement("section", { "class":`inline`,});
         { svelteHTML.createElement("h3", {});  }
         { const $$_elggoT2C = __sveltets_2_ensureComponent(Toggle); new $$_elggoT2C({ target: __sveltets_2_any(), props: {      "checked":editor.spillOver,"label":`Spill-over`,"onchange":(on) => editor.setSpillOver(on),}});}
       }
    }

     { svelteHTML.createElement("section", { "class":`inline`,});
       { svelteHTML.createElement("h3", {});  }
       { svelteHTML.createElement("button", {     "class":`btn`,"onclick":exportBackup,"disabled":editor.loaded === 0,});  }
       { svelteHTML.createElement("span", { "class":`muted`,});             }
     }

     { svelteHTML.createElement("section", { "class":`inline`,});
       { svelteHTML.createElement("h3", {});  }
       { svelteHTML.createElement("span", { "class":`muted`,});  }
       { svelteHTML.createElement("button", {    "class":`btn`,"onclick":() => editor.updateSystem({ language: 0 }),});sys.language === 0;  }
       { svelteHTML.createElement("button", {    "class":`btn`,"onclick":() => editor.updateSystem({ language: 1 }),});sys.language === 1;  }
     }
  }
 Dialog}
};
return { props: {} as any as $$ComponentProps, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const SystemPanel__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type SystemPanel__SvelteComponent_ = ReturnType<typeof SystemPanel__SvelteComponent_>;
/*Ωignore_endΩ*/export default SystemPanel__SvelteComponent_;