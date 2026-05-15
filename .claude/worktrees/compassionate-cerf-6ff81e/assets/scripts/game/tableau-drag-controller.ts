import { Vec3 } from 'cc';
import { IEventBus } from 'db://assets/scripts/common/event-bus';
import { 
    EVT_DRAG_STARTED_WITH_DRAGGABLE,
    EVT_CARD_DROP_SUCCESS,
    EVT_CARD_DROP_FAILED,
    EVT_TABLEAU_DRAG_CHAIN_CREATED,
    EVT_TABLEAU_DRAG_CHAIN_CLEARED
} from 'db://assets/scripts/common/events';
import { Card } from './card-system/card';
import { CardStack } from './card-system/card-stack';
import { StackType } from './card-system/card-types';
import { Draggable } from '../drag/draggable';

/**
 * Интерфейсы для событий
 */
interface DragStartedWithDraggableEvent {
    type: string;
    draggable: Draggable;
}


interface CardDropSuccessEvent {
    type: string;
    card: Card;
    fromStack: CardStack;
    toStack: CardStack;
}

interface CardDropFailedEvent {
    type: string;
    card: Card;
    reason: string;
}

/**
 * Контроллер для обработки перетаскивания цепочки карт из tableau стопок
 * Реализует логику каскадного перемещения карт при drag операциях
 */
export class TableauDragController {
    private readonly bus: IEventBus;
    private readonly unsubs: Array<() => void> = [];
    
    // Состояние текущей drag операции
    private currentDragCard: Card | null = null;
    private currentChildCards: Card[] = [];
    private isTableauDragActive: boolean = false;

    constructor(params: { bus: IEventBus }) {
        this.bus = params.bus;
    }

    /**
     * Запускает контроллер
     */
    start(): void {
        this.subscribeToEvents();
        console.log('TableauDragController: Запущен');
    }

    /**
     * Останавливает контроллер
     */
    stop(): void {
        this.clearDragState();
        for (const unsub of this.unsubs) {
            try { unsub(); } catch {}
        }
        this.unsubs.length = 0;
        console.log('TableauDragController: Остановлен');
    }

    /**
     * Подписывается на события
     */
    private subscribeToEvents(): void {
        this.unsubs.push(
            this.bus.subscribe<DragStartedWithDraggableEvent>(EVT_DRAG_STARTED_WITH_DRAGGABLE, (event) => this.onDragStartedWithDraggable(event))
        );

        this.unsubs.push(
            this.bus.subscribe<CardDropSuccessEvent>(EVT_CARD_DROP_SUCCESS, (event) => this.onCardDropSuccess(event))
        );

        this.unsubs.push(
            this.bus.subscribe<CardDropFailedEvent>(EVT_CARD_DROP_FAILED, (event) => this.onCardDropFailed(event))
        );
    }

    /**
     * Обрабатывает начало перетаскивания с конкретным draggable
     */
    private onDragStartedWithDraggable(event: DragStartedWithDraggableEvent): void {
        // Проверяем, что draggable является картой
        const card = this.extractCardFromDraggable(event.draggable);
        if (!card) return;

        // Проверяем, что это tableau карта
        if (!this.isTableauCard(card)) return;

        console.log('TableauDragController: Начало tableau drag для карты:', card.suit, card.rank);

        this.currentDragCard = card;
        this.isTableauDragActive = true;

        // Определяем дочерние карты
        const childCards = this.getChildCards(card);
        
        if (childCards.length > 0) {
            this.currentChildCards = childCards;
            
            // Настраиваем parent-child отношения
            this.setupParentChildRelations(card, childCards);
            
            // Удаляем дочерние карты из исходной стопки
            this.removeChildCardsFromStack(childCards);

            // Публикуем событие создания цепочки
            this.bus.publish({
                type: EVT_TABLEAU_DRAG_CHAIN_CREATED,
                primaryCard: card,
                childCards: childCards
            });

            console.log(`TableauDragController: Создана цепочка из ${childCards.length + 1} карт`);
        }
    }

    /**
     * Обрабатывает успешный drop
     */
    private onCardDropSuccess(event: CardDropSuccessEvent): void {
        if (!this.isTableauDragActive || event.card !== this.currentDragCard) return;

        console.log('TableauDragController: Успешный drop, размещаем дочерние карты');
        this.placeChildCardsWithPrimaryCard();
    }

    /**
     * Обрабатывает неудачный drop
     */
    private onCardDropFailed(event: CardDropFailedEvent): void {
        if (!this.isTableauDragActive || event.card !== this.currentDragCard) return;

        console.log('TableauDragController: Неудачный drop, размещаем дочерние карты');
        this.placeChildCardsWithPrimaryCard();
    }

    /**
     * Извлекает Card компонент из Draggable объекта
     */
    private extractCardFromDraggable(draggable: Draggable): Card | null {
        if (draggable instanceof Card) {
            return draggable;
        }
        return null;
    }

    /**
     * Проверяет, принадлежит ли карта tableau стопке
     */
    private isTableauCard(card: Card): boolean {
        return card.parentStack && 
               card.parentStack.stackType === StackType.TABLEAU && 
               card.isRevealed;
    }

    /**
     * Получает все дочерние карты (карты выше данной в стопке)
     */
    private getChildCards(primaryCard: Card): Card[] {
        const stack = primaryCard.parentStack as CardStack;
        if (!stack) return [];

        const allCards = stack.getCards();
        const primaryIndex = primaryCard.stackIndex;
        
        // Все карты после primaryCard являются дочерними
        return allCards.slice(primaryIndex + 1);
    }

    /**
     * Настраивает parent-child отношения между картами
     */
    private setupParentChildRelations(primaryCard: Card, childCards: Card[]): void {
        if (childCards.length === 0) return;

        // Получаем offset из стека для правильного позиционирования
        const stack = primaryCard.parentStack as CardStack;
        const cardOffsetY = stack ? stack.cardOffsetY : 30; // fallback к значению по умолчанию

        let currentParent = primaryCard;
        
        for (let i = 0; i < childCards.length; i++) {
            const childCard = childCards[i];
            
            // Устанавливаем текущую карту как parent для дочерней
            childCard.node.setParent(currentParent.node);
            
            // Рассчитываем локальную позицию относительно parent
            // Для tableau каждая следующая карта смещается вниз на cardOffsetY
            // Z-координата должна быть 0, так как мы уже в иерархии с правильным z
            childCard.node.setPosition(0, -cardOffsetY, 0);
            
            currentParent = childCard;
        }

        console.log(`TableauDragController: Настроены parent-child отношения для ${childCards.length} карт с offset ${cardOffsetY}`);
    }

    /**
     * Удаляет дочерние карты из исходной стопки
     */
    private removeChildCardsFromStack(childCards: Card[]): void {
        for (const card of childCards) {
            const stack = card.parentStack as CardStack;
            if (stack) {
                stack.removeCard(card);
            }
        }
    }

    /**
     * Размещает дочерние карты в стеке, где находится основная карта
     * Универсальный метод для успешного и неудачного drop
     */
    private placeChildCardsWithPrimaryCard(): void {
        if (!this.currentDragCard) {
            this.clearDragState();
            return;
        }

        // Получаем актуальную стопку главной карты
        const currentStack = this.currentDragCard.parentStack as CardStack;
        if (!currentStack) {
            console.warn('TableauDragController: Не найден стек для основной карты');
            this.clearDragState();
            return;
        }

        console.log(`TableauDragController: Размещаем ${this.currentChildCards.length} дочерних карт в стек`);

        // Добавляем все дочерние карты в стек основной карты
        for (const card of this.currentChildCards) {
            // Восстанавливаем нормальное parent-child отношение
            card.node.setParent(currentStack.node);
            
            // Добавляем в стопку без анимации для быстроты
            currentStack.addCard(card, false);
        }

        // Публикуем событие очистки цепочки
        this.bus.publish({
            type: EVT_TABLEAU_DRAG_CHAIN_CLEARED,
            cards: [this.currentDragCard, ...this.currentChildCards]
        });

        this.clearDragState();
    }

    /**
     * Очищает состояние drag операции
     */
    private clearDragState(): void {
        this.currentDragCard = null;
        this.currentChildCards = [];
        this.isTableauDragActive = false;
    }
}
