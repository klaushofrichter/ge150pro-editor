///<reference types="svelte" />
;
;type $$ComponentProps =  { checked: boolean; label: string; disabled?: boolean; onchange?: (v: boolean) => void };function $$render() {

  let {
    checked,
    label,
    disabled = false,
    onchange,
  }:/*Ωignore_startΩ*/$$ComponentProps/*Ωignore_endΩ*/ = $props();
;
async () => {

 { svelteHTML.createElement("label", {   "class":`toggle`,"title":label,});disabled;
   { svelteHTML.createElement("input", {      "type":`checkbox`,checked,disabled,"onchange":(e) => onchange?.(e.currentTarget.checked),});}
   { svelteHTML.createElement("span", { "aria-hidden":`true`,}); }
   { svelteHTML.createElement("span", { "class":`sr-only`,});label; }
 }


};
return { props: {} as any as $$ComponentProps, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const Toggle__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type Toggle__SvelteComponent_ = ReturnType<typeof Toggle__SvelteComponent_>;
/*Ωignore_endΩ*/export default Toggle__SvelteComponent_;