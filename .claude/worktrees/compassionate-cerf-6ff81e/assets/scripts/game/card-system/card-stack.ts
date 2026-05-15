import { Component, _decorator, Vec3, Node, Tween, tween, Enum, Sprite, UITransform } from 'cc';
import { GlobalEventBus } from 'db://assets/scripts/common/event-bus';
import { EVT_HITTABLE_REGISTER, EVT_HITTABLE_UNREGISTER, EVT_PLAY_SOUND, SOUND_CARD_MOVE } from 'db://assets/scripts/common/events';
import { Card } from './card';
import { StackType, CardSuit, CardRank, CardUtils } from './card-types';

const { ccclass, property } = _decorator;

/**
 * Компонент стопки карт
 * Управляет коллекцией карт и их расположением
 */
@ccclass('CardStack')
export class CardStack extends Component {
    @property({ type: Enum(StackType) })
    public stackType: StackType = StackType.TABLEAU;

    @property({ type: Enum(CardSuit) })
    public targetSuit: CardSuit = CardSuit.HEARTS; // Только для foundation стопок

    @property
    public cardOffsetY: number = 30; // Смещение карт по Y для tableau

    @property  
    public cardOffsetX: number = 0; // Смещение карт по X

    @property
    public maxVisibleCards: number = 3; // Максимум видимых карт для waste

    // Массив карт в стопке
    private cards: Card[] = [];
    
    // Позиция для размещения карт
    private basePosition: Vec3 = new Vec3();
    
    // Конфигурация правил игры
    private requireAlternatingColors: boolean = true;
    
    // Родительский узел для анимации перемещения карт
    private dragParent: Node | null = null;

    onLoad(): void {
        // Регистрируем стопку как цель для drop
        GlobalEventBus.publish({ type: EVT_HITTABLE_REGISTER, node: this.node });
        
        // Базовая позиция для карт - локальная (0,0,0) относительно стопки
        this.basePosition = Vec3.ZERO.clone();

        // Подписываемся на события карт
        this.subscribeToCardEvents();
    }

    onDestroy(): void {
        // Отменяем регистрацию
        GlobalEventBus.publish({ type: EVT_HITTABLE_UNREGISTER, id: this.node.uuid });
    }

    /**
     * Добавляет карту в стопку
     */
    public addCard(card: Card, animated: boolean = false): void {
        if (!card) return;

        // Устанавливаем связь карты со стопкой
        card.parentStack = this;
        card.stackIndex = this.cards.length;
        
        // Добавляем карту в массив
        this.cards.push(card);
        
        // Вычисляем целевую позицию в локальных координатах стопки
        const targetLocalPosition = this.calculateCardPosition(this.cards.length - 1);
        
        if (animated && this.dragParent) {
            // Сохраняем текущую мировую позицию карты
            const currentWorldPos = card.node.worldPosition.clone();
            
            // Вычисляем целевую мировую позицию
            const targetWorldPos = new Vec3();
            this.node.getWorldPosition(targetWorldPos);
            targetWorldPos.add(targetLocalPosition);
            
            // Временно перемещаем карту в dragParent для анимации
            card.node.setParent(this.dragParent, false);
            card.node.setWorldPosition(currentWorldPos);
            
            // Анимируем перемещение в мировых координатах
            tween(card.node)
                .to(0.3, { worldPosition: targetWorldPos })
                .call(() => {
                    // После анимации перемещаем карту в стопку
                    card.node.setParent(this.node, false);
                    card.node.setPosition(targetLocalPosition);
                    // Масштабируем карту под размер стопки ПОСЛЕ установки parent
                    this.scaleCardToStack(card);
                    this.onCardAdded(card);
                    this.updateCardOrder();
                })
                .start();
        } else {
            // Без анимации - просто устанавливаем как дочерний объект
            card.node.setParent(this.node, true);
            card.node.setPosition(targetLocalPosition);
            // Масштабируем карту под размер стопки ПОСЛЕ установки parent
            this.scaleCardToStack(card);
            this.onCardAdded(card);
            this.updateCardOrder();
        }
    }

    /**
     * Удаляет карту из стопки
     */
    public removeCard(card: Card): boolean {
        const index = this.cards.indexOf(card);
        if (index === -1) return false;

        // Удаляем карту из массива
        this.cards.splice(index, 1);
        
        // Обновляем индексы оставшихся карт
        for (let i = index; i < this.cards.length; i++) {
            this.cards[i].stackIndex = i;
        }
        
        // Очищаем связь карты со стопкой
        card.parentStack = null;
        card.stackIndex = -1;

        // Публикуем событие
        GlobalEventBus.publish({
            type: 'StackCardRemoved',
            stack: this,
            card: card
        });

        // Для tableau: если есть карты и верхняя закрыта, открываем её
        if (this.stackType === StackType.TABLEAU && this.cards.length > 0) {
            const newTopCard = this.getTopCard();
            if (newTopCard && !newTopCard.isRevealed) {
                newTopCard.reveal();
            }
        }

        return true;
    }

    /**
     * Возвращает верхнюю карту стопки
     */
    public getTopCard(): Card | null {
        return this.cards.length > 0 ? this.cards[this.cards.length - 1] : null;
    }

    /**
     * Возвращает все карты в стопке
     */
    public getCards(): Card[] {
        return [...this.cards]; // Возвращаем копию массива
    }

    /**
     * Возвращает количество карт в стопке
     */
    public getCardCount(): number {
        return this.cards.length;
    }

    /**
     * Проверяет, пуста ли стопка
     */
    public isEmpty(): boolean {
        return this.cards.length === 0;
    }

    /**
     * Устанавливает правило чередования цветов
     */
    public setRequireAlternatingColors(value: boolean): void {
        this.requireAlternatingColors = value;
    }

    /**
     * Устанавливает родительский узел для анимации перемещения карт
     */
    public setDragParent(dragParent: Node): void {
        this.dragParent = dragParent;
    }

    /**
     * Проверяет, может ли карта быть добавлена в эту стопку
     */
    public canAcceptCard(card: Card): boolean {
        switch (this.stackType) {
            case StackType.FOUNDATION:
                return this.canPlaceOnFoundation(card);
            case StackType.TABLEAU:
                return this.canPlaceOnTableau(card);
            case StackType.WASTE:
                return false; // Waste принимает карты только из Stock
            case StackType.STOCK:
                return false; // Stock не принимает карты обратно
            default:
                return false;
        }
    }

    /**
     * Перемещает карту(ы) в другую стопку
     */
    public moveCardsTo(targetStack: CardStack, startIndex: number = -1): void {
        if (startIndex === -1) startIndex = this.cards.length - 1;
        
        const cardsToMove = this.cards.splice(startIndex);
        
        for (const card of cardsToMove) {
            targetStack.addCard(card, true);
        }
    }

    /**
     * Открывает верхнюю закрытую карту
     */
    public revealTopCard(): void {
        const topCard = this.getTopCard();
        if (topCard && !topCard.isRevealed) {
            topCard.reveal();
        }
    }

    /**
     * Вычисляет локальную позицию для карты по индексу
     */
    private calculateCardPosition(cardIndex: number): Vec3 {
        // Начинаем с базовой локальной позиции (0,0,0)
        let position = this.basePosition.clone();
        
        switch (this.stackType) {
            case StackType.TABLEAU:
                // Для tableau карты располагаются с вертикальным смещением вниз
                position.y -= cardIndex * this.cardOffsetY;
                break;
                
            case StackType.WASTE:
                // Для waste показываем только последние карты с горизонтальным смещением
                if (cardIndex >= this.cards.length - this.maxVisibleCards) {
                    const visibleIndex = cardIndex - (this.cards.length - this.maxVisibleCards);
                    position.x += visibleIndex * this.cardOffsetX;
                }
                break;
                
            case StackType.FOUNDATION:
            case StackType.STOCK:
            default:
                // Для foundation и stock карты располагаются друг на друге в базовой позиции
                // Небольшое смещение по Z для корректного отображения слоев
                position.z += cardIndex * 0.1;
                break;
        }
        
        return position;
    }

    /**
     * Обновляет порядок отображения карт (z-order)
     */
    private updateCardOrder(): void {
        for (let i = 0; i < this.cards.length; i++) {
            this.cards[i].node.setSiblingIndex(i);
        }
    }

    /**
     * Проверяет, можно ли поместить карту в foundation
     */
    private canPlaceOnFoundation(card: Card): boolean {
        if (card.suit !== this.targetSuit) return false;
        
        const topCard = this.getTopCard();
        return CardUtils.canPlaceOnFoundation(
            card.rank, 
            card.suit, 
            topCard?.rank ?? null, 
            this.targetSuit
        );
    }

    /**
     * Проверяет, можно ли поместить карту в tableau
     */
    private canPlaceOnTableau(card: Card): boolean {
        const topCard = this.getTopCard();
        
        // Если стопка пуста, можно поместить только короля
        if (!topCard) {
            return card.rank === CardRank.KING;
        }
        
        return CardUtils.canPlaceOnTableau(
            card.rank,
            card.suit,
            topCard.rank,
            topCard.suit,
            this.requireAlternatingColors
        );
    }

    /**
     * Подписывается на события карт
     */
    private subscribeToCardEvents(): void {
        // Здесь можно добавить подписки на специфичные события стопки
    }

    /**
     * Вызывается при добавлении карты
     */
    private onCardAdded(card: Card): void {
        // Публикуем событие
        GlobalEventBus.publish({
            type: 'StackCardAdded',
            stack: this,
            card: card
        });
        
        // Воспроизводим звук перемещения карты (кроме начальной раздачи)
        // Звук не воспроизводится для Stock стопки
        if (this.stackType !== StackType.STOCK) {
            GlobalEventBus.publish({
                type: EVT_PLAY_SOUND,
                soundType: SOUND_CARD_MOVE
            });
        }
    }

    /**
     * Масштабирует карту под размер стопки
     */
    private scaleCardToStack(card: Card): void {
        const stackTransform = this.node.getComponent(UITransform);
        const cardTransform = card.node.getComponent(UITransform);
        
        if (!stackTransform || !cardTransform) {
            console.warn('CardStack: Не удалось получить UITransform для масштабирования карты');
            return;
        }

        // Получаем размеры стопки и карты
        const stackWidth = stackTransform.width;
        const stackHeight = stackTransform.height;
        const cardWidth = cardTransform.width;
        const cardHeight = cardTransform.height;

        // Вычисляем коэффициенты масштабирования
        const scaleX = stackWidth / cardWidth;
        const scaleY = stackHeight / cardHeight;
        
        // Используем минимальный коэффициент для сохранения пропорций
        const scale = Math.min(scaleX, scaleY);
        
        // Применяем масштаб к карте
        card.node.setScale(scale, scale, 1);
        
        console.log(`CardStack: Карта масштабирована (scale: ${scale.toFixed(2)}, stack: ${stackWidth}x${stackHeight}, card: ${cardWidth}x${cardHeight})`);
    }

    /**
     * Перестраивает layout всех карт в стопке
     * Обновляет размеры и позиции всех карт в соответствии с текущим размером стопки
     */
    public rebuildCardsLayout(): void {
        if (this.cards.length === 0) {
            return;
        }

        console.log(`CardStack: Перестройка layout для ${this.cards.length} карт (тип: ${StackType[this.stackType]})`);

        // Обновляем позицию и размер каждой карты
        for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];
            
            // Вычисляем новую позицию
            const newPosition = this.calculateCardPosition(i);
            card.node.setPosition(newPosition);
            
            // Масштабируем карту под размер стопки
            this.scaleCardToStack(card);
        }

        // Обновляем z-order
        this.updateCardOrder();

        console.log(`CardStack: Layout перестроен для ${this.cards.length} карт`);
    }
}
