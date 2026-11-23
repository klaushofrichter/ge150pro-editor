// The terms of use (TERMS.md, the single source) for the app: the accepted version and a small renderer for the
// file's subset of Markdown (# and ## headings, paragraphs, <links>, "quoted" text, `code`).
import terms from '../../TERMS.md?raw';

/** The version line of TERMS.md; accepting it is remembered, and a new version shows the intro panel again. */
export const TERMS_VERSION = /Version (\d{4}-\d{2}-\d{2})/.exec(terms)?.[1] ?? 'unknown';

/** localStorage key: the terms version the visitor accepted. */
export const ACCEPTED_KEY = 'ge150pro-editor.terms-accepted';

/** sessionStorage key: the About panel was shown in this browser session because no pedal was connected. */
export const INFO_SHOWN_KEY = 'ge150pro-editor.info-shown';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(text: string): string {
  return esc(text)
    .replace(/&lt;(https:\/\/[^\s&]+)&gt;/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/** TERMS.md as HTML, without its title. Only the file's own text goes through here (no user input). */
export function termsHtml(): string {
  return terms
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\n/g, ' ').trim())
    .filter((b) => b && !b.startsWith('# '))
    .map((b) => (b.startsWith('## ') ? `<h4>${inline(b.slice(3))}</h4>` : `<p>${inline(b)}</p>`))
    .join('\n');
}
