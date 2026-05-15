import { Enum } from 'cc';

/**
 * Типы карт для игры Solitaire
 * Определяет базовые типы для мастей, рангов и стопок карт
 */

// Масти карт
export enum CardSuit {
    HEARTS = 0,
    DIAMONDS = 1, 
    CLUBS = 2,
    SPADES = 3
}

// Регистрируем enum для инспектора Cocos Creator
Enum(CardSuit);

// Ранги карт
export enum CardRank {
    ACE = 0,
    TWO = 1,
    THREE = 2,
    FOUR = 3,
    FIVE = 4,
    SIX = 5,
    SEVEN = 6,
    EIGHT = 7,
    NINE = 8,
    TEN = 9,
    JACK = 10,
    QUEEN = 11,
    KING = 12
}

// Регистрируем enum для инспектора Cocos Creator
Enum(CardRank);

// Типы стопок карт
export enum StackType {
    TABLEAU = 0,     // Игровое поле (7 колонок)
    FOUNDATION = 1,  // Целевые стопки (4 масти)
    STOCK = 2,       // Колода (закрытые карты)
    WASTE = 3        // Отбой (открытые карты из колоды)
}

// Регистрируем enum для инспектора Cocos Creator
Enum(StackType);

// Интерфейс карты
export interface ICard {
    suit: CardSuit;
    rank: CardRank;
    isRevealed: boolean;
    isMovable: boolean;
}

// Цвета карт для валидации
export enum CardColor {
    RED = 0,
    BLACK = 1
}

// Регистрируем enum для инспектора Cocos Creator
Enum(CardColor);

// Строковые представления мастей
export const SUIT_STRINGS: Record<CardSuit, string> = {
    [CardSuit.HEARTS]: 'hearts',
    [CardSuit.DIAMONDS]: 'diamonds',
    [CardSuit.CLUBS]: 'clubs',
    [CardSuit.SPADES]: 'spades'
};

// Строковые представления рангов
export const RANK_STRINGS: Record<CardRank, string> = {
    [CardRank.ACE]: 'A',
    [CardRank.TWO]: '2',
    [CardRank.THREE]: '3',
    [CardRank.FOUR]: '4',
    [CardRank.FIVE]: '5',
    [CardRank.SIX]: '6',
    [CardRank.SEVEN]: '7',
    [CardRank.EIGHT]: '8',
    [CardRank.NINE]: '9',
    [CardRank.TEN]: '10',
    [CardRank.JACK]: 'J',
    [CardRank.QUEEN]: 'Q',
    [CardRank.KING]: 'K'
};

// Числовые значения рангов для сравнения
export const RANK_VALUES: Record<CardRank, number> = {
    [CardRank.ACE]: 1,
    [CardRank.TWO]: 2,
    [CardRank.THREE]: 3,
    [CardRank.FOUR]: 4,
    [CardRank.FIVE]: 5,
    [CardRank.SIX]: 6,
    [CardRank.SEVEN]: 7,
    [CardRank.EIGHT]: 8,
    [CardRank.NINE]: 9,
    [CardRank.TEN]: 10,
    [CardRank.JACK]: 11,
    [CardRank.QUEEN]: 12,
    [CardRank.KING]: 13
};

// Соответствие мастей цветам
export const SUIT_COLORS: Record<CardSuit, CardColor> = {
    [CardSuit.HEARTS]: CardColor.RED,
    [CardSuit.DIAMONDS]: CardColor.RED,
    [CardSuit.CLUBS]: CardColor.BLACK,
    [CardSuit.SPADES]: CardColor.BLACK
};

// Строковые представления типов стопок
export const STACK_TYPE_STRINGS: Record<StackType, string> = {
    [StackType.TABLEAU]: 'tableau',
    [StackType.FOUNDATION]: 'foundation', 
    [StackType.STOCK]: 'stock',
    [StackType.WASTE]: 'waste'
};

// Вспомогательные функции
export class CardUtils {
    /**
     * Возвращает цвет карты по масти
     */
    static getCardColor(suit: CardSuit): CardColor {
        return SUIT_COLORS[suit];
    }

    /**
     * Возвращает числовое значение ранга
     */
    static getRankValue(rank: CardRank): number {
        return RANK_VALUES[rank];
    }

    /**
     * Проверяет, являются ли цвета карт разными
     */
    static isDifferentColor(suit1: CardSuit, suit2: CardSuit): boolean {
        return CardUtils.getCardColor(suit1) !== CardUtils.getCardColor(suit2);
    }

    /**
     * Проверяет, можно ли поставить карту на другую в tableau (убывание + опционально разные цвета)
     * @param requireAlternatingColors - требовать ли чередование цветов (по умолчанию true)
     */
    static canPlaceOnTableau(
        cardRank: CardRank,
        cardSuit: CardSuit,
        targetRank: CardRank,
        targetSuit: CardSuit,
        requireAlternatingColors: boolean = true
    ): boolean {
        const cardValue = CardUtils.getRankValue(cardRank);
        const targetValue = CardUtils.getRankValue(targetRank);
        
        // Проверяем убывание рангов (целевая карта должна быть на 1 больше)
        const rankValid = targetValue - cardValue === 1;
        
        // Если требуется чередование цветов, проверяем цвета
        if (requireAlternatingColors) {
            return rankValid && CardUtils.isDifferentColor(cardSuit, targetSuit);
        }
        
        // Если чередование не требуется, достаточно только проверки рангов
        return rankValid;
    }

    /**
     * Проверяет, можно ли поставить карту в foundation (возрастание + одна масть)
     */
    static canPlaceOnFoundation(cardRank: CardRank, cardSuit: CardSuit, targetRank: CardRank | null, targetSuit: CardSuit): boolean {
        if (targetRank === null) {
            // Пустая foundation - можно поставить только туз
            return cardRank === CardRank.ACE && cardSuit === targetSuit;
        }

        const cardValue = CardUtils.getRankValue(cardRank);
        const targetValue = CardUtils.getRankValue(targetRank);
        
        return (cardValue - targetValue === 1) && cardSuit === targetSuit;
    }

    /**
     * Получает строковое представление масти
     */
    static getSuitString(suit: CardSuit): string {
        return SUIT_STRINGS[suit];
    }

    /**
     * Получает строковое представление ранга
     */
    static getRankString(rank: CardRank): string {
        return RANK_STRINGS[rank];
    }

    /**
     * Получает строковое представление типа стопки
     */
    static getStackTypeString(stackType: StackType): string {
        return STACK_TYPE_STRINGS[stackType];
    }
}
