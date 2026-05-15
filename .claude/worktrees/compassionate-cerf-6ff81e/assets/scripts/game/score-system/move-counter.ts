import { IEventBus } from 'db://assets/scripts/common/event-bus';
import {
    EVT_CARD_MOVED,
    EVT_CARD_FLIPPED,
    EVT_MOVES_TARGET_REACHED
} from 'db://assets/scripts/common/events';
import { CardStack } from '../card-system/card-stack';
import { StackType } from '../card-system/card-types';

/**
 * Интерфейс события перемещения карты
 */
interface CardMovedEvent {
    type: string;
    card: any;
    fromStack: CardStack;
    toStack: CardStack;
}

/**
 * Интерфейс события переворота карты
 */
interface CardFlippedEvent {
    type: string;
    card: any;
    isRevealed: boolean;
}

/**
 * Контроллер подсчета успешных ходов
 * Отслеживает положительные ходы (за которые начисляются очки) и публикует событие при достижении цели
 */
export class MoveCounter {
    private readonly bus: IEventBus;
    private readonly unsubs: Array<() => void> = [];
    
    private currentMoves: number = 0;
    private targetMoves: number = 5; // Целевое количество ходов для показа CTA

    constructor(params: {
        bus: IEventBus;
        targetMoves?: number;
    }) {
        this.bus = params.bus;
        
        if (params.targetMoves !== undefined) {
            this.targetMoves = params.targetMoves;
        }
    }

    /**
     * Запускает контроллер
     */
    start(): void {
        this.subscribeToEvents();
        console.log('MoveCounter: Запущен (целевое количество ходов:', this.targetMoves, ')');
    }

    /**
     * Останавливает контроллер
     */
    stop(): void {
        for (const unsub of this.unsubs) {
            try { unsub(); } catch {}
        }
        this.unsubs.length = 0;
        console.log('MoveCounter: Остановлен');
    }

    /**
     * Возвращает текущее количество ходов
     */
    getCurrentMoves(): number {
        return this.currentMoves;
    }

    /**
     * Возвращает целевое количество ходов
     */
    getTargetMoves(): number {
        return this.targetMoves;
    }

    /**
     * Проверяет, достигнуто ли целевое количество ходов
     */
    isTargetReached(): boolean {
        return this.currentMoves >= this.targetMoves;
    }

    /**
     * Сбрасывает счетчик ходов
     */
    resetMoves(): void {
        this.currentMoves = 0;
        console.log('MoveCounter: Счетчик ходов сброшен');
    }

    /**
     * Подписывается на игровые события
     */
    private subscribeToEvents(): void {
        // Перемещение карт
        this.unsubs.push(
            this.bus.subscribe<CardMovedEvent>(EVT_CARD_MOVED, (event) => this.onCardMoved(event))
        );

        // Переворот карт
        this.unsubs.push(
            this.bus.subscribe<CardFlippedEvent>(EVT_CARD_FLIPPED, (event) => this.onCardFlipped(event))
        );
    }

    /**
     * Обрабатывает событие перемещения карты
     * Считает только положительные ходы (за которые начисляются очки)
     */
    private onCardMoved(event: CardMovedEvent): void {
        const fromType = event.fromStack.stackType;
        const toType = event.toStack.stackType;
        
        let isPositiveMove = false;
        let reason = '';

        // Waste → Tableau (положительный ход)
        if (fromType === StackType.WASTE && toType === StackType.TABLEAU) {
            isPositiveMove = true;
            reason = 'Waste → Tableau';
        }
        // Waste → Foundation (положительный ход)
        else if (fromType === StackType.WASTE && toType === StackType.FOUNDATION) {
            isPositiveMove = true;
            reason = 'Waste → Foundation';
        }
        // Tableau → Foundation (положительный ход)
        else if (fromType === StackType.TABLEAU && toType === StackType.FOUNDATION) {
            isPositiveMove = true;
            reason = 'Tableau → Foundation';
        }
        // Tableau → Tableau (положительный ход)
        else if (fromType === StackType.TABLEAU && toType === StackType.TABLEAU) {
            isPositiveMove = true;
            reason = 'Tableau → Tableau';
        }
        // Foundation → Tableau (отрицательный ход, не считаем)

        if (isPositiveMove) {
            this.incrementMoves(reason);
        }
    }

    /**
     * Обрабатывает событие переворота карты
     * Открытие карты больше не считается отдельным ходом
     */
    private onCardFlipped(event: CardFlippedEvent): void {
        // Открытие карты происходит автоматически после перемещения
        // и не должно засчитываться как отдельный ход
        // Ход уже был засчитан в onCardMoved()
    }

    /**
     * Увеличивает счетчик ходов
     */
    private incrementMoves(reason: string): void {
        const oldMoves = this.currentMoves;
        this.currentMoves++;

        console.log(`MoveCounter: ${reason} → Ход #${this.currentMoves} (${oldMoves} → ${this.currentMoves})`);

        // Публикуем событие изменения количества ходов
        this.bus.publish({
            type: 'MovesChanged',
            oldMoves: oldMoves,
            newMoves: this.currentMoves,
            reason: reason
        });

        // Проверяем достижение целевого количества ходов
        if (this.currentMoves >= this.targetMoves && oldMoves < this.targetMoves) {
            console.log('MoveCounter: 🎉 Целевое количество ходов достигнуто!');
            this.bus.publish({
                type: EVT_MOVES_TARGET_REACHED,
                moves: this.currentMoves,
                target: this.targetMoves
            });
        }
    }

    /**
     * Устанавливает новое целевое количество ходов
     */
    setTargetMoves(target: number): void {
        this.targetMoves = target;
        console.log('MoveCounter: Установлено новое целевое количество ходов:', target);
    }
}