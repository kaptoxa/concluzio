import { createFullDeck } from './deck';
import type { Card, PlaySessionState } from './types';

export const HAND_SIZE = 5;

export function shuffleDeck(deck: readonly Card[]): Card[] {
  const cards = [...deck];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = cards[i]!;
    cards[i] = cards[j]!;
    cards[j] = t;
  }
  return cards;
}

/** Тайная карта + 5 карт в руке; остальное — в доборе. */
export function createPlaySession(): PlaySessionState {
  const shuffled = shuffleDeck(createFullDeck());
  const secretCard = shuffled[0]!;
  const hand = shuffled.slice(1, 1 + HAND_SIZE);
  const drawPile = shuffled.slice(1 + HAND_SIZE);
  return {
    secretCard,
    hand,
    drawPile,
    matchPile: [],
    noMatchPile: [],
  };
}

/** Добирает карты с верха добора, пока в руке не станет HAND_SIZE или добор не кончится. */
export function refillHand(session: PlaySessionState): void {
  while (session.hand.length < HAND_SIZE && session.drawPile.length > 0) {
    session.hand.push(session.drawPile.shift()!);
  }
}
