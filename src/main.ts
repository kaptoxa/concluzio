import './style.css';
import {
  CARD_COLORS,
  CARD_RANKS,
  RANK_SYMBOLS,
  createInitialGameState,
  createPlaySession,
  cardColor,
  cardRank,
  cardSymbol,
  cardsShareAnyAttribute,
  refillHand,
  type Card,
  type CardColor,
  type CardRank,
  type CardSymbol,
  type PlaySessionState,
} from './game';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('#app not found');
}

type PileKind = 'match' | 'nomatch';

let playSession: PlaySessionState | null = null;

/** Для dragover: getData часто пуст, храним источник до dragend. */
let pileDragSource: { kind: PileKind; from: number } | null = null;

let guessOverlayOpen = false;
type GuessPhase = 'pick' | 'result';
let guessPhase: GuessPhase = 'pick';
let guessSelection: {
  color: CardColor | null;
  rank: CardRank | null;
  symbol: CardSymbol | null;
} = { color: null, rank: null, symbol: null };

let guessLastWin = false;

const game = createInitialGameState();

/** Цвета рубашки/акцента для CSS-модификаторов */
const CARD_COLOR_STYLE: Record<
  CardColor,
  { classSuffix: string; label: string }
> = {
  red: { classSuffix: 'red', label: 'красный' },
  yellow: { classSuffix: 'yellow', label: 'жёлтый' },
  orange: { classSuffix: 'orange', label: 'оранжевый' },
  purple: { classSuffix: 'purple', label: 'фиолетовый' },
  green: { classSuffix: 'green', label: 'зелёный' },
  blue: { classSuffix: 'blue', label: 'синий' },
  black: { classSuffix: 'black', label: 'чёрный' },
};

const SYMBOL_GLYPH: Record<CardSymbol, string> = {
  cross: '✕',
  circle: '○',
  flower: '✿',
  square: '□',
  star: '★',
  triangle: '△',
  diamond: '◇',
};

const SYMBOL_LABEL_RU: Record<CardSymbol, string> = {
  cross: 'крест',
  circle: 'круг',
  flower: 'цветок',
  square: 'квадрат',
  star: 'звезда',
  triangle: 'треугольник',
  diamond: 'ромб',
};

const PILE_DND_MIME = 'application/x-concluzio-pile';
const PILE_DND_TEXT_PREFIX = '__cz_pile__:';

type CardViewOpts =
  | { handIndex: number }
  | { pileKind: PileKind; pileIndex: number };

function renderCard(card: Card, options?: CardViewOpts): HTMLDivElement {
  const color = cardColor(card);
  const rank = cardRank(card);
  const symbol = cardSymbol(card);
  const style = CARD_COLOR_STYLE[color];

  const el = document.createElement('div');
  el.className = `deck-card deck-card--${style.classSuffix}`;
  if (options && 'handIndex' in options) {
    el.classList.add('deck-card--hand');
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.setAttribute(
      'aria-label',
      `Карта ${rank}, ${SYMBOL_LABEL_RU[symbol]} — нажмите, чтобы сделать ход`,
    );
  } else if (options && 'pileKind' in options) {
    el.classList.add('deck-card--in-pile');
    el.draggable = true;
    el.dataset.pileKind = options.pileKind;
    el.dataset.pileCardIndex = String(options.pileIndex);
    el.setAttribute(
      'aria-label',
      `Карта ${rank} в стопке — перетащите, чтобы изменить порядок`,
    );
  }
  el.setAttribute(
    'title',
    `${style.label}, ${rank}, ${SYMBOL_LABEL_RU[symbol]}`,
  );

  const corner = document.createElement('div');
  corner.className = 'deck-card__corner';

  const rankEl = document.createElement('span');
  rankEl.className = 'deck-card__rank';
  rankEl.textContent = String(rank);

  const symEl = document.createElement('span');
  symEl.className = 'deck-card__symbol';
  symEl.textContent = SYMBOL_GLYPH[symbol];
  symEl.setAttribute('aria-hidden', 'true');

  corner.append(rankEl, symEl);
  el.appendChild(corner);
  return el;
}

function renderCardBack(options?: { openGuess?: boolean }): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'deck-card deck-card--back';
  if (options?.openGuess) {
    el.classList.add('deck-card--back-guess');
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.setAttribute(
      'title',
      'Сформулировать гипотезу о скрытой карте (цвет, номинал, символ)',
    );
    el.setAttribute(
      'aria-label',
      'Открыть панель гипотезы о скрытой карте',
    );
    const open = () => {
      guessOverlayOpen = true;
      guessPhase = 'pick';
      guessSelection = { color: null, rank: null, symbol: null };
      guessLastWin = false;
      render();
    };
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  } else {
    el.setAttribute('title', 'Угадываемая карта (скрыта)');
  }
  const label = document.createElement('span');
  label.className = 'deck-card__back-label';
  label.textContent = 'conluzio';
  el.appendChild(label);
  return el;
}

function renderDeckInto(container: HTMLElement, cards: readonly Card[]): void {
  container.replaceChildren();
  const frag = document.createDocumentFragment();
  for (const card of cards) {
    frag.appendChild(renderCard(card));
  }
  container.appendChild(frag);
}

function pileRef(kind: PileKind): Card[] | null {
  if (!playSession) {
    return null;
  }
  return kind === 'match' ? playSession.matchPile : playSession.noMatchPile;
}

/** Переставить карту с индекса `from` так, чтобы она оказалась перед бывшей позицией `to` (или в конец при `to === length`). */
function reorderPileCards(pile: Card[], from: number, to: number): void {
  const n = pile.length;
  if (from < 0 || from >= n || to < 0 || to > n) {
    return;
  }
  if (from === to) {
    return;
  }
  const [c] = pile.splice(from, 1);
  const insertAt = from < to ? to - 1 : to;
  pile.splice(insertAt, 0, c);
}

function parsePileDragPayload(e: DragEvent): { pile: PileKind; from: number } | null {
  const dt = e.dataTransfer;
  const raw =
    dt?.getData(PILE_DND_MIME) ||
    (() => {
      const t = dt?.getData('text/plain');
      return t?.startsWith(PILE_DND_TEXT_PREFIX) ? t.slice(PILE_DND_TEXT_PREFIX.length) : '';
    })();
  if (!raw) {
    return null;
  }
  try {
    const o = JSON.parse(raw) as { pile?: string; from?: number };
    if ((o.pile !== 'match' && o.pile !== 'nomatch') || typeof o.from !== 'number') {
      return null;
    }
    return { pile: o.pile, from: o.from };
  } catch {
    return null;
  }
}

function clearPileDropHighlights(container: HTMLElement): void {
  container.querySelectorAll('.pile-card--drop-target').forEach((n) => {
    n.classList.remove('pile-card--drop-target');
  });
}

function wirePileReorder(container: HTMLElement, kind: PileKind): void {
  container.addEventListener('dragover', (e) => {
    if (!pileDragSource || pileDragSource.kind !== kind) {
      return;
    }
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';

    clearPileDropHighlights(container);
    const cardEl = (e.target as HTMLElement | null)?.closest<HTMLElement>(
      '[data-pile-card-index]',
    );
    if (cardEl && container.contains(cardEl)) {
      cardEl.classList.add('pile-card--drop-target');
    }
  });

  container.addEventListener('dragleave', (e) => {
    if (!container.contains(e.relatedTarget as Node)) {
      clearPileDropHighlights(container);
    }
  });

  container.addEventListener('drop', (e) => {
    const parsed = parsePileDragPayload(e);
    if (!parsed) {
      return;
    }
    e.preventDefault();
    clearPileDropHighlights(container);

    if (parsed.pile !== kind) {
      return;
    }

    const pile = pileRef(kind);
    if (!pile) {
      return;
    }

    const from = parsed.from;
    const cardEl = (e.target as HTMLElement | null)?.closest<HTMLElement>(
      '[data-pile-card-index]',
    );
    if (cardEl && container.contains(cardEl)) {
      const to = Number(cardEl.dataset.pileCardIndex);
      if (Number.isNaN(to)) {
        return;
      }
      reorderPileCards(pile, from, to);
    } else {
      reorderPileCards(pile, from, pile.length);
    }
    render();
  });
}

function renderInteractivePile(
  container: HTMLElement,
  cards: readonly Card[],
  kind: PileKind,
): void {
  container.replaceChildren();
  const frag = document.createDocumentFragment();
  cards.forEach((card, index) => {
    const el = renderCard(card, { pileKind: kind, pileIndex: index });
    el.addEventListener('dragstart', (e) => {
      pileDragSource = { kind, from: index };
      const payload = JSON.stringify({ pile: kind, from: index });
      e.dataTransfer?.setData(PILE_DND_MIME, payload);
      e.dataTransfer?.setData('text/plain', PILE_DND_TEXT_PREFIX + payload);
      e.dataTransfer!.effectAllowed = 'move';
      el.classList.add('deck-card--dragging');
    });
    el.addEventListener('dragend', () => {
      pileDragSource = null;
      el.classList.remove('deck-card--dragging');
      clearPileDropHighlights(container);
    });
    frag.appendChild(el);
  });
  container.appendChild(frag);
  wirePileReorder(container, kind);
}

function getRoute(): 'start' | 'game' {
  const h = window.location.hash.replace(/^#/, '');
  return h === '/game' || h === 'game' ? 'game' : 'start';
}

function closeGuessOverlay(): void {
  guessOverlayOpen = false;
  guessPhase = 'pick';
  guessSelection = { color: null, rank: null, symbol: null };
  guessLastWin = false;
  render();
}

function guessMatchesSecret(
  color: CardColor,
  rank: CardRank,
  symbol: CardSymbol,
  secret: Card,
): boolean {
  return (
    color === cardColor(secret) &&
    rank === cardRank(secret) &&
    symbol === cardSymbol(secret)
  );
}

function guessPickComplete(): boolean {
  return (
    guessSelection.color !== null &&
    guessSelection.rank !== null &&
    guessSelection.symbol !== null
  );
}

function chipSelectedClass(
  current: string | number | null,
  value: string | number,
): string {
  return current !== null && current === value ? ' guess-chip--selected' : '';
}

function buildGuessColorChips(colors: readonly CardColor[]): string {
  return colors
    .map((c) => {
      const st = CARD_COLOR_STYLE[c];
      return `<button type="button" class="guess-chip guess-chip--sm guess-chip--color-only guess-chip--${st.classSuffix}${chipSelectedClass(guessSelection.color, c)}" data-guess-color="${c}" aria-pressed="${guessSelection.color === c}" aria-label="${st.label}"></button>`;
    })
    .join('');
}

function buildGuessRankChips(ranks: readonly CardRank[]): string {
  return ranks
    .map(
      (r) =>
        `<button type="button" class="guess-chip guess-chip--sm guess-chip--rank${chipSelectedClass(guessSelection.rank, r)}" data-guess-rank="${r}" aria-pressed="${guessSelection.rank === r}">${r}</button>`,
    )
    .join('');
}

function buildGuessSymbolChips(symbols: readonly CardSymbol[]): string {
  return symbols
    .map((s) => {
      const g = SYMBOL_GLYPH[s];
      const short = SYMBOL_LABEL_RU[s];
      return `<button type="button" class="guess-chip guess-chip--sm guess-chip--symbol${chipSelectedClass(guessSelection.symbol, s)}" data-guess-symbol="${s}" aria-pressed="${guessSelection.symbol === s}" title="${short}"><span class="guess-chip__glyph" aria-hidden="true">${g}</span><span class="guess-chip__sym-label">${short}</span></button>`;
    })
    .join('');
}

function buildGuessOverlayPickHtml(): string {
  const colors4 = CARD_COLORS.slice(0, 4);
  const colors3 = CARD_COLORS.slice(4, 7);
  const ranks4 = CARD_RANKS.slice(0, 4);
  const ranks3 = CARD_RANKS.slice(4, 7);
  const sym4 = RANK_SYMBOLS.slice(0, 4);
  const sym3 = RANK_SYMBOLS.slice(4, 7);
  const canSubmit = guessPickComplete();

  return `
  <div class="guess-overlay__panel" role="dialog" aria-modal="true" aria-labelledby="guess-overlay-title">
    <button type="button" class="guess-overlay__close" id="guess-overlay-close" aria-label="Закрыть">×</button>
    <h2 id="guess-overlay-title" class="guess-overlay__title">Гипотеза</h2>
    <p class="guess-overlay__hint">
      Соберите гипотезу: цвет (плашки без подписей), номинал и символ. Допустимо любое сочетание — в том числе отсутствующее в колоде.
      Победа только если все три признака совпадут со скрытой картой.
    </p>
    <div class="guess-columns" role="group" aria-label="Три признака карты">
      <div class="guess-col">
        <span class="guess-col__label">Цвет</span>
        <div class="guess-col__row guess-col__row--4">${buildGuessColorChips(colors4)}</div>
        <div class="guess-col__row guess-col__row--3">${buildGuessColorChips(colors3)}</div>
      </div>
      <div class="guess-col">
        <span class="guess-col__label">Номинал</span>
        <div class="guess-col__row guess-col__row--4">${buildGuessRankChips(ranks4)}</div>
        <div class="guess-col__row guess-col__row--3">${buildGuessRankChips(ranks3)}</div>
      </div>
      <div class="guess-col">
        <span class="guess-col__label">Символ</span>
        <div class="guess-col__row guess-col__row--4">${buildGuessSymbolChips(sym4)}</div>
        <div class="guess-col__row guess-col__row--3">${buildGuessSymbolChips(sym3)}</div>
      </div>
    </div>
    <div class="guess-overlay__actions">
      <button type="button" class="btn btn--primary" id="guess-submit" ${canSubmit ? '' : 'disabled'}>
        ${canSubmit ? 'Проверить гипотезу' : 'Выберите цвет, номинал и символ'}
      </button>
      <button type="button" class="btn btn--ghost" id="guess-cancel">Отмена</button>
    </div>
  </div>
`;
}

function buildGuessOverlayResultHtml(win: boolean): string {
  if (win) {
    return `
  <div class="guess-overlay__panel guess-overlay__panel--result" role="dialog" aria-modal="true">
    <h2 class="guess-overlay__title">Вы угадали</h2>
    <p class="guess-overlay__result-text">Поздравляем! Скрытая карта совпала с вашей гипотезой.</p>
    <div class="guess-overlay__actions guess-overlay__actions--stack">
      <button type="button" class="btn btn--primary" id="guess-result-new">Новая игра</button>
      <button type="button" class="btn btn--ghost" id="guess-result-close">Закрыть</button>
      <a href="#/" class="link-back" id="guess-result-home">На главную</a>
    </div>
  </div>`;
  }
  return `
  <div class="guess-overlay__panel guess-overlay__panel--result" role="dialog" aria-modal="true">
    <h2 class="guess-overlay__title">Почти</h2>
    <p class="guess-overlay__result-text">Это было не то. Удачи в следующей игре!</p>
    <div class="guess-overlay__actions guess-overlay__actions--stack">
      <button type="button" class="btn btn--primary" id="guess-result-new">Новая игра</button>
      <button type="button" class="btn btn--ghost" id="guess-result-close">Закрыть</button>
      <a href="#/" class="link-back" id="guess-result-home">На главную</a>
    </div>
  </div>`;
}

function wireGuessOverlay(root: HTMLElement): void {
  if (guessPhase === 'pick') {
    root.querySelectorAll<HTMLButtonElement>('[data-guess-color]').forEach((btn) => {
      btn.addEventListener('click', () => {
        guessSelection.color = btn.dataset.guessColor as CardColor;
        render();
      });
    });
    root.querySelectorAll<HTMLButtonElement>('[data-guess-rank]').forEach((btn) => {
      btn.addEventListener('click', () => {
        guessSelection.rank = Number(btn.dataset.guessRank) as CardRank;
        render();
      });
    });
    root.querySelectorAll<HTMLButtonElement>('[data-guess-symbol]').forEach((btn) => {
      btn.addEventListener('click', () => {
        guessSelection.symbol = btn.dataset.guessSymbol as CardSymbol;
        render();
      });
    });
    root.querySelector('#guess-submit')?.addEventListener('click', () => {
      if (!playSession || !guessPickComplete()) {
        return;
      }
      const win = guessMatchesSecret(
        guessSelection.color!,
        guessSelection.rank!,
        guessSelection.symbol!,
        playSession.secretCard,
      );
      guessPhase = 'result';
      guessOverlayOpen = true;
      guessLastWin = win;
      render();
    });
    root.querySelector('#guess-cancel')?.addEventListener('click', closeGuessOverlay);
    root.querySelector('#guess-overlay-close')?.addEventListener('click', closeGuessOverlay);
  } else {
    root.querySelector('#guess-result-new')?.addEventListener('click', () => {
      playSession = createPlaySession();
      closeGuessOverlay();
    });
    root.querySelector('#guess-result-close')?.addEventListener('click', closeGuessOverlay);
    root.querySelector('#guess-result-home')?.addEventListener('click', (e) => {
      e.preventDefault();
      closeGuessOverlay();
      window.location.hash = '#/';
    });
  }
}

function buildGuessOverlayInnerHtml(): string {
  if (guessPhase === 'result') {
    return buildGuessOverlayResultHtml(guessLastWin);
  }
  return buildGuessOverlayPickHtml();
}

function playCardToPile(index: number, target: PileKind): void {
  if (!playSession) {
    return;
  }
  const card = playSession.hand[index];
  if (!card) {
    return;
  }
  const matches = cardsShareAnyAttribute(card, playSession.secretCard);
  if (target === 'match' && !matches) {
    return;
  }
  if (target === 'nomatch' && matches) {
    return;
  }
  playSession.hand.splice(index, 1);
  if (matches) {
    playSession.matchPile.push(card);
  } else {
    playSession.noMatchPile.push(card);
  }
  refillHand(playSession);
  render();
}

/** Клик / Enter / Space: карта уходит в правильную стопку по правилу игры. */
function playCardFromHandByClick(index: number): void {
  if (!playSession) {
    return;
  }
  const card = playSession.hand[index];
  if (!card) {
    return;
  }
  const target = cardsShareAnyAttribute(card, playSession.secretCard)
    ? 'match'
    : 'nomatch';
  playCardToPile(index, target);
}

function bindHandCardInteractions(el: HTMLDivElement, index: number): void {
  el.addEventListener('click', () => {
    playCardFromHandByClick(index);
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      playCardFromHandByClick(index);
    }
  });
}

function renderStart(): void {
  app!.innerHTML = `
  <main class="page page--start">
    <header class="start-header">
      <h1 class="title">Concluzio</h1>
      <p class="hint" id="hint"></p>
      <p class="start-actions">
        <button type="button" class="btn btn--primary" id="btn-start-game">Начать игру</button>
      </p>
    </header>
    <section class="deck-section" aria-label="Полная колода">
      <h2 class="deck-heading">Колода</h2>
      <div class="deck-grid" id="deck-grid"></div>
    </section>
  </main>
`;

  const hint = document.querySelector<HTMLParagraphElement>('#hint');
  if (hint) {
    hint.textContent = `Всего карт: ${game.deck.length} · в руке: ${game.player.hand.length} · на столе: ${game.table.cards.length}`;
  }

  const btn = document.querySelector<HTMLButtonElement>('#btn-start-game');
  btn?.addEventListener('click', () => {
    playSession = createPlaySession();
    window.location.hash = '#/game';
  });

  const deckGrid = document.querySelector<HTMLDivElement>('#deck-grid');
  if (!deckGrid) {
    throw new Error('#deck-grid not found');
  }
  const deckOrdered = [...game.deck].sort((a, b) => {
    const ci = CARD_COLORS.indexOf(cardColor(a)) - CARD_COLORS.indexOf(cardColor(b));
    if (ci !== 0) {
      return ci;
    }
    return cardRank(a) - cardRank(b);
  });
  renderDeckInto(deckGrid, deckOrdered);
}

function renderGame(): void {
  if (!playSession) {
    playSession = createPlaySession();
  }
  const s = playSession;

  const overlayBlock = guessOverlayOpen
    ? `<div class="guess-overlay" id="guess-overlay">${buildGuessOverlayInnerHtml()}</div>`
    : '';

  app!.innerHTML = `
  <main class="page page--game">
    <header class="game-header">
      <h1 class="title title--game">Игра</h1>
      <p class="game-hint">
        Нажмите на карту в руке — она уйдёт в нужную стопку автоматически. Карты внутри каждой стопки можно перетаскивать, чтобы менять порядок. После хода из добора берётся карта, пока в руке снова не станет пяти — пока не кончится колода. Гипотеза о скрытой карте: нажмите на рубашку справа в руке — откроется панель поверх руки и стопок.
      </p>
      <p class="game-nav">
        <a href="#/" class="link-back">← К колоде</a>
      </p>
    </header>
    <div class="game-play-wrap">
      <div class="game-play-area" id="game-play-area">
        <section class="game-hand-section" aria-label="Рука и угадываемая карта">
          <h2 class="game-subheading">Рука</h2>
          <div class="hand-row" id="hand-row" role="group" aria-label="Пять карт в руке и угадываемая карта"></div>
        </section>
        <section class="game-piles-section" aria-label="Стопки после ходов">
          <div class="piles">
            <div class="pile pile--match">
              <h3 class="pile__title">Общий признак с угадываемой</h3>
              <div class="pile__cards" id="pile-match"></div>
            </div>
            <div class="pile pile--nomatch">
              <h3 class="pile__title">Нет общих признаков</h3>
              <div class="pile__cards" id="pile-nomatch"></div>
            </div>
          </div>
        </section>
      </div>
      ${overlayBlock}
    </div>
  </main>
`;

  const handRow = document.querySelector<HTMLDivElement>('#hand-row');
  const pileMatch = document.querySelector<HTMLDivElement>('#pile-match');
  const pileNomatch = document.querySelector<HTMLDivElement>('#pile-nomatch');
  if (!handRow || !pileMatch || !pileNomatch) {
    throw new Error('game DOM missing');
  }

  handRow.replaceChildren();
  s.hand.forEach((card, index) => {
    const el = renderCard(card, { handIndex: index });
    bindHandCardInteractions(el, index);
    handRow.appendChild(el);
  });
  handRow.appendChild(renderCardBack({ openGuess: true }));

  renderInteractivePile(pileMatch, s.matchPile, 'match');
  renderInteractivePile(pileNomatch, s.noMatchPile, 'nomatch');

  if (guessOverlayOpen) {
    const overlayRoot = document.getElementById('guess-overlay');
    if (overlayRoot) {
      wireGuessOverlay(overlayRoot);
    }
  }
}

function absorbGuessHash(): void {
  const h = window.location.hash.replace(/^#/, '');
  if (h === '/guess' || h === 'guess') {
    guessOverlayOpen = true;
    guessPhase = 'pick';
    guessSelection = { color: null, rank: null, symbol: null };
    guessLastWin = false;
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}#/game`,
    );
  }
}

function render(): void {
  absorbGuessHash();
  const route = getRoute();
  if (route === 'game') {
    renderGame();
  } else {
    renderStart();
  }
}

window.addEventListener('hashchange', () => render());
render();
