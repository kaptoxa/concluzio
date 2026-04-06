/**
 * Доменная модель: 49 карт (7 цветов × номиналы 1–7).
 * Карта — кортеж `[цвет, номинал, символ]` (см. `CARD.color` / `CARD.rank` / `CARD.symbol`).
 *
 * В каждом цвете символы в порядке роста номинала: крест → круг → цветок → квадрат →
 * звезда → треугольник → ромб; у какого номинала начинается «крест», задаётся цветом
 * (`COLOR_CROSS_ANCHOR_RANK`). Дальше цикл по тем же семи символам.
 */

/** Цвет карты */
export const CARD_COLORS = [
  'red',
  'yellow',
  'orange',
  'purple',
  'green',
  'blue',
  'black',
] as const;

export type CardColor = (typeof CARD_COLORS)[number];

/** Номинал 1…7 */
export const CARD_RANKS = [1, 2, 3, 4, 5, 6, 7] as const;

export type CardRank = (typeof CARD_RANKS)[number];

/**
 * Символы в порядке увеличения номинала внутри цвета (после якорного номинала с крестом).
 */
export const RANK_SYMBOLS = [
  'cross', // крест
  'circle',
  'flower',
  'square',
  'star', // пятиконечная звезда
  'triangle',
  'diamond', // ромб
] as const;

export type CardSymbol = (typeof RANK_SYMBOLS)[number];

/**
 * Номинал, с которого в данном цвете начинается последовательность символов (крест).
 */
export const COLOR_CROSS_ANCHOR_RANK = {
  red: 1,
  yellow: 2,
  orange: 3,
  purple: 4,
  green: 5,
  blue: 7,
  black: 6,
} as const satisfies Record<CardColor, CardRank>;

/** Индексы полей в кортеже карты */
export const CARD = {
  color: 0,
  rank: 1,
  symbol: 2,
} as const;

export type Card = readonly [color: CardColor, rank: CardRank, symbol: CardSymbol];

export function symbolForColorAndRank(color: CardColor, rank: CardRank): CardSymbol {
  const anchor = COLOR_CROSS_ANCHOR_RANK[color];
  const i = (rank - anchor + 7) % 7;
  return RANK_SYMBOLS[i];
}

export function makeCard(color: CardColor, rank: CardRank): Card {
  return [color, rank, symbolForColorAndRank(color, rank)];
}

export function cardColor(c: Card): CardColor {
  return c[CARD.color];
}

export function cardRank(c: Card): CardRank {
  return c[CARD.rank];
}

export function cardSymbol(c: Card): CardSymbol {
  return c[CARD.symbol];
}

/** Колода: упорядоченный список карт (порядок «верха» колоды задаётся в логике). */
export type Deck = Card[];

export interface PlayerState {
  hand: Card[];
  /**
   * Карта, которую сейчас нужно угадать (или «тайная» карта раунда —
   * уточните смысл в правилах и переименуйте при необходимости).
   */
  cardToGuess: Card | null;
}

export interface TableState {
  cards: Card[];
}

export interface GameState {
  deck: Deck;
  player: PlayerState;
  table: TableState;
}

/** Одна игровая сессия: 5 карт в руке + тайная карта на всю сессию, добор из drawPile, две стопки. */
export interface PlaySessionState {
  hand: Card[];
  secretCard: Card;
  /** Остаток колоды после раздачи; сверху — `shift()`. */
  drawPile: Card[];
  matchPile: Card[];
  noMatchPile: Card[];
}

/** Есть ли общий признак: цвет, номинал или символ. */
export function cardsShareAnyAttribute(a: Card, b: Card): boolean {
  return (
    a[CARD.color] === b[CARD.color] ||
    a[CARD.rank] === b[CARD.rank] ||
    a[CARD.symbol] === b[CARD.symbol]
  );
}
