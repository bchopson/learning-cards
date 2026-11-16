import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';

function walk(node, visit) {
  node.children?.forEach(child => walk(child, visit));
  visit(node);
}

function media() {
  return tree => walk(tree, node => {
    if (node.tagName !== 'a' || !/\.(m4a|mp3|ogg|wav|aac|webm)(?:[?#]|$)/i.test(node.properties.href ?? '')) return;
    const href = node.properties.href;
    node.tagName = 'audio';
    node.properties = { controls: true, preload: 'none', src: href };
    node.children = [{ type: 'element', tagName: 'a', properties: { href }, children: [{ type: 'text', value: 'Download audio' }] }];
  });
}

const parser = unified().use(remarkParse).use(remarkMath);
const renderer = unified()
  .use(remarkRehype)
  .use(rehypeSanitize, {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      code: [['className', /^language-./, 'math-inline', 'math-display']],
    },
  })
  .use(rehypeKatex)
  .use(media)
  .use(rehypeStringify);

export function parseCards(markdown, file) {
  const tree = parser.parse(markdown);
  const titleNode = tree.children.shift();
  const fail = message => { throw new Error(`${file}: ${message}`); };
  if (titleNode?.type !== 'heading' || titleNode.depth !== 1) fail('Start each set with a # Title.');
  let title = '';
  walk(titleNode, node => {
    if (node.type === 'text' || node.type === 'inlineCode') title += node.value;
  });
  title = title.trim();
  if (!title) fail('Set title must not be empty.');
  const cards = [];
  const definitions = tree.children.filter(node => node.type === 'definition');
  let card;
  let side;
  const validate = () => {
    if (!card?.question.length || !card?.answer.length) fail('Each card needs a non-empty Question and Answer.');
  };
  for (const node of tree.children) {
    if (node.type === 'definition') continue;
    if (node.type === 'heading' && node.depth === 1) fail('Use ## Question and ## Answer below the set title.');
    const heading = node.type === 'heading' && node.depth === 2
      ? node.children.map(child => child.value ?? '').join('').trim().toLowerCase()
      : null;
    if (heading === 'question') {
      if (card) validate();
      card = { question: [], answer: [] };
      cards.push(card);
      side = 'question';
    } else if (heading === 'answer') {
      if (!card || side !== 'question') fail('Answer must follow Question.');
      side = 'answer';
    } else {
      if (!card) fail('Start each card with ## Question.');
      card[side].push(node);
    }
  }
  validate();

  function html(children) {
    const root = { type: 'root', children: structuredClone([...children, ...definitions]) };
    walk(root, node => {
      if (!['link', 'image', 'definition'].includes(node.type)) return;
      if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(node.url)) return;
      node.url = path.posix.join(path.posix.dirname(file), node.url);
    });
    return renderer.stringify(renderer.runSync(root));
  }
  return { title, cards: cards.map(card => ({ question: html(card.question), answer: html(card.answer) })) };
}

export function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
