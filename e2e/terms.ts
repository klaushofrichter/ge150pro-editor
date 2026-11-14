// The accepted-terms entry of a returning visitor, from TERMS.md (as src/lib/terms.ts reads it in the app).
import { readFileSync } from 'node:fs';

export const ACCEPTED_KEY = 'ge150pro-editor.terms-accepted';
export const TERMS_VERSION = /Version (\d{4}-\d{2}-\d{2})/.exec(readFileSync('TERMS.md', 'utf8'))![1];
