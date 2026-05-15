import {_decorator, Component, Node, Vec3, tween, Tween, UITransform, Camera} from 'cc';
import type {IEventBus} from 'db://assets/scripts/common/event-bus';
import {GlobalEventBus} from 'db://assets/scripts/common/event-bus';
import {
    EVT_TUTORIAL_HIDE,
    EVT_CARDS_DEALT,
    EVT_CARD_MOVED,
    EVT_AUTO_MOVE_EXECUTED,
    EVT_LAYOUT_REBUILT
} from 'db://assets/scripts/common/events';
import { Card } from 'db://assets/scripts/game/card-system/card';
import { CardStack } from 'db://assets/scripts/game/card-system/card-stack';
import { StackType } from 'db://assets/scripts/game/card-system/card-types';

const {ccclass, property} = _decorator;

interface HideEvent {
    type: typeof EVT_TUTORIAL_HIDE;
}

interface GameStacks {
    stock: CardStack;
    waste: CardStack;
    foundations: CardStack[];
    tableau: CardStack[];
}

@ccclass('TutorialView')
export class TutorialView extends Component {
    @property({type: Node})
    public tutorialHand: Node | null = null;

    @property({type: Camera})
    public camera: Camera | null = null;

    private readonly bus: IEventBus = GlobalEventBus;
    private readonly unsubs: Array<() => void> = [];

    private currentTween: Tween<Node> | null = null;
    private pulseTween: Tween<Node> | null = null;
    private resourceLoopTween: Tween<Node> | null = null;
    private gameStacks: GameStacks | null = null;
    private tutorialShown: boolean = false;
    private currentTutorialCard: Card | null = null;

    onLoad() {
        console.log('TutorialView: onLoad() вызван');
        
        if (this.tutorialHand) {
            this.tutorialHand.active = false;
        }

        // Подписываемся на события туториала
        this.unsubs.push(
            this.bus.subscribe<HideEvent>(EVT_TUTORIAL_HIDE, (e) => this.hideTutorial())
        );

        // Подписываемся на раздачу карт
        this.unsubs.push(
            this.bus.subscribe(EVT_CARDS_DEALT, (e: any) => {
                console.log('TutorialView: Получено событие EVT_CARDS_DEALT');
                this.onCardsDealt(e);
            })
        );

        // Подписываемся на перемещение карт (чтобы скрыть туториал после первого хода)
        this.unsubs.push(
            this.bus.subscribe(EVT_CARD_MOVED, () => this.onFirstMove())
        );

        this.unsubs.push(
            this.bus.subscribe(EVT_AUTO_MOVE_EXECUTED, () => this.onFirstMove())
        );

        // Подписываемся на перестройку layout'а
        this.unsubs.push(
            this.bus.subscribe(EVT_LAYOUT_REBUILT, () => this.onLayoutRebuilt())
        );
        
        console.log('TutorialView: Подписки на события установлены');
    }

    start() {
        console.log('TutorialView: start() вызван');
        
        // Если gameStacks уже установлены и карты уже розданы, показываем туториал
        if (this.gameStacks && !this.tutorialShown) {
            console.log('TutorialView: GameStacks уже установлены, пытаемся показать туториал');
            this.scheduleOnce(() => {
                this.showTutorialHint();
            }, 0.5);
        }
    }

    onDestroy() {
        this.stopAllTweens();
        for (const unsub of this.unsubs) {
            try {
                unsub();
            } catch {
            }
        }
        this.unsubs.length = 0;
    }

    

    /**
     * Устанавливает игровые стопки для поиска ходов
     */
    public setGameStacks(stacks: GameStacks): void {
        this.gameStacks = stacks;
    }

    /**
     * Вызывается после раздачи карт
     */
    private onCardsDealt(event: any): void {
        console.log('TutorialView: onCardsDealt() вызван', {
            tutorialShown: this.tutorialShown,
            hasGameStacks: !!this.gameStacks
        });
        
        if (this.tutorialShown) {
            console.log('TutorialView: Туториал уже показан, пропускаем');
            return;
        }
        
        if (!this.gameStacks) {
            console.warn('TutorialView: GameStacks еще не установлены!');
            return;
        }

        console.log('TutorialView: Планируем показ туториала через 0.5 сек');
        // Небольшая задержка перед показом туториала
        this.scheduleOnce(() => {
            this.showTutorialHint();
        }, 0.5);
    }

    /**
     * Вызывается при первом ходе игрока
     */
    private onFirstMove(): void {
        if (this.tutorialShown) {
            this.hideTutorial();
        }
    }

    /**
     * Вызывается при перестройке layout'а - обновляем позицию руки
     */
    private onLayoutRebuilt(): void {
        console.log('TutorialView: onLayoutRebuilt() вызван', {
            tutorialShown: this.tutorialShown,
            hasCurrentCard: !!this.currentTutorialCard
        });
        
        // Если туториал активен и у нас есть текущая карта
        if (this.tutorialShown && this.currentTutorialCard && this.tutorialHand) {
            // Получаем новую мировую позицию карты
            const newCardWorldPos = this.currentTutorialCard.node.worldPosition.clone();
            console.log('TutorialView: Обновляем позицию руки после layout rebuild:', newCardWorldPos);
            
            // Телепортируем руку в новую позицию (без анимации)
            this.moveHandTo(newCardWorldPos, 0);
        }
    }

    /**
     * Показывает подсказку туториала на карте с выгодным ходом
     */
    private showTutorialHint(): void {
        if (!this.gameStacks || !this.tutorialHand) {
            console.warn('TutorialView: Отсутствуют необходимые компоненты', {
                gameStacks: !!this.gameStacks,
                tutorialHand: !!this.tutorialHand
            });
            return;
        }

        console.log('TutorialView: ===== Начинаем поиск выгодной карты =====');

        // Ищем карту с выгодным ходом
        const profitableCard = this.findProfitableCard();
        if (!profitableCard) {
            console.log('TutorialView: ❌ Не найдена карта с выгодным ходом');
            return;
        }

        console.log('TutorialView: ✅ Найдена карта для туториала:', {
            suit: profitableCard.suit,
            rank: profitableCard.rank,
            stackType: profitableCard.parentStack?.stackType,
            stackIndex: profitableCard.stackIndex
        });

        // Получаем мировую позицию карты
        const cardWorldPos = profitableCard.node.worldPosition.clone();
        console.log('TutorialView: Мировая позиция карты:', cardWorldPos);

        // Сохраняем текущую карту туториала
        this.currentTutorialCard = profitableCard;

        // Показываем руку
        this.tutorialHand.active = true;
        
        // Используем moveHandTo для установки позиции
        this.moveHandTo(cardWorldPos);
        console.log('TutorialView: Установлена позиция руки через moveHandTo');

        // Запускаем анимацию пульсации
        this.startPulseAnimation();

        this.tutorialShown = true;
        console.log('TutorialView: ===== Туториал показан =====');
    }

    /**
     * Находит карту с выгодным ходом (который принесет очки)
     */
    private findProfitableCard(): Card | null {
        if (!this.gameStacks) return null;

        console.log('TutorialView: --- Приоритет 1: Waste → Foundation ---');
        // Приоритет 1: Ищем карты из waste, которые можно переместить в foundation (больше всего очков)
        const wasteCard = this.gameStacks.waste.getTopCard();
        if (wasteCard && wasteCard.isRevealed) {
            console.log('TutorialView: Проверяем waste карту:', {
                suit: wasteCard.suit,
                rank: wasteCard.rank
            });
            for (let i = 0; i < this.gameStacks.foundations.length; i++) {
                const foundation = this.gameStacks.foundations[i];
                if (foundation.canAcceptCard(wasteCard)) {
                    console.log(`TutorialView: ✅ Найден ход: Waste → Foundation[${i}]`);
                    return wasteCard;
                }
            }
            console.log('TutorialView: ❌ Waste карта не подходит ни для одного foundation');
        } else {
            console.log('TutorialView: Waste пуст или карта закрыта');
        }

        console.log('TutorialView: --- Приоритет 2: Tableau → Foundation ---');
        // Приоритет 2: Ищем карты из tableau, которые можно переместить в foundation
        for (let i = 0; i < this.gameStacks.tableau.length; i++) {
            const tableauStack = this.gameStacks.tableau[i];
            const topCard = tableauStack.getTopCard();
            if (topCard && topCard.isRevealed) {
                console.log(`TutorialView: Проверяем Tableau[${i}] верхнюю карту:`, {
                    suit: topCard.suit,
                    rank: topCard.rank
                });
                for (let j = 0; j < this.gameStacks.foundations.length; j++) {
                    const foundation = this.gameStacks.foundations[j];
                    if (foundation.canAcceptCard(topCard)) {
                        console.log(`TutorialView: ✅ Найден ход: Tableau[${i}] → Foundation[${j}]`);
                        return topCard;
                    }
                }
            }
        }
        console.log('TutorialView: ❌ Нет ходов Tableau → Foundation');

        console.log('TutorialView: --- Приоритет 3: Waste → Tableau ---');
        // Приоритет 3: Ищем карты из waste, которые можно переместить в tableau
        if (wasteCard && wasteCard.isRevealed) {
            console.log('TutorialView: Проверяем waste карту для tableau:', {
                suit: wasteCard.suit,
                rank: wasteCard.rank
            });
            for (let i = 0; i < this.gameStacks.tableau.length; i++) {
                const tableauStack = this.gameStacks.tableau[i];
                if (tableauStack.canAcceptCard(wasteCard)) {
                    console.log(`TutorialView: ✅ Найден ход: Waste → Tableau[${i}]`);
                    return wasteCard;
                }
            }
            console.log('TutorialView: ❌ Waste карта не подходит ни для одного tableau');
        }

        console.log('TutorialView: --- Приоритет 4: Tableau → Tableau ---');
        // Приоритет 4: Ищем карты из tableau, которые можно переместить в другой tableau
        for (let i = 0; i < this.gameStacks.tableau.length; i++) {
            const sourceStack = this.gameStacks.tableau[i];
            const cards = sourceStack.getCards();
            console.log(`TutorialView: Проверяем Tableau[${i}], карт: ${cards.length}`);
            
            // Проверяем все открытые карты в стопке
            for (let cardIdx = 0; cardIdx < cards.length; cardIdx++) {
                const card = cards[cardIdx];
                if (!card.isRevealed) continue;

                console.log(`TutorialView: Проверяем карту [${cardIdx}]:`, {
                    suit: card.suit,
                    rank: card.rank
                });

                for (let j = 0; j < this.gameStacks.tableau.length; j++) {
                    const targetStack = this.gameStacks.tableau[j];
                    if (targetStack === sourceStack) continue;
                    
                    if (targetStack.canAcceptCard(card)) {
                        console.log(`TutorialView: ✅ Найден ход: Tableau[${i}][${cardIdx}] → Tableau[${j}]`);
                        return card;
                    }
                }
            }
        }
        console.log('TutorialView: ❌ Нет ходов Tableau → Tableau');

        console.log('TutorialView: ❌ Не найдено ни одного выгодного хода');
        return null;
    }

    private hideTutorial(): void {
        if (!this.tutorialHand) return;

        this.stopAllTweens();
        this.tutorialHand.active = false;
        this.tutorialShown = false;
        this.currentTutorialCard = null; // Очищаем ссылку на карту
    }

    private moveHandTo(targetWorldPos: Vec3, duration: number = 0.5): void {
        if (!this.tutorialHand) return;

        this.currentTween = tween(this.tutorialHand)
            .to(duration, {worldPosition: targetWorldPos}, {easing: 'sineOut'})
            .start();
    }

    

    private startPulseAnimation(): void {
        if (!this.tutorialHand) return;

        this.pulseTween = tween(this.tutorialHand)
            .repeatForever(
                tween()
                    .to(0.6, {scale: new Vec3(0.4, 0.4, 0.4)}, {easing: 'sineInOut'})
                    .to(0.6, {scale: new Vec3(0.3, 0.3, 0.3)}, {easing: 'sineInOut'}))
            .start();
    }

    private stopAllTweens(): void {
        if (this.currentTween) {
            this.currentTween.stop();
            this.currentTween = null;
        }

        if (this.pulseTween) {
            this.pulseTween.stop();
            this.pulseTween = null;
        }

        if (this.resourceLoopTween) {
            this.resourceLoopTween.stop();
            this.resourceLoopTween = null;
        }

        // Сбрасываем масштаб руки
        if (this.tutorialHand) {
            this.tutorialHand.setScale(Vec3.ONE);
        }
    }
}
