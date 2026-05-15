import { _decorator, Component, Button } from 'cc';
import super_html_playable from 'db://assets/scripts/super_html/super_html_playable';

const { ccclass, property } = _decorator;

@ccclass('StoreButton')
export class StoreButton extends Component {
    @property({ type: Button })
    public button?: Button;

    onLoad() {
        // Если кнопка не назначена, пытаемся найти её на том же узле
        if (!this.button) {
            this.button = this.getComponent(Button);
        }

        // Подписываемся на событие клика кнопки
        if (this.button) {
            this.button.node.on(Button.EventType.CLICK, this.onButtonClick, this);
        } else {
            console.warn('[StoreButton] Button component не найден!');
        }
    }

    onDestroy() {
        // Отписываемся от события клика
        if (this.button) {
            this.button.node.off(Button.EventType.CLICK, this.onButtonClick, this);
        }
    }

    private onButtonClick(): void {
        // Вызываем super-html download для открытия store
        console.log('[StoreButton] Открываем store через super-html');
        super_html_playable.download();
    }
}
