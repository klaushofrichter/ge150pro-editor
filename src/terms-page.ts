// terms.html: the terms of use (TERMS.md) as a page of their own, linked from the intro panel and the README.
import './app.css';
import { termsHtml, TERMS_VERSION } from './lib/terms';

const main = document.getElementById('terms')!;
main.innerHTML = `
  <p class="back"><a href="./">← GE150 Pro Editor</a></p>
  <h1>Terms of use</h1>
  ${termsHtml()}
  <p class="back"><a href="./">← GE150 Pro Editor</a></p>`;
document.documentElement.dataset.termsVersion = TERMS_VERSION;

const style = document.createElement('style');
style.textContent = `
  html, body { height: auto; overflow: auto; }
  .terms-page { max-width: 760px; margin: 0 auto; padding: 24px 20px 48px; line-height: 1.55; }
  .terms-page h1 { font-weight: 500; font-size: 1.8rem; margin: 8px 0 12px; }
  .terms-page h4 { font-size: 1.1rem; font-weight: 600; margin: 22px 0 4px; }
  .terms-page p { margin: 6px 0; }
  .terms-page a { color: var(--accent); }
  .terms-page .back { color: var(--muted); font-size: 0.9rem; }
`;
document.head.append(style);
