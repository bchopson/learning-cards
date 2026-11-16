import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import { escapeHtml, parseCards } from '../scripts/cards.js';

const file = 'cards/phonics/set-1.md';

test('splits multiple question/answer pairs and renders Markdown', () => {
  const { title, cards } = parseCards('# My **Phonics** Set\n\n## question\n\n**dog**\n\n## answer\n\nA pet.\n\n## Question\n\n### Hint\n\ncat\n\n## Answer\n\n- meow\n', file);
  assert.equal(title, 'My Phonics Set');
  assert.doesNotMatch(cards[0].question, /My|Phonics/);
  assert.equal(cards.length, 2);
  assert.match(cards[0].question, /<strong>dog<\/strong>/);
  assert.match(cards[1].question, /<h3>Hint<\/h3>/);
  assert.match(cards[1].answer, /<li>meow<\/li>/);
});

test('rewrites local media paths and embeds audio with controls', () => {
  const { cards: [card] } = parseCards('# Phonics\n\n## Question\n\n![Dog](images/dog.png)\n\n## Answer\n\n[Listen](dog.m4a)\n\n[Remote](https://example.com/dog.mp3)\n', file);
  assert.match(card.question, /src="cards\/phonics\/images\/dog.png"/);
  assert.match(card.answer, /<audio controls preload="none" src="cards\/phonics\/dog.m4a">/);
  assert.match(card.answer, /src="https:\/\/example.com\/dog.mp3"/);
  assert.match(card.answer, /Download audio/);
});

test('supports reference links, regular links, and parent-relative paths', () => {
  const { cards: [card] } = parseCards('# Phonics\n\n## Question\n\n[Hint](https://example.com)\n\n## Answer\n\n[Listen][sound]\n\n[Guide](../guide.pdf)\n\n[sound]: dog.m4a\n', file);
  assert.match(card.question, /href="https:\/\/example.com"/);
  assert.match(card.answer, /src="cards\/phonics\/dog.m4a"/);
  assert.match(card.answer, /href="cards\/guide.pdf"/);
});

test('reports invalid card structure with the source filename', () => {
  for (const markdown of [
    '',
    '#',
    '# Phonics',
    '## Question\n\ndog\n\n## Answer\n\nbark',
    '# Phonics\n\n# Question\n\ndog\n\n# Answer\n\nbark',
    '# Phonics\n\n## Answer\n\ndog',
    '# Phonics\n\n## Question\n\ndog',
    '# Phonics\n\n## Question\n\n## Answer\n\ndog',
    '# Phonics\n\n## Question\n\ndog\n\n## Answer\n\n## Question\n\ncat\n\n## Answer\n\nmeow',
  ]) {
    assert.throws(() => parseCards(markdown, file), /cards\/phonics\/set-1.md:/);
  }
});

test('does not render raw HTML or unsafe link protocols', () => {
  const { cards: [card] } = parseCards('# Phonics\n\n## Question\n\n<script>alert(1)</script>\n\n## Answer\n\n[Bad](javascript:alert)\n', file);
  assert.doesNotMatch(card.question, /<script>/);
  assert.doesNotMatch(card.answer, /href="javascript:/);
  assert.equal(escapeHtml('<a "&\'>'), '&lt;a &quot;&amp;&#39;&gt;');
});

test('renders inline and display math while preserving ordinary code', () => {
  const { cards: [card] } = parseCards('# Math\n\n## Question\n\nFind $x^2$ and use `x^2`.\n\n## Answer\n\n$$\nx = \\pm 3\n$$\n', 'cards/math/test.md');
  assert.match(card.question, /class="katex"/);
  assert.match(card.question, /<math[^>]*xmlns="http:\/\/www.w3.org\/1998\/Math\/MathML"/);
  assert.match(card.question, /<code>x\^2<\/code>/);
  assert.doesNotMatch(card.question, /katex-display|katex-error/);
  assert.match(card.answer, /class="katex-display"/);
  assert.match(card.answer, /<mo>±<\/mo>/);
  assert.doesNotMatch(card.answer, /katex-error/);
});

test('renders the geometry set’s circle area formula', async () => {
  const file = 'cards/math/geometry.md';
  const markdown = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  const { title, cards } = parseCards(markdown, file);
  assert.equal(title, 'Geometry');
  assert.match(cards[2].answer, /src="cards\/math\/sine-ratio.svg"/);
  for (const shape of ['square', 'rectangle', 'diamond', 'trapezoid']) {
    assert.ok(cards[1].answer.includes(`src="cards/math/${shape}.svg"`));
  }
  assert.match(cards[0].question, /What is the area of a circle\?/);
  assert.match(cards[0].answer, /class="katex"/);
  assert.match(cards[0].answer, /<mi>π<\/mi>/);
  assert.match(cards[0].answer, /<img src="cards\/math\/circle-area.svg" alt="Circle with shaded area and a radius labelled r">/);
  assert.match(cards[0].answer, /<msup><mi>r<\/mi><mn>2<\/mn><\/msup>/);
  assert.doesNotMatch(cards[0].answer, /katex-error|\$πr\^2\$/);
});

test('build produces a complete static site with copied media and math assets', async () => {
  const root = new URL('../', import.meta.url);
  execFileSync(process.execPath, ['scripts/build.js'], { cwd: root });
  const html = await readFile(new URL('dist/index.html', root), 'utf8');
  assert.match(html, /<h2>phonics<\/h2>/);
  assert.match(html, /href="#set-\d+">Phonics Set 1<\/a>/);
  assert.match(html, /href="#set-\d+">Geometry<\/a>/);
  assert.match(html, /class="katex"/);
  assert.match(html, /href="\.\/katex\/katex.min.css"/);
  assert.match(html, /<h2 tabindex="-1">phonics \/ Phonics Set 1<\/h2>/);
  assert.match(html, /class="card" hidden/);
  assert.match(html, /class="answer"[^>]* hidden/);
  assert.match(html, /src="cards\/phonics\/dog.m4a"/);
  assert.doesNotMatch(html, /<!-- SET/);
  for (const asset of ['app.js', 'style.css', 'katex/katex.min.css', 'katex/fonts/KaTeX_Main-Regular.woff2', 'cards/math/circle-area.svg', 'cards/math/sine-ratio.svg', 'cards/math/square.svg', 'cards/math/rectangle.svg', 'cards/math/diamond.svg', 'cards/math/trapezoid.svg', 'cards/phonics/dog.m4a', '.nojekyll']) {
    assert.ok((await stat(new URL(`dist/${asset}`, root))).isFile());
  }
  assert.deepEqual(await readFile(new URL('dist/cards/phonics/dog.m4a', root)), await readFile(new URL('cards/phonics/dog.m4a', root)));
  await assert.rejects(stat(new URL('dist/cards/phonics/set-1.md', root)), { code: 'ENOENT' });
});
