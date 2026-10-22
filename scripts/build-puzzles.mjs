#!/usr/bin/env node
// Build the bundled puzzle set from the Lichess puzzle database (CC0).
//
//   curl -fsSL -o puzzles.csv.zst https://database.lichess.org/lichess_db_puzzle.csv.zst
//   zstd -dc puzzles.csv.zst | node scripts/build-puzzles.mjs --out public/puzzles.json.gz
//
// Reads the CSV from stdin (or from --in <file.csv>), keeps popular, well-played
// puzzles, samples them evenly across rating buckets and writes a gzipped,
// compact JSON file. The full database is never written into the repo.

import { createReadStream, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { gzipSync } from 'node:zlib';
import { Chess } from 'chess.js';

const args = parseArgs(process.argv.slice(2));
const opts = {
  in: args.in ?? '-',
  out: args.out ?? 'public/puzzles.json.gz',
  minRating: num(args['min-rating'], 600),
  maxRating: num(args['max-rating'], 2600),
  bucket: num(args.bucket, 100),
  target: num(args.target, 4000),
  minPopularity: num(args['min-popularity'], 90),
  minPlays: num(args['min-plays'], 1000),
  maxDeviation: num(args['max-deviation'], 90),
  seed: num(args.seed, 20261022),
};

const nBuckets = Math.ceil((opts.maxRating - opts.minRating) / opts.bucket);
const quota = Math.ceil(opts.target / nBuckets);
const rand = mulberry32(opts.seed);
// Reservoir per rating bucket: an unbiased sample of every puzzle passing the filters.
const buckets = Array.from({ length: nBuckets }, () => ({ seen: 0, items: [] }));

let total = 0;
let kept = 0;
const input = opts.in === '-' ? process.stdin : createReadStream(opts.in);
const rl = createInterface({ input, crlfDelay: Infinity });

for await (const line of rl) {
  if (!line || line.startsWith('PuzzleId')) continue;
  total++;
  // PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
  const f = line.split(',');
  if (f.length < 8) continue;
  const rating = Number(f[3]);
  if (!(rating >= opts.minRating && rating < opts.maxRating)) continue;
  if (Number(f[4]) > opts.maxDeviation) continue;
  if (Number(f[5]) < opts.minPopularity) continue;
  if (Number(f[6]) < opts.minPlays) continue;
  const moves = f[2].split(' ');
  if (moves.length < 2 || moves.length % 2 !== 0) continue;
  kept++;
  const b = buckets[Math.floor((rating - opts.minRating) / opts.bucket)];
  const item = [f[0], f[1], f[2], rating, f[7]];
  b.seen++;
  if (b.items.length < quota) b.items.push(item);
  else {
    const j = Math.floor(rand() * b.seen);
    if (j < quota) b.items[j] = item;
  }
  if (total % 1_000_000 === 0) console.error(`… ${total.toLocaleString()} rows read`);
}

const puzzles = [];
let invalid = 0;
for (const b of buckets) {
  for (const p of b.items) {
    if (isValid(p)) puzzles.push(p);
    else invalid++;
  }
}
puzzles.sort((a, b) => a[3] - b[3] || (a[0] < b[0] ? -1 : 1));

const payload = {
  v: 1,
  source: 'https://database.lichess.org/#puzzles (CC0)',
  generated: new Date().toISOString().slice(0, 10),
  fields: ['id', 'fen', 'moves', 'rating', 'themes'],
  puzzles,
};
const json = JSON.stringify(payload);
const gz = gzipSync(json, { level: 9 });
mkdirSync(dirname(opts.out), { recursive: true });
writeFileSync(opts.out, gz);

console.error(`rows read: ${total.toLocaleString()}, passing filters: ${kept.toLocaleString()}`);
console.error(`invalid after sampling: ${invalid}`);
console.error('bucket fill:');
buckets.forEach((b, i) => {
  const lo = opts.minRating + i * opts.bucket;
  console.error(`  ${lo}-${lo + opts.bucket - 1}: ${b.items.length}/${quota} (pool ${b.seen})`);
});
console.error(`wrote ${puzzles.length} puzzles → ${opts.out} (${(json.length / 1024).toFixed(0)} KB json, ${(gz.length / 1024).toFixed(0)} KB gzip)`);
if (puzzles.length < 3000) {
  console.error('ERROR: fewer than 3000 puzzles; relax the filters.');
  process.exit(1);
}

// Replay the whole solution with chess.js so the app never ships a broken line.
function isValid([, fen, moves]) {
  try {
    const chess = new Chess(fen);
    for (const uci of moves.split(' ')) {
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    }
    return true;
  } catch {
    return false;
  }
}

function parseArgs(list) {
  const out = {};
  for (let i = 0; i < list.length; i++) {
    if (list[i].startsWith('--')) out[list[i].slice(2)] = list[i + 1], i++;
  }
  return out;
}

function num(v, d) {
  return v === undefined ? d : Number(v);
}

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
