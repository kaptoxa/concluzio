import { createFullDeck } from './deck';
import type { GameState } from './types';

/**
 * Начальное состояние партии. Здесь же позже: раздача, перемешивание колоды,
 * сброс в исходное положение после конца раунда.
 */
export function createInitialGameState(): GameState {
  return {
    deck: createFullDeck(),
    player: {
      hand: [],
      cardToGuess: null,
    },
    table: {
      cards: [],
    },
  };
}
