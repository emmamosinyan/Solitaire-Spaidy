import { _decorator, Component, Label, RichText, tween, UIOpacity } from 'cc';

const { ccclass, property } = _decorator;

/**
 * Компонент уведомления с заголовком и описанием
 */
@ccclass('NotificationView')
export class NotificationView extends Component {
    @property(Label)
    public titleLabel?: Label;

    @property(RichText)
    public descriptionRichText?: RichText;

    private uiOpacity?: UIOpacity;

    onLoad() {
        // Получаем или добавляем UIOpacity компонент
        this.uiOpacity = this.node.getComponent(UIOpacity);
        if (!this.uiOpacity) {
            this.uiOpacity = this.node.addComponent(UIOpacity);
        }
    }

    /**
     * Инициализирует уведомление с заголовком и описанием
     */
    public init(title: string, description: string): void {
        if (this.titleLabel) {
            this.titleLabel.string = title;
        } else {
            console.warn('NotificationView: titleLabel не назначен');
        }

        if (this.descriptionRichText) {
            this.descriptionRichText.string = description;
        } else {
            console.warn('NotificationView: descriptionRichText не назначен');
        }

        console.log(`NotificationView: Инициализировано - Title: "${title}", Description: "${description}"`);
    }

    /**
     * Показывает уведомление с анимацией движения вниз и появления
     */
    public show(): void {
        if (!this.uiOpacity) {
            console.error('NotificationView: UIOpacity компонент не найден');
            return;
        }

        // Сохраняем начальную позицию
        const startPosition = this.node.position.clone();
        const targetPosition = startPosition.clone();
        targetPosition.y -= 250;

        // Устанавливаем начальное состояние (прозрачность)
        this.uiOpacity.opacity = 0;

        // Создаем объект для анимации opacity
        const opacityTarget = { value: 0 };

        // Запускаем параллельные анимации
        // 1. Движение вниз
        tween(this.node)
            .to(0.5, {
                position: targetPosition
            }, { easing: 'sineOut' })
            .start();

        // 2. Появление из прозрачности
        tween(opacityTarget)
            .to(0.5, { value: 255 }, {
                easing: 'sineOut',
                onUpdate: () => {
                    if (this.uiOpacity) {
                        this.uiOpacity.opacity = opacityTarget.value;
                    }
                }
            })
            .start();

        console.log('NotificationView: Анимация показа запущена');
    }
}