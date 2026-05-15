import { IEventBus } from 'db://assets/scripts/common/event-bus';
import { CardFactory } from '../card-system/card-factory';
import { CardStack } from '../card-system/card-stack';
import { Card } from '../card-system/card';
import { MoveValidator } from '../solitaire-rules/move-validator';
import { StackType, CardSuit, CardRank } from '../card-system/card-types';
import { GameConfigData } from './game-config';
import {
    EVT_GAME_INITIALIZED,
    EVT_GAME_STATE_CHANGED,
    EVT_CARDS_DEALT,
    EVT_GAME_WON,
    EVT_PLAY_SOUND,
    SOUND_CARD_DEAL
} from 'db://assets/scripts/common/events';

/**
 * Состояния игры
 */
export enum GameState {
    INITIALIZING = 'initializing',
    READY = 'ready',
    PLAYING = 'playing',
    WON = 'won',
    PAUSED = 'paused'
}

/**
 * Интерфейс для стопок игрового поля
 */
export interface GameStacks {
    stock: CardStack;           // Колода (закрытые карты)
    waste: CardStack;           // Отбой (открытые карты из колоды)  
    foundations: CardStack[];   // Целевые стопки (4 масти)
    tableau: CardStack[];       // Игровое поле (7 колонок)
}

/**
 * Центральный оркестратор игрового цикла
 * Управляет инициализацией, раздачей карт и состоянием игры
 */
export class GameLoopOrchestrator {
    private readonly bus: IEventBus;
    private readonly cardFactory: CardFactory;
    private readonly moveValidator: MoveValidator;
    private readonly stacks: GameStacks;
    private readonly gameConfig: GameConfigData;
    
    private currentState: GameState = GameState.INITIALIZING;
    private fullDeck: Card[] = [];

    constructor(params: {
        bus: IEventBus;
        cardFactory: CardFactory;
        moveValidator: MoveValidator;
        stacks: GameStacks;
        config: GameConfigData;
    }) {
        this.bus = params.bus;
        this.cardFactory = params.cardFactory;
        this.moveValidator = params.moveValidator;
        this.stacks = params.stacks;
        this.gameConfig = params.config;
    }

    /**
     * Запускает игровую систему
     */
    public start(): void {
        console.log('GameLoopOrchestrator: Запуск инициализации игры...');
        this.initializeGame();
    }

    /**
     * Останавливает игровую систему
     */
    public stop(): void {
        console.log('GameLoopOrchestrator: Остановка игры...');
        this.changeState(GameState.PAUSED);
    }

    /**
     * Возвращает текущее состояние игры
     */
    public getCurrentState(): GameState {
        return this.currentState;
    }

    /**
     * Возвращает игровые стопки
     */
    public getStacks(): GameStacks {
        return this.stacks;
    }

    /**
     * Инициализирует новую игру
     */
    private initializeGame(): void {
        this.changeState(GameState.INITIALIZING);
        
        try {
            // 1. Очищаем все стопки
            this.clearAllStacks();
            
            // 2. Настраиваем правила для tableau стопок
            this.configureTableauStacks();
            
            // 3. Создаем новую колоду
            this.createNewDeck();
            
            // 4. Раздаем карты по правилам солитера
            this.dealCards();
            
            // 5. Переводим в состояние готовности
            this.changeState(GameState.READY);
            
            // 6. Публикуем событие завершения инициализации
            this.bus.publish({
                type: EVT_GAME_INITIALIZED,
                stacks: this.stacks,
                deckSize: this.fullDeck.length
            });

            console.log('GameLoopOrchestrator: Игра инициализирована успешно');
            
            // 7. Начинаем игру
            this.startPlaying();
            
        } catch (error) {
            console.error('GameLoopOrchestrator: Ошибка при инициализации игры:', error);
        }
    }

    /**
     * Настраивает правила для tableau стопок
     */
    private configureTableauStacks(): void {
        for (const tableauStack of this.stacks.tableau) {
            tableauStack.setRequireAlternatingColors(this.gameConfig.requireAlternatingColors);
        }
        console.log(`GameLoopOrchestrator: Tableau стопки настроены (requireAlternatingColors: ${this.gameConfig.requireAlternatingColors})`);
    }

    /**
     * Переводит игру в состояние "играем"
     */
    private startPlaying(): void {
        this.changeState(GameState.PLAYING);
        console.log('GameLoopOrchestrator: Игра началась!');
    }

    /**
     * Создает новую перемешанную колоду из 52 карт
     */
    private createNewDeck(): void {
        if (this.gameConfig.shuffleDeck) {
            this.fullDeck = this.cardFactory.createShuffledDeck();
        } else {
            this.fullDeck = this.cardFactory.createFullDeck();
        }
        
        if (this.fullDeck.length !== 52) {
            throw new Error(`Некорректный размер колоды: ${this.fullDeck.length}, ожидалось: 52`);
        }
    }

    /**
     * Раздает карты согласно правилам солитера
     */
    private dealCards(): void {
        console.log('GameLoopOrchestrator: Начинаем раздачу карт...');
        
        let deckIndex = 0;
        
        // 1. Раздаем карты в tableau стопки
        for (let stackIndex = 0; stackIndex < this.stacks.tableau.length; stackIndex++) {
            const cardsInStack = this.gameConfig.tableauLayout[stackIndex];
            const tableauStack = this.stacks.tableau[stackIndex];
            
            for (let cardIndex = 0; cardIndex < cardsInStack; cardIndex++) {
                if (deckIndex >= this.fullDeck.length) {
                    throw new Error('Недостаточно карт в колоде для раздачи');
                }
                
                const card = this.fullDeck[deckIndex++];
                const isTopCard = cardIndex === cardsInStack - 1;
                
                // Верхняя карта открыта, остальные закрыты
                if (isTopCard) {
                    card.reveal();
                } else {
                    card.isRevealed = false;
                    card.updateVisual(); // Принудительно обновляем визуал для закрытой карты
                }
                
                // Добавляем карту в стопку
                tableauStack.addCard(card, false);
            }
        }
        
        // 2. Оставшиеся карты кладем в stock (все закрытые)
        for (let i = deckIndex; i < this.fullDeck.length; i++) {
            const card = this.fullDeck[i];
            card.isRevealed = false; // Все карты в stock закрыты
            card.updateVisual(); // Принудительно обновляем визуал для закрытой карты
            this.stacks.stock.addCard(card, false);
        }
        
        // 3. Foundation и waste остаются пустыми (это правильно для начала игры)
        
        // 4. Публикуем событие завершения раздачи
        this.bus.publish({
            type: EVT_CARDS_DEALT,
            tableauCards: this.gameConfig.tableauLayout.reduce((sum, count) => sum + count, 0),
            stockCards: this.fullDeck.length - deckIndex,
            foundationCards: 0,
            wasteCards: 0
        });
        
        // 5. Воспроизводим звук раздачи карт
        this.bus.publish({
            type: EVT_PLAY_SOUND,
            soundType: SOUND_CARD_DEAL
        });
        
        console.log('GameLoopOrchestrator: Раздача карт завершена');
    }

    /**
     * Очищает все стопки от карт
     */
    private clearAllStacks(): void {
        // Собираем все карты со всех стопок для уничтожения
        const allCards: Card[] = [];
        
        // Очищаем tableau
        this.stacks.tableau.forEach((stack) => {
            const cards = stack.getCards();
            allCards.push(...cards);
        });
        
        // Очищаем foundations
        this.stacks.foundations.forEach((stack) => {
            const cards = stack.getCards();
            allCards.push(...cards);
        });
        
        // Очищаем stock и waste
        const stockCards = this.stacks.stock.getCards();
        const wasteCards = this.stacks.waste.getCards();
        allCards.push(...stockCards, ...wasteCards);
        
        // Уничтожаем все существующие карты
        allCards.forEach(card => {
            if (card && card.node) {
                card.node.destroy();
            }
        });
    }

    /**
     * Изменяет состояние игры и публикует событие
     */
    private changeState(newState: GameState): void {
        const oldState = this.currentState;
        this.currentState = newState;
        
        console.log(`GameLoopOrchestrator: Состояние изменено: ${oldState} → ${newState}`);
        
        this.bus.publish({
            type: EVT_GAME_STATE_CHANGED,
            oldState,
            newState,
            timestamp: Date.now()
        });
    }
}