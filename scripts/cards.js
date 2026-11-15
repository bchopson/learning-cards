import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeSanitize from 'rehype-sanitize';

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

const parser = unified().use(remarkParse);
const renderer = unified().use(remarkRehype).use(rehypeSanitize).use(media).use(rehypeStringify);

export function parseCards(markdown, file) {
  const tree = parser.parse(markdown);
  const cards = [];
  const definitions = tree.children.filter(node => node.type === 'definition');
  let card;
  let side;
  const fail = message => { throw new Error(`${file}: ${message}`); };
  const validate = () => {
    if (!card?.question.length || !card?.answer.length) fail('Each card needs a non-empty Question and Answer.');
  };
  for (const node of tree.children) {
    if (node.type === 'definition') continue;
    const heading = node.type === 'heading' && node.depth === 1
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
      if (!card) fail('Start each set with # Question.');
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
  return cards.map(card => ({ question: html(card.question), answer: html(card.answer) }));
}

export function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
