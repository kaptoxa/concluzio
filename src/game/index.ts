/**
 * Точка входа игровой логики: типы, состояние, правила.
 * Добавляйте модули вида `rules.ts` и реэкспортируйте отсюда.
 */

export { createFullDeck, isCompleteDeckUniqueByColorAndRank } from './deck';
export type {
  Card,
  CardColor,
  CardRank,
  CardSymbol,
  Deck,
  GameState,
  PlaySessionState,
  PlayerState,
  TableState,
} from './types';
export {
  CARD,
  CARD_COLORS,
  CARD_RANKS,
  COLOR_CROSS_ANCHOR_RANK,
  RANK_SYMBOLS,
  cardColor,
  cardRank,
  cardSymbol,
  cardsShareAnyAttribute,
  makeCard,
  symbolForColorAndRank,
} from './types';
export { createInitialGameState } from './state';
export {
  HAND_SIZE,
  createPlaySession,
  refillHand,
  shuffleDeck,
} from './playSession';
