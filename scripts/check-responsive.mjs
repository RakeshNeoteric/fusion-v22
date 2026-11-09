// Responsive design rules for CSS (RESPONSIVE.md), run by `npm run verify`.
// ESLint checks the TypeScript side (popup sizes); this checks the stylesheets, including the
// styles written inside components.
//
//  1. Screen-size rules use the range form: `@media (width < 1280px)`, not `max-width:`.
//  2. Within the desktop range they use only the agreed breakpoints.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const BREAKPOINTS = [1024, 1280, 1440, 1920, 2560];

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (/\.(css|ts)$/.test(entry.name) && !entry.name.endsWith('.spec.ts')) yield path;
  }
}

const problems = [];
for (const path of files('src')) {
  const lines = readFileSync(path, 'utf8').split('\n');
  lines.forEach((line, index) => {
    const query = /@(media|container)\b([^{]*)/.exec(line);
    if (!query) return;
    const where = `${path}:${index + 1}`;
    if (/\b(min|max)-(width|height)\s*:/.test(query[2])) {
      problems.push(`${where}  write the range form, e.g. (width < 1280px), not min-/max-width`);
    }
    if (query[1] !== 'media') return;
    for (const match of query[2].matchAll(/(\d+)px/g)) {
      const value = Number(match[1]);
      if (value >= 1024 && !BREAKPOINTS.includes(value)) {
        problems.push(`${where}  ${value}px is not a breakpoint; use ${BREAKPOINTS.join(', ')}`);
      }
    }
  });
}

if (problems.length) {
  console.error(`Responsive rules (RESPONSIVE.md):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('Responsive rules: all stylesheets follow them.');
