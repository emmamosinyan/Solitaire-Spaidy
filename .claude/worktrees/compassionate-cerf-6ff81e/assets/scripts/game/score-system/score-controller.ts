import { Label, Node, Prefab, Camera, instantiate, Vec3, tween } from 'cc';
import { IEventBus } from 'db://assets/scripts/common/event-bus';
import {
    EVT_CARD_MOVED,
    EVT_CARD_FLIPPED,
    EVT_STOCK_FLIPPED,
    EVT_WASTE_RECYCLED,
    EVT_MOVE_VALIDATED,
    EVT_AUTO_MOVE_EXECUTED,
    EVT_PLAY_SOUND,
    SOUND_SCORE_INCREASED
} from 'db://assets/scripts/common/events';
import { CardStack } from '../card-system/card-stack';
import { StackType } from '../card-system/card-types';
import { ScoreRules } from '../gameloop/game-config';

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
 * Контроллер системы подсчета очков
 * Отслеживает игровые события и начисляет очки согласно правилам Solitaire
 */
export class ScoreController {
    private readonly bus: IEventBus;
    private readonly scoreLabel: Label;
    private readonly unsubs: Array<() => void> = [];
    
    private currentScore: number = 0;
    private targetScore: number = 100; // Целевой счет для победы
    private enableRecyclePenalty: boolean = false; // Штраф за рециклинг waste
    private scoreRules: ScoreRules; // Правила начисления очков
    
    // Animation properties
    private readonly moneySpritePrefab?: Prefab;
    private readonly moneyTarget?: Node;
    private readonly scoreContainer?: Node;
    private readonly camera?: Camera;
    private pendingScoreUpdates: Array<{ points: number; reason: string }> = [];
    private isAnimating: boolean = false;
    private isBounceAnimating: boolean = false;

    constructor(params: {
        bus: IEventBus;
        scoreLabel: Label;
        targetScore?: number;
        enableRecyclePenalty?: boolean;
        scoreRules: ScoreRules;
        moneySpritePrefab?: Prefab;
        moneyTarget?: Node;
        scoreContainer?: Node;
        camera?: Camera;
    }) {
        this.bus = params.bus;
        this.scoreLabel = params.scoreLabel;
        this.scoreRules = params.scoreRules;
        this.moneySpritePrefab = params.moneySpritePrefab;
        this.moneyTarget = params.moneyTarget;
        this.scoreContainer = params.scoreContainer;
        this.camera = params.camera;
        
        if (params.targetScore !== undefined) {
            this.targetScore = params.targetScore;
        }
        
        if (params.enableRecyclePenalty !== undefined) {
            this.enableRecyclePenalty = params.enableRecyclePenalty;
        }
    }

    /**
     * Запускает контроллер
     */
    start(): void {
        this.subscribeToEvents();
        this.updateScoreDisplay();
        console.log('ScoreController: Запущен (целевой счет:', this.targetScore, ')');
    }

    /**
     * Останавливает контроллер
     */
    stop(): void {
        for (const unsub of this.unsubs) {
            try { unsub(); } catch {}
        }
        this.unsubs.length = 0;
        console.log('ScoreController: Остановлен');
    }

    /**
     * Возвращает текущий счет
     */
    getCurrentScore(): number {
        return this.currentScore;
    }

    /**
     * Возвращает целевой счет
     */
    getTargetScore(): number {
        return this.targetScore;
    }

    /**
     * Проверяет, достигнут ли целевой счет
     */
    isTargetReached(): boolean {
        return this.currentScore >= this.targetScore;
    }

    /**
     * Сбрасывает счет
     */
    resetScore(): void {
        this.currentScore = 0;
        this.updateScoreDisplay();
        console.log('ScoreController: Счет сброшен');
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

        // Рециклинг waste (опционально)
        if (this.enableRecyclePenalty) {
            this.unsubs.push(
                this.bus.subscribe(EVT_WASTE_RECYCLED, () => this.onWasteRecycled())
            );
        }
    }

    /**
     * Обрабатывает событие перемещения карты
     */
    private onCardMoved(event: CardMovedEvent): void {
        const fromType = event.fromStack.stackType;
        const toType = event.toStack.stackType;
        
        let points = 0;
        let reason = '';

        // Waste → Tableau
        if (fromType === StackType.WASTE && toType === StackType.TABLEAU) {
            points = this.scoreRules.wasteToTableau;
            reason = 'Waste → Tableau';
        }
        // Waste → Foundation
        else if (fromType === StackType.WASTE && toType === StackType.FOUNDATION) {
            points = this.scoreRules.wasteToFoundation;
            reason = 'Waste → Foundation';
        }
        // Tableau → Foundation
        else if (fromType === StackType.TABLEAU && toType === StackType.FOUNDATION) {
            points = this.scoreRules.tableauToFoundation;
            reason = 'Tableau → Foundation';
        }
        // Foundation → Tableau (штраф)
        else if (fromType === StackType.FOUNDATION && toType === StackType.TABLEAU) {
            points = this.scoreRules.foundationToTableau;
            reason = 'Foundation → Tableau (штраф)';
        }
        // Tableau → Tableau (перемещение между колонками)
        else if (fromType === StackType.TABLEAU && toType === StackType.TABLEAU) {
            points = 0; // Не начисляем очки за перемещение между tableau
            reason = 'Tableau → Tableau';
        }

        if (points !== 0) {
            // Получаем мировую позицию целевого стека для анимации
            const targetStackWorldPos = event.toStack.node ? event.toStack.node.worldPosition.clone() : null;
            this.addScore(points, reason, targetStackWorldPos);
        }
    }

    /**
     * Обрабатывает событие переворота карты
     */
    private onCardFlipped(event: CardFlippedEvent): void {
        // Начисляем очки только за открытие карты (не за закрытие)
        if (event.isRevealed && event.card.parentStack) {
            const stackType = event.card.parentStack.stackType;
            
            // Очки только за открытие карт в tableau
            if (stackType === StackType.TABLEAU) {
                const cardWorldPos = event.card.node ? event.card.node.worldPosition.clone() : null;
                this.addScore(this.scoreRules.revealTableauCard, 'Открыта карта в Tableau', cardWorldPos);
            }
        }
    }

    /**
     * Обрабатывает событие рециклинга waste
     */
    private onWasteRecycled(): void {
        if (this.enableRecyclePenalty) {
            this.addScore(this.scoreRules.recycleWaste, 'Рециклинг Waste (штраф)', null);
        }
    }

    /**
     * Добавляет очки к текущему счету с анимацией
     */
    private addScore(points: number, reason: string, sourceWorldPos: Vec3 | null): void {
        console.log(`ScoreController: ${reason} → ${points > 0 ? '+' : ''}${points} очков`);

        // Добавляем в очередь обновлений
        this.pendingScoreUpdates.push({ points, reason });

        // Если анимация доступна и есть исходная позиция, запускаем анимацию
        if (this.canAnimate() && sourceWorldPos) {
            this.playScoreAnimation(points, sourceWorldPos);
        } else {
            // Без анимации - сразу обновляем счет
            this.processScoreUpdate(points, reason);
        }
    }

    /**
     * Проверяет, доступна ли анимация
     */
    private canAnimate(): boolean {
        return !!(this.moneySpritePrefab && this.moneyTarget && this.scoreContainer && this.camera);
    }

    /**
     * Запускает анимацию полета монеты
     */
    private playScoreAnimation(points: number, sourceWorldPos: Vec3): void {
        if (!this.moneySpritePrefab || !this.moneyTarget || !this.camera) return;

        // Создаем спрайт монеты
        const moneyNode = instantiate(this.moneySpritePrefab);
        if (!moneyNode) return;

        // Добавляем в сцену (в dragParent или root)
        const parent = this.scoreContainer?.parent || this.moneyTarget.parent;
        if (!parent) {
            moneyNode.destroy();
            return;
        }

        moneyNode.setParent(parent);
        moneyNode.setWorldPosition(sourceWorldPos);

        // Целевая позиция - позиция moneyTarget
        const targetWorldPos = this.moneyTarget.worldPosition.clone();

        // Анимация полета
        tween(moneyNode)
            .to(0.5, { worldPosition: targetWorldPos }, {
                easing: 'sineInOut'
            })
            .call(() => {
                // После завершения анимации полета
                moneyNode.destroy();
                
                // Обрабатываем обновление счета
                const update = this.pendingScoreUpdates.shift();
                if (update) {
                    this.processScoreUpdate(update.points, update.reason);
                }
                
                // Анимация масштаба контейнера счета
                this.playScoreContainerBounce();
            })
            .start();
    }

    /**
     * Анимация увеличения-уменьшения контейнера счета
     */
    private playScoreContainerBounce(): void {
        if (!this.scoreContainer) return;
        
        // Предотвращаем наложение bounce анимаций
        if (this.isBounceAnimating) return;

        this.isBounceAnimating = true;
        const originalScale = this.scoreContainer.scale.clone();
        const bounceScale = originalScale.clone().multiplyScalar(1.1);

        tween(this.scoreContainer)
            .to(0.1, { scale: bounceScale }, { easing: 'backOut' })
            .to(0.15, { scale: originalScale }, { easing: 'backIn' })
            .call(() => {
                // Сбрасываем флаг после завершения анимации
                this.isBounceAnimating = false;
            })
            .start();
    }

    /**
     * Обрабатывает обновление счета
     */
    private processScoreUpdate(points: number, reason: string): void {
        const oldScore = this.currentScore;
        this.currentScore += points;
        
        // Не допускаем отрицательный счет
        if (this.currentScore < 0) {
            this.currentScore = 0;
        }

        console.log(`ScoreController: Счет обновлен: ${oldScore} → ${this.currentScore}`);

        this.updateScoreDisplay();

        // Воспроизводим звук увеличения счета (только при положительных очках)
        if (points > 0) {
            this.bus.publish({
                type: EVT_PLAY_SOUND,
                soundType: SOUND_SCORE_INCREASED
            });
        }

        // Публикуем событие изменения счета
        this.bus.publish({
            type: 'ScoreChanged',
            oldScore: oldScore,
            newScore: this.currentScore,
            points: points,
            reason: reason
        });

        // Проверяем достижение целевого счета
        if (this.currentScore >= this.targetScore && oldScore < this.targetScore) {
            console.log('ScoreController: 🎉 Целевой счет достигнут!');
            this.bus.publish({
                type: 'TargetScoreReached',
                score: this.currentScore,
                target: this.targetScore
            });
        }
    }

    /**
     * Обновляет отображение счета в Label
     */
    private updateScoreDisplay(): void {
        if (this.scoreLabel) {
            this.scoreLabel.string = `$${this.currentScore}`;
        }
    }

    /**
     * Устанавливает новый целевой счет
     */
    setTargetScore(target: number): void {
        this.targetScore = target;
        console.log('ScoreController: Установлен новый целевой счет:', target);
    }

    /**
     * Включает/выключает штраф за рециклинг
     */
    setRecyclePenalty(enabled: boolean): void {
        this.enableRecyclePenalty = enabled;
        console.log('ScoreController: Штраф за рециклинг:', enabled ? 'включен' : 'выключен');
    }
}