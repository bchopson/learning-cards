import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

function element() {
  return {
    hidden: false,
    disabled: false,
    textContent: '',
    attributes: {},
    listeners: {},
    addEventListener(event, handler) { this.listeners[event] = handler; },
    setAttribute(name, value) { this.attributes[name] = value; },
    click() { if (!this.disabled) this.listeners.click(); },
  };
}

function makeSet(id) {
  const set = { ...element(), id };
  const heading = { focus() {} };
  const previous = element();
  const next = element();
  const progress = element();
  const cards = Array.from({ length: 2 }, () => {
    const audio = { currentTime: 4, paused: false, pause() { this.paused = true; } };
    const answer = { ...element(), querySelectorAll: () => [audio] };
    const reveal = { ...element(), nextElementSibling: answer };
    return { ...element(), audio, answer, reveal, querySelector: selector => selector === '.answer' ? answer : reveal };
  });
  set.querySelectorAll = selector => ({
    '.card': cards,
    '.reveal': cards.map(card => card.reveal),
    audio: cards.map(card => card.audio),
  })[selector];
  set.querySelector = selector => ({ '.previous': previous, '.next': next, '.progress': progress, h2: heading })[selector];
  return { set, cards, previous, next, progress };
}

test('study controls reveal/reset answers, navigate, and stop audio', async () => {
  const first = makeSet('set-0');
  const second = makeSet('set-1');
  const index = element();
  const location = { hash: '' };
  const window = element();
  const document = {
    querySelector: () => index,
    querySelectorAll: () => [first.set, second.set],
  };
  vm.runInNewContext(await readFile(new URL('../site/app.js', import.meta.url), 'utf8'), { document, location, window });
  assert.equal(index.hidden, false);
  assert.equal(first.set.hidden, true);

  location.hash = '#set-0';
  window.listeners.hashchange();
  assert.equal(index.hidden, true);
  assert.equal(first.set.hidden, false);
  assert.equal(first.progress.textContent, 'Card 1 of 2');
  assert.equal(first.previous.disabled, true);
  assert.equal(first.cards[0].answer.hidden, true);

  first.cards[0].reveal.click();
  assert.equal(first.cards[0].answer.hidden, false);
  assert.equal(first.cards[0].reveal.attributes['aria-expanded'], 'true');
  first.cards[0].reveal.click();
  assert.equal(first.cards[0].answer.hidden, true);
  assert.equal(first.cards[0].audio.paused, true);

  first.cards[0].reveal.click();
  first.next.click();
  assert.equal(first.progress.textContent, 'Card 2 of 2');
  assert.equal(first.next.disabled, true);
  assert.equal(first.cards[0].hidden, true);
  assert.equal(first.cards[1].hidden, false);
  assert.equal(first.cards[1].answer.hidden, true);
  first.previous.click();
  assert.equal(first.cards[0].answer.hidden, true);
  assert.equal(first.cards[0].reveal.textContent, 'Show answer');

  first.cards[0].audio.paused = false;
  location.hash = '#set-1';
  window.listeners.hashchange();
  assert.equal(first.set.hidden, true);
  assert.equal(second.set.hidden, false);
  assert.equal(first.cards[0].audio.paused, true);
  location.hash = '';
  window.listeners.hashchange();
  assert.equal(index.hidden, false);
  assert.equal(second.set.hidden, true);
});
