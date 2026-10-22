// Copies the single-threaded Stockfish WASM build from node_modules into public/
// so it is served as a plain static file next to the app (no COOP/COEP needed).
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const bin = join(dirname(require.resolve('stockfish/package.json')), 'bin');
const out = new URL('../public/engine/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const f of ['stockfish-18-lite-single.js', 'stockfish-18-lite-single.wasm']) {
  copyFileSync(join(bin, f), new URL(f, out));
}
// Stockfish is GPLv3: ship its license next to the binary.
copyFileSync(join(bin, '..', 'Copying.txt'), new URL('COPYING.txt', out));
console.log('stockfish lite-single copied to public/engine/');
