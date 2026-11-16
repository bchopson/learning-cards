import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, parseCards } from './cards.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const topics = new Map();

async function collect(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(file);
    } else if (entry.name.endsWith('.md')) {
      const topic = path.posix.relative('cards', directory) || 'General';
      const { title, cards } = parseCards(await readFile(path.join(root, file), 'utf8'), file);
      const set = {
        id: `set-${[...topics.values()].reduce((count, sets) => count + sets.length, 0)}`,
        name: title,
        cards,
      };
      if (!topics.has(topic)) topics.set(topic, []);
      topics.get(topic).push(set);
    }
  }
}

await collect('cards');
const contents = [...topics].map(([topic, sets]) => `
  <section><h2>${escapeHtml(topic)}</h2><ul>
    ${sets.map(set => `<li><a href="#${set.id}">${escapeHtml(set.name)}</a> (${set.cards.length} cards)</li>`).join('')}
  </ul></section>`).join('');
const sets = [...topics].flatMap(([topic, sets]) => sets.map(set => `
  <section class="set" id="${set.id}" hidden>
    <h2 tabindex="-1">${escapeHtml(topic)} / ${escapeHtml(set.name)}</h2>
    <p class="progress" aria-live="polite"></p>
    ${set.cards.map((card, index) => `<article class="card" hidden>
      <h3>Question</h3><div>${card.question}</div>
      <button class="reveal" aria-expanded="false" aria-controls="${set.id}-answer-${index}">Show answer</button>
      <div class="answer" id="${set.id}-answer-${index}" hidden><h3>Answer</h3>${card.answer}</div>
    </article>`).join('')}
    <nav aria-label="Cards"><button class="previous">Previous</button><button class="next">Next</button></nav>
    <p><a href="#">All sets</a></p>
  </section>`)).join('');
const template = await readFile(path.join(root, 'index.html'), 'utf8');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await writeFile(path.join(dist, 'index.html'), template.replace('<!-- SET_INDEX -->', contents || '<p>No sets yet.</p>').replace('<!-- SETS -->', sets));
await cp(path.join(root, 'site'), dist, { recursive: true });
const katexDist = path.dirname(fileURLToPath(import.meta.resolve('katex/dist/katex.min.css')));
await cp(path.join(katexDist, 'katex.min.css'), path.join(dist, 'katex/katex.min.css'));
await cp(path.join(katexDist, 'fonts'), path.join(dist, 'katex/fonts'), { recursive: true });
await cp(path.join(root, 'cards'), path.join(dist, 'cards'), {
  recursive: true,
  filter: source => !source.endsWith('.md'),
});
await writeFile(path.join(dist, '.nojekyll'), '');
console.log(`Built ${[...topics.values()].flat().length} sets into dist/`);
