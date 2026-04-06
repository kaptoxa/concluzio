import {
  CARD_COLORS,
  CARD_RANKS,
  cardSymbol,
  makeCard,
  symbolForColorAndRank,
  type Card,
  type Deck,
} from './types';

const EXPECTED_DECK_SIZE = CARD_COLORS.length * CARD_RANKS.length;

/** Все 49 карт: ровно по одной на каждую пару (цвет, номинал); символ согласован с цветом. */
export function createFullDeck(): Deck {
  const deck: Card[] = [];
  for (const color of CARD_COLORS) {
    for (const rank of CARD_RANKS) {
      deck.push(makeCard(color, rank));
    }
  }
  return deck;
}

/**
 * Полная колода: 49 карт, уникальные пары (цвет, номинал), и третий элемент кортежа
 * совпадает с `symbolForColorAndRank` для этой пары.
 */
export function isCompleteDeckUniqueByColorAndRank(deck: readonly Card[]): boolean {
  if (deck.length !== EXPECTED_DECK_SIZE) {
    return false;
  }
  const seen = new Set<string>();
  for (const c of deck) {
    if (cardSymbol(c) !== symbolForColorAndRank(c[0], c[1])) {
      return false;
    }
    const key = `${c[0]}:${c[1]}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
  }
  return seen.size === EXPECTED_DECK_SIZE;
}
