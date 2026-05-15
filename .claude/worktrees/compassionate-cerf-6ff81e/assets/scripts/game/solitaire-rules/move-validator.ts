import { Component } from 'cc';
import { IEventBus, EventBase } from 'db://assets/scripts/common/event-bus';
import { 
    EVT_DRAGGABLE_DROP_ATTEMPT,
    EVT_MOVE_VALIDATED, 
    EVT_MOVE_REJECTED,
    EVT_CARD_DROP_SUCCESS,
    EVT_CARD_DROP_FAILED,
    EVT_CARD_MOVED
} from 'db://assets/scripts/common/events';
import { Card } from '../card-system/card';
import { CardStack } from '../card-system/card-stack';
import { StackType, CardUtils } from '../card-system/card-types';
import { Draggable } from '../../drag/draggable';

interface DraggableDropAttemptEvent extends EventBase {
    type: string;
    draggable: Draggable;
    x: number;
    y: number;
    hits: Array<{ node: any; id: string }>;
}

/**
 * Система валидации ходов для игры Solitaire
 * Проверяет правильность размещения карт согласно правилам игры
 */
export class MoveValidator {
    private readonly bus: IEventBus;
    private unsubs: Array<() => void> = [];

    constructor(params: { bus: IEventBus }) {
        this.bus = params.bus;
    }

    start(): void {
        this.subscribeToEvents();
    }

    stop(): void {
        for (const unsub of this.unsubs) {
            try { unsub(); } catch {}
        }
        this.unsubs.length = 0;
    }

    /**
     * Подписывается на события drag-drop системы
     */
    private subscribeToEvents(): void {
        // Обрабатываем попытки размещения Draggable объектов
        this.unsubs.push(
            this.bus.subscribe<DraggableDropAttemptEvent>(EVT_DRAGGABLE_DROP_ATTEMPT, (e) => this.onDraggableDropAttempt(e))
        );
    }

    /**
     * Обрабатывает попытку размещения Draggable объекта
     */
    private onDraggableDropAttempt(event: DraggableDropAttemptEvent): void {
        // console.log('MoveValidator: Получено событие drop attempt');
        
        // 1. Проверяем, является ли draggable картой
        const card = this.extractCardFromDraggable(event.draggable);
        if (!card) {
            // console.log('MoveValidator: Draggable объект не является картой');
            return;
        }
        
        // 2. Находим целевую стопку
        const targetStack = this.findTargetStack(event.hits);
        if (!targetStack) {
            // console.log('MoveValidator: Целевая стопка не найдена');
            this.executeMoveFailure(card, 'Нет целевой стопки');
            return;
        }
        
        // 3. Валидируем ход
        if (!this.validateMove(card, targetStack)) {
            // console.log('MoveValidator: Ход невалидный');
            this.executeMoveFailure(card, 'Недопустимый ход');
            return;
        }
        
        // 4. Выполняем успешный ход
        // console.log('MoveValidator: Выполняем успешный ход');
        this.executeMoveSuccess(card, targetStack);
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
     * Находит целевую стопку среди hit объектов
     */
    private findTargetStack(hits: Array<{ node: any; id: string }>): CardStack | null {
        // 1. Сначала ищем CardStack напрямую
        for (const hit of hits) {
            const stack = hit.node.getComponent(CardStack);
            if (stack && stack.stackType !== StackType.STOCK) {
                return stack;
            }
        }
        
        // 2. Если не нашли стопку, ищем карту и получаем её parentStack
        for (const hit of hits) {
            const card = hit.node.getComponent(Card);
            if (card && card.parentStack && card.parentStack.stackType !== StackType.STOCK) {
                return card.parentStack;
            }
        }
        
        return null;
    }
    
    /**
     * Валидирует возможность размещения карты в целевую стопку
     */
    private validateMove(card: Card, targetStack: CardStack): boolean {
        return targetStack.canAcceptCard(card);
    }
    
    /**
     * Выполняет успешное перемещение карты
     */
    private executeMoveSuccess(card: Card, targetStack: CardStack): void {
        const sourceStack = card.parentStack;
        
        if (sourceStack) {
            // Удаляем карту из исходной стопки
            sourceStack.removeCard(card);
        }
        
        // Добавляем карту в целевую стопку с анимацией
        targetStack.addCard(card, true);
        
        // Очищаем состояние перетаскивания (без возврата позиции)
        card.clearDragState();
        
        // Публикуем события
        this.bus.publish({
            type: EVT_MOVE_VALIDATED,
            card: card,
            targetStack: targetStack
        });
        
        this.bus.publish({
            type: EVT_CARD_DROP_SUCCESS,
            card: card,
            fromStack: sourceStack,
            toStack: targetStack
        });

        this.bus.publish({
            type: EVT_CARD_MOVED,
            card: card,
            fromStack: sourceStack,
            toStack: targetStack
        })
    }
    
    /**
     * Обрабатывает неудачную попытку размещения карты
     */
    private executeMoveFailure(card: Card, reason: string): void {
        // Сбрасываем позицию карты
        card.resetDragState();
        
        // Публикуем события
        this.bus.publish({
            type: EVT_MOVE_REJECTED,
            card: card,
            reason: reason
        });
        
        this.bus.publish({
            type: EVT_CARD_DROP_FAILED,
            card: card,
            reason: reason
        });
    }
}
