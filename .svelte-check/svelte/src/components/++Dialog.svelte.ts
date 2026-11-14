///<reference types="svelte" />
;
import type { Snippet } from 'svelte';

;type $$ComponentProps =  { title: string; onclose: () => void; footer?: string; children: Snippet };function $$render() {

  

  let { title, onclose, footer, children }:/*Ωignore_startΩ*/$$ComponentProps/*Ωignore_endΩ*/ = $props();
  const id = $derived(`dlg-${title.toLowerCase().replace(/\W+/g, '-')}`);
;
async () => {

 { svelteHTML.createElement("svelte:window", {  "onkeydown":(e) => e.key === 'Escape' && onclose(),});}
 { svelteHTML.createElement("div", {     "class":`backdrop`,"role":`presentation`,"onclick":onclose,}); }
 { svelteHTML.createElement("div", {       "class":`dialog`,"role":`dialog`,"aria-modal":`true`,"aria-labelledby":id,});
   { svelteHTML.createElement("header", {});
     { svelteHTML.createElement("h2", {id,});title; }
     { svelteHTML.createElement("button", {     "class":`close`,"aria-label":`Close`,"onclick":onclose,});  }
   }
  ;__sveltets_2_ensureSnippet(children());
  if(footer){ { svelteHTML.createElement("footer", { "class":`muted`,});footer; }}
 }


};
return { props: {} as any as $$ComponentProps, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const Dialog__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type Dialog__SvelteComponent_ = ReturnType<typeof Dialog__SvelteComponent_>;
/*Ωignore_endΩ*/export default Dialog__SvelteComponent_;