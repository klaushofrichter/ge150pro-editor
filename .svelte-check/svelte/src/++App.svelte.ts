///<reference types="svelte" />
;
import { onMount } from 'svelte';
import ModuleIcon from './components/ModuleIcon.svelte';
import ModulePanel from './components/ModulePanel.svelte';
import SystemPanel from './components/SystemPanel.svelte';
import ExpPanel from './components/ExpPanel.svelte';
import ArrangeDialog from './components/ArrangeDialog.svelte';
import WelcomeDialog, { welcomeConfirmed } from './components/WelcomeDialog.svelte';
import Toggle from './components/Toggle.svelte';
import { catalog } from './lib/catalog';
import { GE150Pro } from './lib/device';
import { PRESET_COUNT, presetLabel } from './lib/protocol/preset';
import { RHYTHM_MODES, styleName } from './lib/protocol/rhythm';
import { expLabel } from './lib/protocol/exp';
import { editor } from './lib/store.svelte';
function $$render() {

  
  
  
  
  
  
  
  
  
  
  
  
  
  

  const supported = GE150Pro.supported();
  const folderSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  let showSettings = $state(false);
  let showSystem = $state(false);
  let showExp = $state(false);
  let showArrange = $state(false);
  /** The first-visit panel: what this is, the factory presets, the risk. */
  let showWelcome = $state(!welcomeConfirmed());
  let notice = $state('');
  const label = (i: number) => presetLabel(i).padStart(3, '0');

  onMount(() => {
    editor.loadOriginal();
    if (new URLSearchParams(location.search).has('demo')) editor.loadDemo();
    else if (supported) editor.connect(true);
  });

  let presetList: HTMLOListElement | undefined = $state();
  $effect(() => {
    void editor.current;
    presetList?.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  });

  async function store() {
    if (!editor.live) return;
    const name = prompt(`Store to ${presetLabel(editor.live.index)} on the device. Preset name (max 16):`, editor.live.name);
    if (name === null) return;
    await editor.store(name);
  }

  async function rename() {
    if (!editor.live) return;
    const name = prompt('Rename preset (max 16 characters):', editor.live.name);
    if (name !== null && name !== editor.live.name) await editor.rename(name);
  }

  function exportMo() {
    const out = editor.exportMo();
    if (!out) return;
    const url = URL.createObjectURL(new Blob([out.json], { type: 'application/json' }));
    Object.assign(document.createElement('a'), { href: url, download: out.filename }).click();
    URL.revokeObjectURL(url);
  }

  async function importFile(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      editor.importMo(await file.text());
    } catch (err) {
      notice = err instanceof Error ? err.message : String(err);
    }
  }

  async function loadLocal(name: string) {
    notice = '';
    try {
      await editor.loadLocal(name);
    } catch (err) {
      notice = `${name}: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

;
async () => {

 { svelteHTML.createElement("div", { "class":`app`,});
   { svelteHTML.createElement("header", { "class":`top`,});
     { svelteHTML.createElement("div", { "class":`box preset-nav`,});
       { svelteHTML.createElement("button", {       "class":`arrow`,"aria-label":`Previous preset`,"disabled":!editor.device && !editor.demo,"onclick":() => editor.step(-1),});  }
       { svelteHTML.createElement("button", {       "class":`pname`,"title":`Rename`,"disabled":!editor.live,"onclick":rename,});editor.live?.name ?? 'GE150 PRO';editor.dirty ? ' *' : ''; }
       { svelteHTML.createElement("button", {       "class":`arrow`,"aria-label":`Next preset`,"disabled":!editor.device && !editor.demo,"onclick":() => editor.step(1),});  }
     }
     { svelteHTML.createElement("button", {         "class":`box icon`,"title":`Store preset to device`,"aria-label":`Store preset`,"disabled":!editor.live,"onclick":store,});
       { svelteHTML.createElement("svg", {       "viewBox":`0 0 24 24`,"fill":`none`,"stroke":`currentColor`,"stroke-width":`1.8`,}); { svelteHTML.createElement("path", {  "d":`M4 4h13l3 3v13H4z`,});} { svelteHTML.createElement("path", {  "d":`M8 4v5h8V4M7 20v-6h10v6`,});} }
     }

     { svelteHTML.createElement("div", {       "class":`box rhythm`,"title":editor.rhythm
        ? `Drum machine ${editor.rhythm.playing ? 'playing' : 'stopped'}: ${RHYTHM_MODES[editor.rhythm.mode] ?? 'mode ' + editor.rhythm.mode}, ${styleName(editor.rhythm)}. Change it with the RHYTHM button and menu on the pedal; the official editor cannot set it either.`
        : 'Drum machine information appears here once the pedal is connected.',});!editor.rhythm;editor.rhythm?.playing;
       { svelteHTML.createElement("span", { "class":`rlabel`,});editor.rhythm ? styleName(editor.rhythm) : 'RHYTHM'; }
       { svelteHTML.createElement("dl", {}); { svelteHTML.createElement("dt", {});  } { svelteHTML.createElement("dd", {});editor.rhythm?.bpm ?? '–'; } { svelteHTML.createElement("dt", {});  } { svelteHTML.createElement("dd", {});editor.rhythm?.volume ?? '–'; } }
     }
     { svelteHTML.createElement("div", {    "class":`cabs`,"title":`Cab simulation on the left/right outputs (system setting)`,});!editor.system;
       { svelteHTML.createElement("span", {});  } { const $$_elggoT3C = __sveltets_2_ensureComponent(Toggle); new $$_elggoT3C({ target: __sveltets_2_any(), props: {        "checked":editor.system?.cabLeft ?? false,"disabled":!editor.system,"label":`CAB-L`,"onchange":(v) => editor.updateSystem({ cabLeft: v }),}});}
       { svelteHTML.createElement("span", {});  } { const $$_elggoT3C = __sveltets_2_ensureComponent(Toggle); new $$_elggoT3C({ target: __sveltets_2_any(), props: {        "checked":editor.system?.cabRight ?? false,"disabled":!editor.system,"label":`CAB-R`,"onchange":(v) => editor.updateSystem({ cabRight: v }),}});}
     }
     { svelteHTML.createElement("button", {       "class":`box exp`,"title":`Expression pedal assignment of this preset`,"disabled":!editor.live,"onclick":() => (showExp = true),});
       { svelteHTML.createElement("span", {}); editor.live ? (editor.live.exp.FUN_SWITCH === 1 ? expLabel(editor.live.exp) : 'OFF') : '–'; }
       { svelteHTML.createElement("span", { "class":`chip`,});  }
     }

     { svelteHTML.createElement("span", { "class":`grow`,}); }
    if(editor.demo){
       { svelteHTML.createElement("span", {   "class":`muted`,"title":`Made-up presets; nothing is sent to a pedal`,});  }
       { svelteHTML.createElement("a", {   "class":`demo-link`,"href":`./`,});  }
    } else if (!supported){
       { svelteHTML.createElement("span", { "class":`warn`,});        }
       { svelteHTML.createElement("a", {   "class":`demo-link`,"href":`./?demo`,});   }
    } else if (!editor.device){
       { svelteHTML.createElement("a", {   "class":`demo-link`,"href":`./?demo`,});   }
       { svelteHTML.createElement("button", {   "class":`connect`,"onclick":() => editor.connect(),});  }
    } else if (editor.status === 'loading'){
       { svelteHTML.createElement("span", { "class":`muted`,}); editor.loaded; PRESET_COUNT; }
    }
     { svelteHTML.createElement("button", {         "class":`box icon`,"aria-label":`Tools and USB log`,"title":`Tools and USB log`,"aria-expanded":showSettings,"onclick":() => (showSettings = !showSettings),});
       { svelteHTML.createElement("svg", {       "viewBox":`0 0 24 24`,"fill":`none`,"stroke":`currentColor`,"stroke-width":`1.8`,}); { svelteHTML.createElement("path", {  "d":`M4 6h16M4 12h16M4 18h16`,});} }
     }
     { svelteHTML.createElement("button", {       "class":`box icon`,"aria-label":`System settings`,"title":`System settings`,"onclick":() => (showSystem = true),});
       { svelteHTML.createElement("svg", {       "viewBox":`0 0 24 24`,"fill":`none`,"stroke":`currentColor`,"stroke-width":`1.8`,}); { svelteHTML.createElement("circle", {      "cx":`12`,"cy":`12`,"r":`3.2`,});} { svelteHTML.createElement("path", {  "d":`M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1`,});} }
     }
   }

  if(showSystem){
     { const $$_lenaPmetsyS1C = __sveltets_2_ensureComponent(SystemPanel); new $$_lenaPmetsyS1C({ target: __sveltets_2_any(), props: {  "onclose":() => (showSystem = false),}});}
  }
  if(showExp){
     { const $$_lenaPpxE1C = __sveltets_2_ensureComponent(ExpPanel); new $$_lenaPpxE1C({ target: __sveltets_2_any(), props: {  "onclose":() => (showExp = false),}});}
  }
  if(showWelcome){
     { const $$_golaiDemocleW1C = __sveltets_2_ensureComponent(WelcomeDialog); new $$_golaiDemocleW1C({ target: __sveltets_2_any(), props: {  "onconfirm":() => (showWelcome = false),}});}
  }
  if(showArrange){
     { const $$_golaiDegnarrA1C = __sveltets_2_ensureComponent(ArrangeDialog); new $$_golaiDegnarrA1C({ target: __sveltets_2_any(), props: {  "onclose":() => (showArrange = false),}});}
  }

  if(showSettings){
     { svelteHTML.createElement("section", { "class":`settings`,});
       { svelteHTML.createElement("div", { "class":`row`,});
         { svelteHTML.createElement("span", {}); editor.device?.name ?? 'not connected'; }
         { svelteHTML.createElement("span", { "class":`muted`,}); import.meta.env.VITE_APP_VERSION ?? 'development build';   { svelteHTML.createElement("a", { "href":`https://github.com/klaushofrichter/ge150pro-editor`,});  } }
         { svelteHTML.createElement("button", { "onclick":() => (showWelcome = true),});    }
        if(editor.device){ { svelteHTML.createElement("button", { "onclick":() => editor.disconnect(),});  }}
         { svelteHTML.createElement("button", {   "disabled":!editor.dirty,"onclick":() => editor.revert(),});   }
         { svelteHTML.createElement("button", {   "disabled":!editor.live,"onclick":exportMo,});  }
         { svelteHTML.createElement("label", { "class":`btn`,});  { svelteHTML.createElement("input", {      "type":`file`,"accept":`.mo,application/json`,"hidden":true,"onchange":importFile,});} }
         { svelteHTML.createElement("button", {     "disabled":!editor.device || editor.selfTest?.length === 0,"title":`Set a few silent values, read them back from the pedal, restore them. Nothing is stored.`,"onclick":() => editor.runSelfTest(),});  }
       }
      if(editor.selfTest){
         { svelteHTML.createElement("ul", { "class":`selftest`,});
          if(editor.selfTest.length === 0){ { svelteHTML.createElement("li", {});  }}
             for(let r of __sveltets_2_ensureArray(editor.selfTest)){r.name;
             { svelteHTML.createElement("li", { "class":r.status,}); { svelteHTML.createElement("strong", {});r.status.toUpperCase(); } r.name; r.detail; }
          }
         }
      }
       { svelteHTML.createElement("ol", { "class":`log`,});
            for(let e of __sveltets_2_ensureArray(editor.log)){let i = 1;i;
           { svelteHTML.createElement("li", { "class":e.dir,}); { svelteHTML.createElement("code", {});e.dir === 'out' ? '→' : '←'; e.cmd.toString(16).padStart(2, '0'); e.bytes; } }
        }
       }
     }
  }

  if(editor.error || notice){
     { svelteHTML.createElement("p", {   "class":`error`,"role":`alert`,});editor.error || notice; }
  }

   { svelteHTML.createElement("div", { "class":`body`,});
     { svelteHTML.createElement("aside", { "class":`side`,});
       { svelteHTML.createElement("section", { "class":`list presets`,});
         { svelteHTML.createElement("h2", {});
          
           { svelteHTML.createElement("span", { "class":`tools`,});
             { svelteHTML.createElement("button", {         "class":`icon-sm`,"aria-label":`Arrange and back up presets`,"title":`Arrange and back up presets`,"disabled":editor.status !== 'ready',"onclick":() => (showArrange = true),});
               { svelteHTML.createElement("svg", {       "viewBox":`0 0 24 24`,"fill":`none`,"stroke":`currentColor`,"stroke-width":`1.8`,}); { svelteHTML.createElement("rect", {        "x":`3`,"y":`3`,"width":`7`,"height":`7`,});} { svelteHTML.createElement("rect", {        "x":`14`,"y":`3`,"width":`7`,"height":`7`,});} { svelteHTML.createElement("rect", {        "x":`3`,"y":`14`,"width":`7`,"height":`7`,});} { svelteHTML.createElement("path", {  "d":`M14 17.5h7M17.5 14v7`,});} }
             }
           }
         }
         { const $$_ol4 = svelteHTML.createElement("ol", { });presetList = $$_ol4;
             for(let i of __sveltets_2_ensureArray((Array.from({ length: PRESET_COUNT }, (_, k) => k + 1)))){i;
            const origin = editor.originOf(editor.presets[i - 1]);
             { svelteHTML.createElement("li", {});
               { svelteHTML.createElement("button", {      "disabled":!editor.device && !editor.demo,"onclick":() => editor.select(i),});i === editor.current;origin === 'empty';
                label(i);  editor.presets[i - 1]?.name ?? '';
                if(origin === 'modified'){ { svelteHTML.createElement("span", {   "class":`mark modified`,"title":`Modified: the original set has this name with another sound`,});  }} else if (origin === 'new'){ { svelteHTML.createElement("span", {   "class":`mark new`,"title":`New: not in the original set`,});  }}
               }
             }
          }
         }
       }
       { svelteHTML.createElement("section", { "class":`list computer`,});
         { svelteHTML.createElement("h2", {});
          
           { svelteHTML.createElement("span", { "class":`tools`,});
             { svelteHTML.createElement("button", {         "class":`icon-sm`,"aria-label":`Choose preset folder`,"title":folderSupported ? 'Choose a folder with .mo files' : 'Folder access needs Chrome or Edge',"disabled":!folderSupported,"onclick":() => editor.chooseFolder(),});
               { svelteHTML.createElement("svg", {       "viewBox":`0 0 24 24`,"fill":`none`,"stroke":`currentColor`,"stroke-width":`1.8`,}); { svelteHTML.createElement("path", {  "d":`M3 6h7l2 2h9v11H3z`,});} }
             }
             { svelteHTML.createElement("button", {     "class":`icon-sm`,"aria-label":`Refresh folder`,"onclick":() => editor.refreshFolder(),});
               { svelteHTML.createElement("svg", {       "viewBox":`0 0 24 24`,"fill":`none`,"stroke":`currentColor`,"stroke-width":`1.8`,}); { svelteHTML.createElement("path", {  "d":`M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5`,});} }
             }
           }
         }
         { svelteHTML.createElement("ol", {});
             for(let f of __sveltets_2_ensureArray(editor.localFiles)){f.name;
             { svelteHTML.createElement("li", {});
               { svelteHTML.createElement("button", {       "disabled":!editor.live,"title":`Load into the current preset (not stored until you save)`,"onclick":() => loadLocal(f.name),});f.name === editor.localSelected;f.name; }
             }
          }
             { svelteHTML.createElement("li", { "class":`hint`,});           }
          
         }
       }
     }

     { svelteHTML.createElement("main", { "class":`main`,});
       { svelteHTML.createElement("p", { "class":`banner`,});
        if(editor.dirty){            } else if (editor.live){presetLabel(editor.live.index);  editor.live.name;}else{         }
       }

       { svelteHTML.createElement("nav", {   "class":`chain`,"aria-label":`Signal chain`,});
            for(let s of __sveltets_2_ensureArray(catalog.slots)){let slot = 1;slot;
          const on = editor.live?.modules[slot]?.on ?? false;
           { svelteHTML.createElement("button", {       "class":`mod`,"aria-pressed":editor.selectedSlot === slot,"onclick":() => (editor.selectedSlot = slot),});on;editor.selectedSlot === slot;
             { svelteHTML.createElement("span", {});s.name.replace('/', ' / '); }
             { const $$_nocIeludoM5C = __sveltets_2_ensureComponent(ModuleIcon); new $$_nocIeludoM5C({ target: __sveltets_2_any(), props: { slot,}});}
           }
        }
       }

       { svelteHTML.createElement("div", { "class":`panel-wrap`,});
        if(editor.live){
           { const $$_lenaPeludoM4C = __sveltets_2_ensureComponent(ModulePanel); new $$_lenaPeludoM4C({ target: __sveltets_2_any(), props: {       "slot":editor.selectedSlot,"mod":editor.live.modules[editor.selectedSlot],"onchange":(m) => editor.editModule(editor.selectedSlot, m),}});}
        }else{
           { svelteHTML.createElement("div", { "class":`empty`,});editor.device ? 'Select a preset.' : 'Quit the official GE150PRO app, then click Connect device.'; }
        }
       }
     }
   }
 }


};
return { props: {} as Record<string, never>, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const App__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type App__SvelteComponent_ = ReturnType<typeof App__SvelteComponent_>;
/*Ωignore_endΩ*/export default App__SvelteComponent_;