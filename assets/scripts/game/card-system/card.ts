import { Node, Component, _decorator, Sprite, Vec3, Camera, find, tween } from 'cc';
import { Draggable } from 'db://assets/scripts/drag/draggable';
import { GlobalEventBus } from 'db://assets/scripts/common/event-bus';
import { EVT_HITTABLE_REGISTER, EVT_HITTABLE_UNREGISTER } from 'db://assets/scripts/common/events';
import { CardSuit, CardRank, ICard, CardColor, CardUtils, StackType } from './card-types';
import { CardResourcesCatalog } from '../../card-resources-catalog';

const { ccclass, property } = _decorator;

/**
 * Компонент карты для игры Solitaire
 * Наследует от Draggable для поддержки drag-drop функциональности
 */
@ccclass('Card')
export class Card extends Draggable implements ICard {
    @property(Sprite)
    public cardSprite: Sprite = null!;

    public resourcesCatalog: CardResourcesCatalog = null!;

    // Внутренние свойства
    private camera: Camera = null!;
    private originalParent: Node | null = null;
    private originalPosition: Vec3 | null = null;
    private isShaking: boolean = false;

    // Игровые свойства карты
    public suit: CardSuit = CardSuit.HEARTS;
    public rank: CardRank = CardRank.ACE;
    public isRevealed: boolean = false;
    public isMovable: boolean = true;
    
    // Связь со стопкой
    public parentStack: any = null; // CardStack - избегаем циклических импортов
    public stackIndex: number = -1;

    onLoad(): void {
        // Регистрируем карту как объект, с которым можно взаимодействовать
        GlobalEventBus.publish({ type: EVT_HITTABLE_REGISTER, node: this.node });
    }

    onDestroy(): void {
        // Отменяем регистрацию
        GlobalEventBus.publish({ type: EVT_HITTABLE_UNREGISTER, id: this.node.uuid });
    }

    /**
     * Инициализирует карту с заданными параметрами
     */
    public initializeCard(suit: CardSuit, rank: CardRank, camera: Camera, revealed: boolean = true): void {
        this.suit = suit;
        this.rank = rank;
        this.isRevealed = revealed;
        this.camera = camera;
        
        this.updateVisual();
    }

    /**
     * Переворачивает карту (открывает/закрывает)
     */
    public flip(): void {
        this.isRevealed = !this.isRevealed;
        this.updateVisual();
        
        // Публикуем событие переворота карты
        GlobalEventBus.publish({
            type: 'CardFlipped',
            card: this,
            isRevealed: this.isRevealed
        });
    }

    /**
     * Открывает карту
     */
    public reveal(): void {
        if (!this.isRevealed) {
            this.isRevealed = true;
            this.updateVisual();
            
            GlobalEventBus.publish({
                type: 'CardFlipped',
                card: this,
                isRevealed: this.isRevealed
            });
        }
    }

    /**
     * Возвращает цвет карты
     */
    public getColor(): CardColor {
        return CardUtils.getCardColor(this.suit);
    }

    /**
     * Возвращает числовое значение ранга
     */
    public getValue(): number {
        return CardUtils.getRankValue(this.rank);
    }

    /**
     * Проверяет, может ли карта быть перетащена
     */
    canDrag(): boolean {
        if (!this.isRevealed || !this.isMovable || !this.parentStack) {
            return false;
        }

        // Для tableau можно брать любую открытую карту
        if (this.parentStack.stackType === StackType.TABLEAU) {
            return true;
        }
        
        // Для других стопок - только верхнюю карту
        return this.isTopCardInStack();
    }

    /**
     * Устанавливает позицию карты при перетаскивании
     */
    setDragPosition(x: number, y: number, offsetX: number = 0, offsetY: number = 0): void {
        if (!this.camera) return;

        if(!this.originalPosition) {
            this.originalPosition = this.node.position.clone();
        }
        
        // Применяем offset для перетаскивания за точку захвата
        const worldPos = this.camera.screenToWorld(new Vec3(x + offsetX, y + offsetY, 0));
        this.node.setWorldPosition(worldPos);
    }

    /**
     * Устанавливает родительский объект при перетаскивании
     */
    setDragParent(parent: Node): void {
        this.originalParent = this.node.parent;
        this.node.setParent(parent);
    }

    /**
     * Сбрасывает состояние перетаскивания (возвращает на исходную позицию)
     */
    resetDragState(): void {
        if (this.originalParent) {
            this.node.setParent(this.originalParent);
            this.originalParent = null;
        }

        if(this.originalPosition) {
            this.node.setPosition(this.originalPosition);
            this.originalPosition = null;
        }
    }

    /**
     * Очищает состояние перетаскивания без возврата позиции
     * Используется при успешном перемещении карты
     */
    clearDragState(): void {
        this.originalParent = null;
        this.originalPosition = null;
    }

    /**
     * Обновляет визуальное представление карты
     */
    public updateVisual(): void {
        if (!this.cardSprite || !this.resourcesCatalog) return;

        if (!this.isRevealed) {
            // Показываем рубашку карты
            this.cardSprite.spriteFrame = this.resourcesCatalog.getCardBack();
        } else {
            // Показываем лицо карты
            const spriteFrame = this.resourcesCatalog.getCardSprite(this.suit, this.rank);
            if (spriteFrame) {
                this.cardSprite.spriteFrame = spriteFrame;
            }
        }
    }

    /**
     * Анимация тряски карты (визуальный отклик что нет доступных ходов)
     */
    public playShakeAnimation(): void {
        // Предотвращаем наложение анимаций
        if (this.isShaking) {
            return;
        }
        
        this.isShaking = true;
        const originalRotation = this.node.angle;
        const shakeAngle = 5; // Угол тряски в градусах
        const duration = 0.05; // Длительность одного движения
        
        tween(this.node)
            .to(duration, { angle: originalRotation + shakeAngle })
            .to(duration, { angle: originalRotation - shakeAngle })
            .to(duration, { angle: originalRotation + shakeAngle })
            .to(duration, { angle: originalRotation - shakeAngle })
            .to(duration, { angle: originalRotation })
            .call(() => {
                this.isShaking = false;
            })
            .start();
    }

    /**
     * Проверяет, является ли карта верхней в стопке
     */
    private isTopCardInStack(): boolean {
        if (!this.parentStack) return false;
        
        const topCard = this.parentStack.getTopCard();
        return topCard === this;
    }
}
