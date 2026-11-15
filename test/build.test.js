import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import { escapeHtml, parseCards } from '../scripts/cards.js';

const file = 'cards/phonics/set-1.md';

test('splits multiple question/answer pairs and renders Markdown', () => {
  const cards = parseCards('# question\n\n**dog**\n\n# answer\n\nA pet.\n\n# Question\n\n## Hint\n\ncat\n\n# Answer\n\n- meow\n', file);
  assert.equal(cards.length, 2);
  assert.match(cards[0].question, /<strong>dog<\/strong>/);
  assert.match(cards[1].question, /<h2>Hint<\/h2>/);
  assert.match(cards[1].answer, /<li>meow<\/li>/);
});

test('rewrites local media paths and embeds audio with controls', () => {
  const [card] = parseCards('# Question\n\n![Dog](images/dog.png)\n\n# Answer\n\n[Listen](dog.m4a)\n\n[Remote](https://example.com/dog.mp3)\n', file);
  assert.match(card.question, /src="cards\/phonics\/images\/dog.png"/);
  assert.match(card.answer, /<audio controls preload="none" src="cards\/phonics\/dog.m4a">/);
  assert.match(card.answer, /src="https:\/\/example.com\/dog.mp3"/);
  assert.match(card.answer, /Download audio/);
});

test('supports reference links, regular links, and parent-relative paths', () => {
  const [card] = parseCards('# Question\n\n[Hint](https://example.com)\n\n# Answer\n\n[Listen][sound]\n\n[Guide](../guide.pdf)\n\n[sound]: dog.m4a\n', file);
  assert.match(card.question, /href="https:\/\/example.com"/);
  assert.match(card.answer, /src="cards\/phonics\/dog.m4a"/);
  assert.match(card.answer, /href="cards\/guide.pdf"/);
});

test('reports invalid card structure with the source filename', () => {
  for (const markdown of ['', '# Answer\n\ndog', '# Question\n\ndog', '# Question\n\n# Answer\n\ndog', '# Question\n\ndog\n\n# Answer\n\n# Question\n\ncat\n\n# Answer\n\nmeow']) {
    assert.throws(() => parseCards(markdown, file), /cards\/phonics\/set-1.md:/);
  }
});

test('does not render raw HTML or unsafe link protocols', () => {
  const [card] = parseCards('# Question\n\n<script>alert(1)</script>\n\n# Answer\n\n[Bad](javascript:alert)\n', file);
  assert.doesNotMatch(card.question, /<script>/);
  assert.doesNotMatch(card.answer, /href="javascript:/);
  assert.equal(escapeHtml('<a "&\'>'), '&lt;a &quot;&amp;&#39;&gt;');
});

test('build produces a complete static site with copied media', async () => {
  const root = new URL('../', import.meta.url);
  execFileSync(process.execPath, ['scripts/build.js'], { cwd: root });
  const html = await readFile(new URL('dist/index.html', root), 'utf8');
  assert.match(html, /<h2>phonics<\/h2>/);
  assert.match(html, /href="#set-0">set-1<\/a>/);
  assert.match(html, /class="card" hidden/);
  assert.match(html, /class="answer"[^>]* hidden/);
  assert.match(html, /src="cards\/phonics\/dog.m4a"/);
  assert.doesNotMatch(html, /<!-- SET/);
  for (const asset of ['app.js', 'style.css', 'cards/phonics/dog.m4a', '.nojekyll']) {
    assert.ok((await stat(new URL(`dist/${asset}`, root))).isFile());
  }
  assert.deepEqual(await readFile(new URL('dist/cards/phonics/dog.m4a', root)), await readFile(new URL('cards/phonics/dog.m4a', root)));
  await assert.rejects(stat(new URL('dist/cards/phonics/set-1.md', root)), { code: 'ENOENT' });
});
