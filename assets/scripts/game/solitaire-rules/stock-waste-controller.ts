import { IEventBus } from 'db://assets/scripts/common/event-bus';
import { EVT_TAP, EVT_CARD_MOVED, EVT_STOCK_FLIPPED, EVT_WASTE_RECYCLED } from 'db://assets/scripts/common/events';
import { TapEvent } from 'db://assets/scripts/common/input-service';
import { CardStack } from '../card-system/card-stack';
import { Card } from '../card-system/card';
import { StackType } from '../card-system/card-types';

/**
 * Интерфейс для стопок Stock и Waste
 */
export interface StockWasteStacks {
    stock: CardStack;
    waste: CardStack;
}

/**
 * Контроллер для управления переворотом карт между Stock и Waste
 * Обрабатывает клики по Stock стопке и управляет перемещением карт
 */
export class StockWasteController {
    private readonly bus: IEventBus;
    private readonly stacks: StockWasteStacks;
    private unsubs: Array<() => void> = [];

    constructor(params: {
        bus: IEventBus;
        stacks: StockWasteStacks;
    }) {
        this.bus = params.bus;
        this.stacks = params.stacks;
    }

    /**
     * Запускает контроллер
     */
    start(): void {
        this.subscribeToEvents();
        console.log('StockWasteController: Запущен');
    }

    /**
     * Останавливает контроллер
     */
    stop(): void {
        for (const unsub of this.unsubs) {
            try { unsub(); } catch {}
        }
        this.unsubs.length = 0;
        console.log('StockWasteController: Остановлен');
    }

    /**
     * Подписывается на события
     */
    private subscribeToEvents(): void {
        this.unsubs.push(
            this.bus.subscribe<TapEvent>(EVT_TAP, (event) => this.onTap(event))
        );
    }

    /**
     * Обрабатывает события клика
     */
    private onTap(event: TapEvent): void {
        // Проверяем, кликнули ли по Stock стопке
        if (this.isStockStackClicked(event)) {
            this.handleStockClick();
        }
    }

    /**
     * Проверяет, был ли клик по Stock стопке
     */
    private isStockStackClicked(event: TapEvent): boolean {
        for (const hit of event.hits) {
            // Проверяем, является ли нажатый объект Stock стопкой
            if (hit.node === this.stacks.stock.node) {
                return true;
            }
        }
        return false;
    }

    /**
     * Обрабатывает клик по Stock стопке
     */
    private handleStockClick(): void {
        if (!this.stacks.stock.isEmpty()) {
            // Stock не пуст - переворачиваем карту в Waste
            this.flipStockToWaste();
        } else {
            // Stock пуст - возвращаем все карты из Waste в Stock
            this.recycleWasteToStock();
        }
    }

    /**
     * Переворачивает верхнюю карту из Stock в Waste
     */
    private flipStockToWaste(): void {
        const topCard = this.stacks.stock.getTopCard();
        if (!topCard) return;

        console.log('StockWasteController: Переворачиваем карту из Stock в Waste');

        // Удаляем карту из Stock
        if (this.stacks.stock.removeCard(topCard)) {
            // Открываем карту
            topCard.reveal();
            
            // Добавляем карту в Waste с анимацией
            this.stacks.waste.addCard(topCard, true);

            // Публикуем событие перемещения карты
            this.bus.publish({
                type: EVT_CARD_MOVED,
                card: topCard,
                fromStack: this.stacks.stock,
                toStack: this.stacks.waste
            });

            // Публикуем специальное событие переворота Stock
            this.bus.publish({
                type: EVT_STOCK_FLIPPED,
                card: topCard,
                stockCards: this.stacks.stock.getCardCount(),
                wasteCards: this.stacks.waste.getCardCount()
            });
        }
    }

    /**
     * Возвращает все карты из Waste обратно в Stock
     */
    private recycleWasteToStock(): void {
        const wasteCards = this.stacks.waste.getCards();
        
        if (wasteCards.length === 0) {
            console.log('StockWasteController: Waste пуст, нечего возвращать в Stock');
            return;
        }

        console.log(`StockWasteController: Возвращаем ${wasteCards.length} карт из Waste в Stock`);

        // Берем все карты из Waste (в обратном порядке, чтобы верхняя стала нижней)
        const cardsToMove = [...wasteCards].reverse();

        // Очищаем Waste (удаляем все карты без уничтожения)
        for (const card of wasteCards) {
            this.stacks.waste.removeCard(card);
        }

        // Добавляем карты обратно в Stock (все закрытые)
        for (const card of cardsToMove) {
            // Закрываем карту
            card.isRevealed = false;
            card.updateVisual();
            
            // Добавляем в Stock без анимации для быстроты
            this.stacks.stock.addCard(card, false);
        }

        // Публикуем событие переработки
        this.bus.publish({
            type: EVT_WASTE_RECYCLED,
            cardsRecycled: cardsToMove.length,
            stockCards: this.stacks.stock.getCardCount(),
            wasteCards: this.stacks.waste.getCardCount()
        });
    }

    /**
     * Возвращает информацию о текущем состоянии стопок
     */
    public getStatus(): { stockCards: number; wasteCards: number } {
        return {
            stockCards: this.stacks.stock.getCardCount(),
            wasteCards: this.stacks.waste.getCardCount()
        };
    }

    /**
     * Проверяет готовность контроллера к работе
     */
    public isReady(): boolean {
        return !!(this.stacks.stock && this.stacks.waste);
    }
}
