import { _decorator, Component, Node, tween, UIOpacity } from 'cc';
import { GlobalEventBus } from 'db://assets/scripts/common/event-bus';
import { 
    EVT_CURTAIN_FADE_IN_REQUESTED, 
    EVT_CURTAIN_FADE_IN_COMPLETE,
    EVT_CURTAIN_FADE_OUT_REQUESTED,
    EVT_CURTAIN_FADE_OUT_COMPLETE
} from 'db://assets/scripts/common/events';

const { ccclass, property } = _decorator;

@ccclass('CurtainView')
export class CurtainView extends Component {
    @property({ type: Node })
    curtainNode: Node | null = null;

    @property({ type: Number })
    fadeDuration: number = 0.5;

    private uiOpacity: UIOpacity | null = null;
    private unsubs: Array<() => void> = [];

    onLoad() {
        // Получаем компонент UIOpacity или создаем его
        if (this.curtainNode) {
            this.uiOpacity = this.curtainNode.getComponent(UIOpacity);
            if (!this.uiOpacity) {
                this.uiOpacity = this.curtainNode.addComponent(UIOpacity);
            }
            
            // Начальное состояние - полностью прозрачная
            this.uiOpacity.opacity = 0;
        }

        // Подписываемся на события
        this.unsubs.push(
            GlobalEventBus.subscribe(EVT_CURTAIN_FADE_IN_REQUESTED, () => this.fadeIn())
        );

        this.unsubs.push(
            GlobalEventBus.subscribe(EVT_CURTAIN_FADE_OUT_REQUESTED, () => this.fadeOut())
        );
    }

    onDestroy() {
        for (const unsub of this.unsubs) {
            try { unsub(); } catch {}
        }
        this.unsubs = [];
    }

    private fadeIn(): void {
        if (!this.uiOpacity || !this.curtainNode) return;

        // Показываем curtain node
        this.curtainNode.active = true;

        tween(this.uiOpacity)
            .to(this.fadeDuration, { opacity: 255 }, { easing: 'sineOut' })
            .call(() => {
                GlobalEventBus.publish({ type: EVT_CURTAIN_FADE_IN_COMPLETE });
            })
            .start();
    }

    private fadeOut(): void {
        if (!this.uiOpacity || !this.curtainNode) return;

        tween(this.uiOpacity)
            .to(this.fadeDuration, { opacity: 0 }, { easing: 'sineIn' })
            .call(() => {
                // Скрываем curtain node после анимации
                this.curtainNode.active = false;
                GlobalEventBus.publish({ type: EVT_CURTAIN_FADE_OUT_COMPLETE });
            })
            .start();
    }

    // Публичные методы для ручного управления
    public showCurtain(): void {
        this.fadeIn();
    }

    public hideCurtain(): void {
        this.fadeOut();
    }

    public isCurtainVisible(): boolean {
        return this.curtainNode?.active && this.uiOpacity?.opacity > 0;
    }
}
