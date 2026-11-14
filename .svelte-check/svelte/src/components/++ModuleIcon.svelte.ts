///<reference types="svelte" />
;
;type $$ComponentProps =  { slot: number };function $$render() {

  // Simple line icons for the nine module slots, drawn for this app.
  let { slot }:/*Ωignore_startΩ*/$$ComponentProps/*Ωignore_endΩ*/ = $props();
;
async () => {

 { svelteHTML.createElement("svg", {           "viewBox":`0 0 48 48`,"aria-hidden":`true`,"fill":`none`,"stroke":`currentColor`,"stroke-width":`2.5`,"stroke-linejoin":`round`,});
  if(slot === 0){
     { svelteHTML.createElement("rect", {        "x":`8`,"y":`8`,"width":`13`,"height":`13`,});} { svelteHTML.createElement("rect", {        "x":`27`,"y":`8`,"width":`13`,"height":`13`,});}
     { svelteHTML.createElement("rect", {        "x":`8`,"y":`27`,"width":`13`,"height":`13`,});} { svelteHTML.createElement("rect", {        "x":`27`,"y":`27`,"width":`13`,"height":`13`,});}
  } else if (slot === 1){
     { svelteHTML.createElement("path", {  "d":`M17 8c-5 4-5 28 0 32M31 8c5 4 5 28 0 32M21 10v28M27 10v28M6 24h6M36 24h6`,});}
  } else if (slot === 2){
     { svelteHTML.createElement("rect", {          "x":`5`,"y":`17`,"width":`38`,"height":`20`,"rx":`2`,});} { svelteHTML.createElement("path", {    "d":`M16 11h16M18 24h12M10 31h28`,"stroke-dasharray":`2 3`,});}
  } else if (slot === 3){
     { svelteHTML.createElement("rect", {        "x":`9`,"y":`7`,"width":`30`,"height":`32`,});} { svelteHTML.createElement("rect", {        "x":`15`,"y":`13`,"width":`18`,"height":`18`,});} { svelteHTML.createElement("path", {  "d":`M13 43h22`,});}
  } else if (slot === 4){
     { svelteHTML.createElement("path", {  "d":`M10 10h16v28H10zM14 24l6-4v8z`,});} { svelteHTML.createElement("path", {  "d":`M31 18c3 3 3 9 0 12M36 14c5 5 5 15 0 20`,});}
  } else if (slot === 5){
     { svelteHTML.createElement("path", {  "d":`M10 8v32M19 8v32M28 8v32M37 8v32`,});} { svelteHTML.createElement("path", {  "d":`M6 30h8M15 16h8M24 34h8M33 22h8`,});}
  } else if (slot === 6){
     { svelteHTML.createElement("path", {  "d":`M6 40L16 8l8 32 8-32 10 32`,});}
  } else if (slot === 7){
     { svelteHTML.createElement("path", {  "d":`M7 40V10h6v30M17 40V18h6v22M27 40V24h6v16M37 40V30h4`,});}
  }else{
     { svelteHTML.createElement("rect", {        "x":`7`,"y":`7`,"width":`34`,"height":`34`,});} { svelteHTML.createElement("rect", {        "x":`14`,"y":`14`,"width":`20`,"height":`20`,});} { svelteHTML.createElement("rect", {        "x":`20`,"y":`20`,"width":`8`,"height":`8`,});}
  }
 }


};
return { props: {} as any as $$ComponentProps, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const ModuleIcon__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type ModuleIcon__SvelteComponent_ = ReturnType<typeof ModuleIcon__SvelteComponent_>;
/*Ωignore_endΩ*/export default ModuleIcon__SvelteComponent_;