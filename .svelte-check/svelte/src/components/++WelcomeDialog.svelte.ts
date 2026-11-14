///<reference types="svelte" />
;
  // Shown on the first visit and closed only by confirming. Confirming is remembered in this browser (localStorage);
  // when storage is not available (some private windows) the panel simply shows again next time.
  const KEY = 'ge150pro-editor.welcome-confirmed';

  export function welcomeConfirmed(): boolean {
    try {
      return localStorage.getItem(KEY) !== null;
    } catch {
      return false;
    }
  }

  function remember() {
    try {
      localStorage.setItem(KEY, new Date().toISOString());
    } catch {
      // not remembered: shown again next time
    }
  }
;;

import { onMount } from 'svelte';

;type $$ComponentProps =  { onconfirm: () => void };function $$render() {

  

  let { onconfirm }:/*Ωignore_startΩ*/$$ComponentProps/*Ωignore_endΩ*/ = $props();
  let button: HTMLButtonElement | undefined = $state();

  const REPO = 'https://github.com/klaushofrichter/ge150pro-editor';
  const PRODUCT = 'https://www.mooeraudio.com/products/207.html';
  const DOWNLOADS = 'https://www.mooeraudio.com/Downloads_xq/6.html';

  onMount(() => button?.focus());

  function confirm() {
    remember();
    onconfirm();
  }
;
async () => {



 { svelteHTML.createElement("div", {   "class":`backdrop`,"role":`presentation`,}); }
 { svelteHTML.createElement("div", {         "class":`welcome`,"role":`dialog`,"aria-modal":`true`,"aria-labelledby":`welcome-title`,"aria-describedby":`welcome-what`,});
   { svelteHTML.createElement("h2", { "id":`welcome-title`,});   }

   { svelteHTML.createElement("p", { "id":`welcome-what`,});
          { svelteHTML.createElement("a", {     "href":PRODUCT,"target":`_blank`,"rel":`noopener`,});   }    
                        
                     
     { svelteHTML.createElement("a", { "href":`./?demo`,});   }      
   }

   { svelteHTML.createElement("h3", {});    }
   { svelteHTML.createElement("p", {});
                    { svelteHTML.createElement("strong", {});   
     }          { svelteHTML.createElement("strong", {});     }
   }

   { svelteHTML.createElement("h3", {});   }
   { svelteHTML.createElement("p", {});                         }
   { svelteHTML.createElement("ol", {});
     { svelteHTML.createElement("li", {});       { svelteHTML.createElement("a", {     "href":DOWNLOADS,"target":`_blank`,"rel":`noopener`,});   }  }
     { svelteHTML.createElement("li", {});
           { svelteHTML.createElement("code", {});  }         { svelteHTML.createElement("code", {});  }
        { svelteHTML.createElement("code", {});  }  { svelteHTML.createElement("em", {});   }   { svelteHTML.createElement("code", {});  }
               
     }
     { svelteHTML.createElement("li", {});  { svelteHTML.createElement("strong", {});     }   { svelteHTML.createElement("strong", {});         }  }
   }
   { svelteHTML.createElement("p", { "class":`muted`,});           }

   { svelteHTML.createElement("h3", {});     }
   { svelteHTML.createElement("p", { "class":`risk`,});
                         
                       
       { svelteHTML.createElement("a", {     "href":`${REPO}/blob/main/LICENSE`,"target":`_blank`,"rel":`noopener`,});  }  
             
   }

   { svelteHTML.createElement("p", { "class":`muted`,});   { svelteHTML.createElement("a", {     "href":REPO,"target":`_blank`,"rel":`noopener`,});  } }

   { svelteHTML.createElement("div", { "class":`actions`,});
     { const $$_button2 = svelteHTML.createElement("button", {     "class":`confirm`,"onclick":confirm,});button = $$_button2;      }
   }
 }


};
return { props: {} as any as $$ComponentProps, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const WelcomeDialog__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type WelcomeDialog__SvelteComponent_ = ReturnType<typeof WelcomeDialog__SvelteComponent_>;
/*Ωignore_endΩ*/export default WelcomeDialog__SvelteComponent_;