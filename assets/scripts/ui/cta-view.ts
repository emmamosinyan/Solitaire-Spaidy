import { _decorator, Component, Node, tween, Vec3, Label, Animation, UIOpacity } from 'cc';
import type { IEventBus } from 'db://assets/scripts/common/event-bus';
import { GlobalEventBus } from 'db://assets/scripts/common/event-bus';
import { EVT_TAP, EVT_MOVES_TARGET_REACHED, EVT_PLAY_SOUND, SOUND_WON, SOUND_NOTIFICATION, EVT_CTA_SHOWN } from 'db://assets/scripts/common/events';
import type { ScoreController } from 'db://assets/scripts/game/score-system/score-controller';
import { NotificationView } from 'db://assets/scripts/ui/notification-view';
import super_html_playable from 'db://assets/scripts/super_html/super_html_playable';

const { ccclass, property } = _decorator;

@ccclass('CTAView')
export class CTAView extends Component {
    @property({ type: Node })
    public ctaContainer: Node;

    @property({ type: Node })
    public animatedContainer: Node;

    @property({ type: Label })
    public ctaScoreLabel?: Label;

    @property({ type: NotificationView })
    public notification?: NotificationView;

    @property({ type: [Node] })
    public scoreAnimationNodes: Node[] = [];

    private readonly bus: IEventBus = GlobalEventBus;
    private readonly unsubs: Array<() => void> = [];
    private currentAnimation: any = null;
    private ctaShown: boolean = false;
    private ctaAnimated: boolean = false;
    private scoreController?: ScoreController;
    private showCTATimeout?: number;

    private appStoreLink = "https://apps.apple.com/us/app/solitaire-smash-real-cash/id6446482475";
    private googlePlayLink = "https://galaxystore.samsung.com/detail/com.play.solitairesmash";

    onLoad() {
        this.ctaContainer.active = false;

        // Устанавливаем ссылки на сторы для super-html
        super_html_playable.set_app_store_url(this.appStoreLink);
        super_html_playable.set_google_play_url(this.googlePlayLink);

        // Подписываемся на достижение целевого количества ходов
        this.unsubs.push(
            this.bus.subscribe(EVT_MOVES_TARGET_REACHED, () => this.onMovesTargetReached())
        );

        // Подписываемся на клики по экрану
        this.unsubs.push(
            this.bus.subscribe(EVT_TAP, () => this.onScreenTap())
        );
    }

    onDestroy() {
        this.stopAnimation();

        // Очищаем таймаут если он есть
        if (this.showCTATimeout !== undefined) {
            clearTimeout(this.showCTATimeout);
            this.showCTATimeout = undefined;
        }

        for (const unsub of this.unsubs) {
            try {
                unsub();
            } catch {
            }
        }
        this.unsubs.length = 0;
    }

    /**
     * Устанавливает ссылку на ScoreController
     */
    public setScoreController(scoreController: ScoreController): void {
        this.scoreController = scoreController;
    }

    private onMovesTargetReached(): void {
        this.callGameEnd();

        // Очищаем предыдущий таймер если есть
        this.clearDelayTimeout();

        // Показываем CTA с задержкой 0.7 секунд
        this.showCTATimeout = setTimeout(() => {
            this.showCTA();
            this.showCTATimeout = undefined;
        }, 700) as unknown as number;
    }

    private clearDelayTimeout(): void {
        if (this.showCTATimeout !== null) {
            clearTimeout(this.showCTATimeout);
            this.showCTATimeout = null;
        }
    }

    private onScreenTap(): void {
        if (!this.ctaShown || !this.ctaAnimated) return;

        // Вызываем super-html download (заменяет install + openStoreUrl)
        console.log('[CTAView] Calling super-html download');
        super_html_playable.download();
    }

    private showCTA(): void {
        // Останавливаем предыдущую анимацию если есть
        this.stopAnimation();

        // Обновляем текст счета
        this.updateScoreText();

        // Воспроизводим звук победы
        this.bus.publish({
            type: EVT_PLAY_SOUND,
            soundType: SOUND_WON
        });

        this.ctaShown = true;

        // Публикуем событие что CTA показан
        this.bus.publish({
            type: EVT_CTA_SHOWN
        });

        // Показываем контейнер
        this.ctaContainer.active = true;
        this.animatedContainer.setScale(Vec3.ZERO);
        this.animatedContainer.setPosition(0, 0, 0);
    }

    /**
     * Обновляет текст счета в CTA с анимацией подсчета и масштабирования
     */
    private updateScoreText(): void {
        if (!this.ctaScoreLabel || !this.scoreController) {
            return;
        }

        const currentScore = this.scoreController.getCurrentScore();
        const animationDuration = 1.7; // Длительность анимации подсчета в секундах

        // Инициализируем notification с данными
        const description = `<color=#323232>You received <b>$${currentScore}</b> USD from <b>Solitaire Smash</b></color>`;
        if (this.notification) {
            this.notification.init('Solitaire Smash', description);
        }

        // Создаем объект для анимации счета
        const scoreCounter = { value: 0 };

        // Анимация подсчета от 0 до currentScore
        const scoreAnimation = tween(scoreCounter)
            .to(animationDuration, { value: currentScore }, {
                easing: 'sineOut',
                onUpdate: () => {
                    // Обновляем текст на каждом кадре анимации
                    const displayScore = Math.floor(scoreCounter.value);
                    this.ctaScoreLabel!.string = `YOU WON $${displayScore}`;
                }
            })
            .call(() => {
                // Убеждаемся, что финальное значение точное
                this.ctaScoreLabel!.string = `YOU WON $${currentScore}`;
                console.log(`CTAView: Анимация счета завершена - YOU WON $${currentScore}`);

                // Запускаем анимацию масштабирования label
                this.animateScoreLabelBounce();

                // Запускаем все Animation компоненты из массива
                this.playScoreAnimations();

                // Анимируем notification с задержкой 0.5 секунд
                tween(this.node)
                    .delay(0.5)
                    .call(() => {
                        this.animateNotification();
                    })
                    .start();

                // Анимируем CTA кнопку с задержкой 1 секунда
                tween(this.node)
                    .delay(1.0)
                    .call(() => {
                        // Анимация появления с последующей постоянной пульсацией
                        this.currentAnimation = tween(this.animatedContainer)
                            .to(0.5, {
                                scale: new Vec3(1.1, 1.1, 1.1)
                            }, { easing: 'backOut' })
                            .to(0.1, {
                                scale: new Vec3(1.0, 1.0, 1.0)
                            }, { easing: 'sineOut' })
                            .call(() => {
                                // Устанавливаем флаг что анимация завершена
                                this.ctaAnimated = true;
                                // После появления запускаем постоянную пульсацию
                                this.startPermanentPulse();
                            })
                            .start();
                    })
                    .start();
            })
            .start();
    }

    /**
     * Анимация увеличения-сжатия label со счетом
     */
    private animateScoreLabelBounce(): void {
        if (!this.ctaScoreLabel) {
            return;
        }

        const labelNode = this.ctaScoreLabel.node;
        const originalScale = labelNode.scale.clone();
        const bounceScale = originalScale.clone().multiplyScalar(1.2);

        tween(labelNode)
            .to(0.15, { scale: bounceScale }, { easing: 'backOut' })
            .to(0.2, { scale: originalScale }, { easing: 'backIn' })
            .start();
    }

    /**
     * Запускает все Animation компоненты из массива scoreAnimationNodes
     */
    private playScoreAnimations(): void {
        if (!this.scoreAnimationNodes || this.scoreAnimationNodes.length === 0) {
            console.log('CTAView: Нет Animation компонентов для воспроизведения');
            return;
        }

        console.log(`CTAView: Запуск ${this.scoreAnimationNodes.length} Animation компонентов`);

        for (const animation of this.scoreAnimationNodes) {
            console.log(animation);
            animation.active = true;
        }
    }

    /**
     * Анимирует notification через NotificationView компонент
     */
    private animateNotification(): void {
        if (!this.notification) {
            console.log('CTAView: Notification node не назначен');
            return;
        }

        // Воспроизводим звук уведомления
        this.bus.publish({
            type: EVT_PLAY_SOUND,
            soundType: SOUND_NOTIFICATION
        });

        this.notification.show();
    }

    private startPermanentPulse(): void {
        this.currentAnimation = tween(this.animatedContainer)
            .repeatForever(
                tween()
                    .to(0.8, {
                        scale: new Vec3(1.05, 1.05, 1.05)
                    }, { easing: 'sineInOut' })
                    .to(0.8, {
                        scale: new Vec3(1.0, 1.0, 1.0)
                    }, { easing: 'sineInOut' })
            )
            .start();
    }

    private stopAnimation(): void {
        if (this.currentAnimation) {
            this.currentAnimation.stop();
            this.currentAnimation = null;
        }

        tween(this.animatedContainer).stop();
    }

    /**
     * Вызывает super-html API для окончания игры
     */
    private callGameEnd(): void {
        console.log('[CTAView] Calling super-html game_end');
        super_html_playable.game_end();
    }
}
