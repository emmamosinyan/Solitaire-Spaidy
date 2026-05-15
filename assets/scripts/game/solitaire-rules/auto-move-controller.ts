import { IEventBus } from 'db://assets/scripts/common/event-bus';
import {
    EVT_TAP,
    EVT_CARD_MOVED,
    EVT_AUTO_MOVE_EXECUTED,
    EVT_AUTO_MOVE_FAILED,
    EVT_PLAY_SOUND,
    SOUND_CANT_TAP,
    EVT_CTA_SHOWN
} from 'db://assets/scripts/common/events';
import { TapEvent } from 'db://assets/scripts/common/input-service';
import { Card } from '../card-system/card';
import { CardStack } from '../card-system/card-stack';
import { StackType } from '../card-system/card-types';

/**
 * Контроллер автоматического перемещения карт по клику
 * Работает параллельно с drag-drop системой
 * 
 * Логика:
 * 1. При клике на карту в tableau или waste
 * 2. Ищем валидную целевую стопку (приоритет: foundation → tableau)
 * 3. Перемещаем карту (и все карты над ней для tableau)
 */
export class AutoMoveController {
    private readonly bus: IEventBus;
    private readonly unsubs: Array<() => void> = [];
    private gameStacks: GameStacks | null = null;
    private ctaShown: boolean = false;

    constructor(params: { bus: IEventBus }) {
        this.bus = params.bus;
    }

    /**
     * Запускает контроллер
     */
    start(): void {
        this.subscribeToEvents();
        console.log('AutoMoveController: Запущен');
    }

    /**
     * Останавливает контроллер
     */
    stop(): void {
        for (const unsub of this.unsubs) {
            try { unsub(); } catch {}
        }
        this.unsubs.length = 0;
        console.log('AutoMoveController: Остановлен');
    }

    /**
     * Устанавливает игровые стопки для поиска целей
     */
    setGameStacks(stacks: GameStacks): void {
        this.gameStacks = stacks;
    }

    /**
     * Подписывается на события
     */
    private subscribeToEvents(): void {
        this.unsubs.push(
            this.bus.subscribe<TapEvent>(EVT_TAP, (event) => this.onTap(event))
        );
        this.unsubs.push(
            this.bus.subscribe(EVT_CTA_SHOWN, () => this.onCTAShown())
        );
    }

    /**
     * Обрабатывает событие клика
     */
    private onTap(event: TapEvent): void {
        if (this.ctaShown) return; // CTA показан — игнорируем

        if (!this.gameStacks) {
            console.warn('AutoMoveController: GameStacks не установлены');
            return;
        }

        // Ищем карту в hits
        const card = this.findCardInHits(event.hits);
        if (!card) return;

        // Проверяем, что карта из tableau или waste
        if (!this.isAutoMovableCard(card)) return;

        console.log('AutoMoveController: Попытка автоперемещения карты:', card.suit, card.rank);

        // Ищем целевую стопку
        const targetStack = this.findTargetStack(card);
        if (!targetStack) {
            console.log('AutoMoveController: Не найдена валидная целевая стопка');
            
            // Воспроизводим анимацию тряски карты
            card.playShakeAnimation();
            
            // Воспроизводим звук невозможности хода
            this.bus.publish({
                type: EVT_PLAY_SOUND,
                soundType: SOUND_CANT_TAP
            });
            
            this.bus.publish({
                type: EVT_AUTO_MOVE_FAILED,
                card: card,
                reason: 'No valid target stack'
            });
            return;
        }

        // Выполняем перемещение
        this.executeAutoMove(card, targetStack);
    }

    /**
     * Находит карту в списке hit объектов
     */
    private findCardInHits(hits: Array<{ node: any; id: string }>): Card | null {
        for (const hit of hits) {
            const card = hit.node.getComponent(Card);
            if (card) return card;
        }
        return null;
    }

    /**
     * Проверяет, можно ли автоматически перемещать карту
     */
    private isAutoMovableCard(card: Card): boolean {
        if (!card.isRevealed || !card.parentStack) return false;

        const stackType = card.parentStack.stackType;
        
        // Для waste - только верхняя карта
        if (stackType === StackType.WASTE) {
            return card.parentStack.getTopCard() === card;
        }
        
        // Для tableau - любая открытая карта
        if (stackType === StackType.TABLEAU) {
            return true;
        }

        return false;
    }

    /**
     * Ищет целевую стопку для карты
     * Приоритет: foundation → tableau
     */
    private findTargetStack(card: Card): CardStack | null {
        if (!this.gameStacks) return null;

        // 1. Сначала проверяем foundation стопки (приоритет)
        // Для foundation можно перемещать только верхнюю карту из tableau
        const isTopCard = card.parentStack && card.parentStack.getTopCard() === card;
        
        if (isTopCard) {
            for (const foundationStack of this.gameStacks.foundations) {
                if (foundationStack.canAcceptCard(card)) {
                    console.log('AutoMoveController: Найдена foundation стопка');
                    return foundationStack;
                }
            }
        }

        // 2. Затем проверяем tableau стопки
        // Для tableau можно перемещать любую открытую карту (и все карты над ней)
        for (const tableauStack of this.gameStacks.tableau) {
            // Пропускаем исходную стопку
            if (tableauStack === card.parentStack) continue;
            
            if (tableauStack.canAcceptCard(card)) {
                console.log('AutoMoveController: Найдена tableau стопка');
                return tableauStack;
            }
        }

        return null;
    }

    /**
     * Выполняет автоматическое перемещение карты
     */
    private executeAutoMove(card: Card, targetStack: CardStack): void {
        const sourceStack = card.parentStack;
        if (!sourceStack) {
            console.error('AutoMoveController: Исходная стопка не найдена');
            return;
        }

        console.log('AutoMoveController: Выполняем перемещение');

        // Определяем карты для перемещения
        const cardsToMove = this.getCardsToMove(card);

        // Удаляем карты из исходной стопки
        for (const cardToMove of cardsToMove) {
            sourceStack.removeCard(cardToMove);
        }

        // Добавляем карты в целевую стопку с анимацией
        for (const cardToMove of cardsToMove) {
            targetStack.addCard(cardToMove, true);
        }

        // Публикуем события
        this.bus.publish({
            type: EVT_AUTO_MOVE_EXECUTED,
            card: card,
            cardsCount: cardsToMove.length,
            fromStack: sourceStack,
            toStack: targetStack
        });

        // Публикуем событие перемещения для каждой карты
        for (const cardToMove of cardsToMove) {
            this.bus.publish({
                type: EVT_CARD_MOVED,
                card: cardToMove,
                fromStack: sourceStack,
                toStack: targetStack
            });
        }

        console.log(`AutoMoveController: Перемещено ${cardsToMove.length} карт(ы)`);
    }

    /**
     * Получает список карт для перемещения
     * Для tableau - карта и все карты над ней
     * Для waste - только сама карта
     */
    private getCardsToMove(card: Card): Card[] {
        const sourceStack = card.parentStack;
        if (!sourceStack) return [card];

        // Для waste - только одна карта
        if (sourceStack.stackType === StackType.WASTE) {
            return [card];
        }

        // Для tableau - карта и все карты над ней
        if (sourceStack.stackType === StackType.TABLEAU) {
            const allCards = sourceStack.getCards();
            const cardIndex = card.stackIndex;
            
            // Возвращаем карту и все карты после неё
            return allCards.slice(cardIndex);
        }

        return [card];
    }

    /**
     * Обрабатывает событие показа CTA
     */
    private onCTAShown(): void {
        this.ctaShown = true;
        console.log('AutoMoveController: CTA показан, контроллер отключен');
    }
}

/**
 * Интерфейс для игровых стопок
 */
export interface GameStacks {
    stock: CardStack;
    waste: CardStack;
    foundations: CardStack[];
    tableau: CardStack[];
}