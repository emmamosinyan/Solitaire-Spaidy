import { Node, Prefab, instantiate, Camera } from 'cc';
import { CardResourcesCatalog } from '../../card-resources-catalog';
import { Card } from './card';
import { CardSuit, CardRank } from './card-types';

/**
 * Фабрика для создания карт
 * Создает и инициализирует новые экземпляры карт
 */
export class CardFactory {
    private readonly cardPrefab: Prefab;
    private readonly resourcesCatalog: CardResourcesCatalog;
    private readonly camera: Camera;

    constructor(params: { 
        cardPrefab: Prefab; 
        resourcesCatalog: CardResourcesCatalog;
        camera: Camera;
    }) {
        this.cardPrefab = params.cardPrefab;
        this.resourcesCatalog = params.resourcesCatalog;
        this.camera = params.camera;
    }

    /**
     * Создает новую карту с заданными параметрами
     */
    public createCard(
        suit: CardSuit, 
        rank: CardRank, 
        revealed: boolean = false,
        parent?: Node
    ): Card | null {
        if (!this.cardPrefab || !this.resourcesCatalog) {
            console.error('CardFactory: cardPrefab или resourcesCatalog не назначены');
            return null;
        }

        // Создаем экземпляр из префаба
        const cardNode = instantiate(this.cardPrefab);
        
        if (!cardNode) {
            console.error('CardFactory: Не удалось создать экземпляр карты');
            return null;
        }

        // Получаем компонент Card
        const cardComponent = cardNode.getComponent(Card);
        if (!cardComponent) {
            console.error('CardFactory: Префаб не содержит компонент Card');
            cardNode.destroy();
            return null;
        }

        cardComponent.resourcesCatalog = this.resourcesCatalog;
        
        // Устанавливаем родительский узел, если указан
        if (parent) {
            cardNode.setParent(parent);
        }

        // Инициализируем карту
        cardComponent.initializeCard(suit, rank, this.camera, revealed);

        return cardComponent;
    }

    /**
     * Создает полную колоду из 52 карт
     */
    public createFullDeck(parent?: Node): Card[] {
        const deck: Card[] = [];
        const suits = [CardSuit.HEARTS, CardSuit.DIAMONDS, CardSuit.CLUBS, CardSuit.SPADES];
        const ranks = [
            CardRank.ACE, CardRank.TWO, CardRank.THREE, CardRank.FOUR,
            CardRank.FIVE, CardRank.SIX, CardRank.SEVEN, CardRank.EIGHT,
            CardRank.NINE, CardRank.TEN, CardRank.JACK, CardRank.QUEEN, CardRank.KING
        ];

        for (const suit of suits) {
            for (const rank of ranks) {
                const card = this.createCard(suit, rank, false, parent);
                if (card) {
                    deck.push(card);
                }
            }
        }

        return deck;
    }

    /**
     * Создает тестовую последовательность карт
     */
    public createTestSequence(count: number = 5, parent?: Node): Card[] {
        const cards: Card[] = [];
        const suits = [CardSuit.HEARTS, CardSuit.DIAMONDS, CardSuit.CLUBS, CardSuit.SPADES];
        const ranks = [
            CardRank.ACE, CardRank.TWO, CardRank.THREE, CardRank.FOUR,
            CardRank.FIVE, CardRank.SIX, CardRank.SEVEN, CardRank.EIGHT,
            CardRank.NINE, CardRank.TEN, CardRank.JACK, CardRank.QUEEN, CardRank.KING
        ];

        for (let i = 0; i < count && i < suits.length * ranks.length; i++) {
            const suit = suits[i % suits.length];
            const rank = ranks[Math.floor(i / suits.length) % ranks.length];
            
            const card = this.createCard(suit, rank, true, parent);
            if (card) {
                cards.push(card);
            }
        }

        return cards;
    }

    /**
     * Перемешивает массив карт (алгоритм Фишера-Йетса)
     */
    public shuffleDeck(deck: Card[]): Card[] {
        const shuffled = [...deck];
        
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        return shuffled;
    }

    /**
     * Создает перемешанную колоду
     */
    public createShuffledDeck(parent?: Node): Card[] {
        const deck = this.createFullDeck(parent);
        return this.shuffleDeck(deck);
    }

    /**
     * Проверяет готовность фабрики к работе
     */
    public isReady(): boolean {
        return !!(this.cardPrefab && this.resourcesCatalog);
    }
}
