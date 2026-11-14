///<reference types="svelte" />
;
;type $$ComponentProps =  {
    id: string;
    label: string;
    value: number;
    max: number;
    min?: number;
    format?: (v: number) => string;
    onchange: (v: number) => void;
  };function $$render() {

  /** Label, slider over raw 0..max, and ◀ value ▶ stepper. Emits clamped raw values. */
  let {
    id,
    label,
    value,
    max,
    min = 0,
    format = (v: number) => String(v),
    onchange,
  }:/*Ωignore_startΩ*/$$ComponentProps/*Ωignore_endΩ*/ = $props();

  const set = (v: number) => onchange(Math.max(min, Math.min(max, v)));
;
async () => {

 { svelteHTML.createElement("div", { "class":`row`,});
   { svelteHTML.createElement("label", { "for":id,});label; }
   { svelteHTML.createElement("input", {          id,"type":`range`,min,max,value,"style":`--fill: ${((value - min) / (max - min || 1)) * 100}%`,"oninput":(e) => set(Number(e.currentTarget.value)),});}
   { svelteHTML.createElement("div", { "class":`stepper`,});
     { svelteHTML.createElement("button", {   "aria-label":`Decrease ${label}`,"onclick":() => set(value - 1),});  }
     { svelteHTML.createElement("output", {});format(value); }
     { svelteHTML.createElement("button", {   "aria-label":`Increase ${label}`,"onclick":() => set(value + 1),});  }
   }
 }


};
return { props: {} as any as $$ComponentProps, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const SliderRow__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type SliderRow__SvelteComponent_ = ReturnType<typeof SliderRow__SvelteComponent_>;
/*Ωignore_endΩ*/export default SliderRow__SvelteComponent_;