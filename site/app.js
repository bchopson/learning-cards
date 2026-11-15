const index = document.querySelector('#set-index');
const sets = [...document.querySelectorAll('.set')];

function stopAudio(container) {
  container.querySelectorAll('audio').forEach(audio => {
    audio.pause();
    audio.currentTime = 0;
  });
}

for (const set of sets) {
  const cards = [...set.querySelectorAll('.card')];
  const previous = set.querySelector('.previous');
  const next = set.querySelector('.next');
  let current = 0;

  function showCard(position) {
    stopAudio(set);
    current = position;
    cards.forEach((card, i) => {
      card.hidden = i !== current;
      card.querySelector('.answer').hidden = true;
      const reveal = card.querySelector('.reveal');
      reveal.textContent = 'Show answer';
      reveal.setAttribute('aria-expanded', 'false');
    });
    set.querySelector('.progress').textContent = `Card ${current + 1} of ${cards.length}`;
    previous.disabled = current === 0;
    next.disabled = current === cards.length - 1;
  }
  previous.addEventListener('click', () => showCard(current - 1));
  next.addEventListener('click', () => showCard(current + 1));
  set.querySelectorAll('.reveal').forEach(button => {
    button.addEventListener('click', () => {
      const answer = button.nextElementSibling;
      answer.hidden = !answer.hidden;
      button.textContent = answer.hidden ? 'Show answer' : 'Hide answer';
      button.setAttribute('aria-expanded', String(!answer.hidden));
      if (answer.hidden) stopAudio(answer);
    });
  });
  showCard(0);
}

function showSet() {
  const active = sets.find(set => `#${set.id}` === location.hash);
  index.hidden = Boolean(active);
  for (const set of sets) {
    stopAudio(set);
    set.hidden = set !== active;
  }
  if (active) active.querySelector('h2').focus();
}

window.addEventListener('hashchange', showSet);
showSet();
