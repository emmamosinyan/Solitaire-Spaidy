import { AudioSource, Node, AudioClip } from 'cc';
import type { IEventBus } from 'db://assets/scripts/common/event-bus';
import type { AudioCatalog } from 'db://assets/scripts/audio/audio-catalog';
import {
    EVT_TAP,
    EVT_PLAY_SOUND
} from 'db://assets/scripts/common/events';

export class AudioController {
    private readonly bus: IEventBus;
    private readonly catalog: AudioCatalog;
    private readonly sfxAudioSources: AudioSource[] = [];
    private readonly musicAudioSource: AudioSource;
    private readonly audioSourceParent: Node;
    private readonly unsubs: Array<() => void> = [];
    private audioEnabled: boolean = false;

    constructor(params: {
        bus: IEventBus;
        catalog: AudioCatalog;
        audioSourceParent: Node;
        musicAudioSource: AudioSource;
    }) {
        this.bus = params.bus;
        this.catalog = params.catalog;
        this.audioSourceParent = params.audioSourceParent;
        this.musicAudioSource = params.musicAudioSource;
    }

    public start(): void {
        // Подписка на первый тап для активации аудио
        this.unsubs.push(
            this.bus.subscribe(EVT_TAP, () => this.onFirstTap())
        );

        // Подписка на события для воспроизведения звуков
        this.unsubs.push(
            this.bus.subscribe(EVT_PLAY_SOUND, (event: any) => this.playSound(event.soundType))
        );
    }

    public stop(): void {
        for (const unsub of this.unsubs) {
            try { unsub(); } catch {}
        }
        this.unsubs.length = 0;

        // Очищаем все созданные AudioSource
        for (const source of this.sfxAudioSources) {
            if (source && source.node) {
                source.node.destroy();
            }
        }
        this.sfxAudioSources.length = 0;
    }

    private onFirstTap(): void {
        if (!this.audioEnabled) {
            this.audioEnabled = true;
            console.log('AudioController: Аудио активировано');
            
            // Запускаем фоновую музыку
            this.playBackgroundMusic();
        }
    }

    /**
     * Запускает фоновую музыку
     */
    private playBackgroundMusic(): void {
        const musicClip = this.catalog.getBackgroundMusic();
        if (musicClip && this.musicAudioSource) {
            this.musicAudioSource.clip = musicClip;
            this.musicAudioSource.loop = true;
            this.musicAudioSource.volume = 0.4;
            this.musicAudioSource.play();
            console.log('AudioController: Фоновая музыка запущена');
        } else {
            if (!musicClip) {
                console.warn('AudioController: Фоновая музыка не найдена в каталоге');
            }
            if (!this.musicAudioSource) {
                console.warn('AudioController: musicAudioSource не установлен');
            }
        }
    }

    private playSound(soundType: string): void {
        if (!this.audioEnabled) {
            return; // Аудио еще не активировано
        }

        const audioClip = this.catalog.getSoundByType(soundType);
        if (!audioClip) {
            console.warn(`AudioController: No sound found for type: ${soundType}`);
            return;
        }

        // Ищем свободный AudioSource или создаем новый
        const audioSource = this.getAvailableAudioSource();
        if (audioSource) {
            audioSource.playOneShot(audioClip);
        }
    }

    /**
     * Возвращает свободный AudioSource или создает новый
     */
    private getAvailableAudioSource(): AudioSource | null {
        // Ищем свободный AudioSource (не проигрывающий звук)
        for (const source of this.sfxAudioSources) {
            if (!source.playing) {
                return source;
            }
        }

        // Все AudioSource заняты - создаем новый
        return this.createNewAudioSource();
    }

    /**
     * Создает новый AudioSource для звуковых эффектов
     */
    private createNewAudioSource(): AudioSource | null {
        if (!this.audioSourceParent) {
            console.error('AudioController: audioSourceParent не установлен');
            return null;
        }

        // Создаем новый Node для AudioSource
        const audioNode = new Node(`SFX_AudioSource_${this.sfxAudioSources.length}`);
        audioNode.setParent(this.audioSourceParent);

        // Добавляем компонент AudioSource
        const audioSource = audioNode.addComponent(AudioSource);
        audioSource.loop = false;
        audioSource.playOnAwake = false;
        audioSource.volume = 1.0;

        // Добавляем в массив
        this.sfxAudioSources.push(audioSource);

        console.log(`AudioController: Создан новый AudioSource (всего: ${this.sfxAudioSources.length})`);

        return audioSource;
    }

    // Публичные методы для ручного управления
    public enableAudio(): void {
        this.audioEnabled = true;
    }

    public disableAudio(): void {
        this.audioEnabled = false;
    }

    public isAudioEnabled(): boolean {
        return this.audioEnabled;
    }
}
