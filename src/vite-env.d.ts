/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** The calendar version of a GitHub Pages build (set by the deploy workflow). */
  readonly VITE_APP_VERSION?: string;
}
