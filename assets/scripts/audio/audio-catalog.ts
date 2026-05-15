import { _decorator, Component, AudioClip } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('AudioCatalog')
export class AudioCatalog extends Component {
    
    @property({ type: AudioClip })
    public cardDealSound: AudioClip | null = null;

    @property({ type: AudioClip })
    public cardMoveSound: AudioClip | null = null;

    @property({ type: AudioClip })
    public scoreIncreasedSound: AudioClip | null = null;

    @property({ type: AudioClip })
    public wonSound: AudioClip | null = null;

    @property({ type: AudioClip })
    public cantTapSound: AudioClip | null = null;

    @property({ type: AudioClip })
    public notificationSound: AudioClip | null = null;

    @property({ type: AudioClip })
    public backgroundMusic: AudioClip | null = null;


    // Метод для получения звука по типу события
    public getSoundByType(soundType: string): AudioClip | null {
        switch (soundType) {
            case 'CardDeal':
                return this.cardDealSound;
            case 'CardMove':
                return this.cardMoveSound;
            case 'ScoreIncreased':
                return this.scoreIncreasedSound;
            case 'Won':
                return this.wonSound;
            case 'CantTap':
                return this.cantTapSound;
            case 'Notification':
                return this.notificationSound;
            default:
                console.warn(`AudioCatalog: Unknown sound type: ${soundType}`);
                return null;
        }
    }

    // Метод для получения фоновой музыки
    public getBackgroundMusic(): AudioClip | null {
        return this.backgroundMusic;
    }

    // Проверка доступности звука
    public hasSound(soundType: string): boolean {
        return this.getSoundByType(soundType) !== null;
    }
}
