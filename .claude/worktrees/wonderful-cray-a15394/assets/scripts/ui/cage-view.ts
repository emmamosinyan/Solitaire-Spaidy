import { _decorator, Component, Sprite, SpriteFrame, Node, Vec3, tween } from 'cc';
import { GlobalEventBus } from 'db://assets/scripts/common/event-bus';
import { EVT_FOUNDATION_COMPLETED } from 'db://assets/scripts/common/events';

const { ccclass, property } = _decorator;

const TOTAL_LOCKS = 4;
const ANIM_INTERVAL = 0.45; // секунд между переключением кадров

/**
 * Отображение клетки со Spidey
 *
 * Подписывается на EVT_FOUNDATION_COMPLETED (одна из 4 мастей собрана A→K).
 * При каждом событии:
 *   - анимирует исчезновение одного замка
 *   - обновляет выражение Spidey (грустный → полусчастливый → счастливый)
 *   - при 4-м замке переключает клетку на открытую
 *
 * Назначения в инспекторе:
 *   cageSprite        — Sprite компонент изображения клетки
 *   cageClosedFrame   — jail_cage_closed.png
 *   cageOpenedFrame   — jail_cage_opened.png
 *   mascotSprite      — Sprite компонент Spidey
 *   sadFrames         — кадры 7, 8 из mascot_expresion (грустный)
 *   medHappyFrames    — кадры 5, 6 из mascot_expresion (начинает радоваться)
 *   happyFrames       — кадры 1, 2 из mascot_expresion (счастливый)
 *   lockNodes         — 4 дочерних узла с замками (в порядке открытия)
 */
@ccclass('CageView')
export class CageView extends Component {

    @property(Sprite)
    private cageSprite: Sprite = null!;

    @property(SpriteFrame)
    private cageClosedFrame: SpriteFrame = null!;

    @property(SpriteFrame)
    private cageOpenedFrame: SpriteFrame = null!;

    @property(Sprite)
    private mascotSprite: Sprite = null!;

    @property({ type: [SpriteFrame], tooltip: 'Кадры грустного Spidey — кадры 7 и 8 из спрайтшита' })
    private sadFrames: SpriteFrame[] = [];

    @property({ type: [SpriteFrame], tooltip: 'Кадры Spidey, начинающего радоваться — кадры 5 и 6 из спрайтшита' })
    private medHappyFrames: SpriteFrame[] = [];

    @property({ type: [SpriteFrame], tooltip: 'Кадры счастливого Spidey — кадры 1 и 2 из спрайтшита' })
    private happyFrames: SpriteFrame[] = [];

    @property({ type: [Node], tooltip: '4 узла замков — исчезают по одному при каждом завершении foundation' })
    private lockNodes: Node[] = [];

    private openedCount: number = 0;
    private frameIdx: number = 0;
    private unsubs: Array<() => void> = [];

    // Стрелочная функция нужна чтобы schedule/unschedule работали с одной и той же ссылкой
    private readonly tickAnimation = (): void => {
        const frames = this.activeFrames();
        if (!this.mascotSprite || frames.length < 2) return;
        this.frameIdx = (this.frameIdx + 1) % frames.length;
        this.mascotSprite.spriteFrame = frames[this.frameIdx];
    };

    onLoad(): void {
        this.unsubs.push(
            GlobalEventBus.subscribe(EVT_FOUNDATION_COMPLETED, () => this.onFoundationCompleted())
        );

        // Начальное состояние: клетка закрыта, Spidey грустный
        if (this.cageSprite && this.cageClosedFrame) {
            this.cageSprite.spriteFrame = this.cageClosedFrame;
        }
        if (this.mascotSprite && this.sadFrames.length > 0) {
            this.mascotSprite.spriteFrame = this.sadFrames[0];
        }

        this.schedule(this.tickAnimation, ANIM_INTERVAL);
    }

    onDestroy(): void {
        this.unschedule(this.tickAnimation);
        for (const u of this.unsubs) {
            try { u(); } catch {}
        }
        this.unsubs.length = 0;
    }

    private onFoundationCompleted(): void {
        if (this.openedCount >= TOTAL_LOCKS) return;

        const lockIdx = this.openedCount;
        this.openedCount++;

        this.animateLockOpen(lockIdx);

        // Сбрасываем анимацию на первый кадр нового выражения
        this.frameIdx = 0;
        const frames = this.activeFrames();
        if (this.mascotSprite && frames.length > 0) {
            this.mascotSprite.spriteFrame = frames[0];
        }

        if (this.openedCount >= TOTAL_LOCKS) {
            // Небольшая задержка чтобы анимация замка успела завершиться
            this.scheduleOnce(() => this.openCage(), 0.4);
        }
    }

    private animateLockOpen(idx: number): void {
        const lock = this.lockNodes[idx];
        if (!lock) {
            console.warn(`CageView: lockNodes[${idx}] не назначен в инспекторе`);
            return;
        }

        tween(lock)
            .to(0.12, { scale: new Vec3(1.4, 1.4, 1) }, { easing: 'backOut' })
            .to(0.22, { scale: new Vec3(0, 0, 1) }, { easing: 'quadIn' })
            .call(() => { lock.active = false; })
            .start();
    }

    private openCage(): void {
        if (this.cageSprite && this.cageOpenedFrame) {
            this.cageSprite.spriteFrame = this.cageOpenedFrame;
        }

        // Небольшой bounce для всего узла клетки
        tween(this.node)
            .to(0.1, { scale: new Vec3(1.07, 1.07, 1) }, { easing: 'sineOut' })
            .to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'backIn' })
            .start();
    }

    // 0–1 замков открыто → грустный; 2 → полусчастливый; 3–4 → счастливый
    private activeFrames(): SpriteFrame[] {
        if (this.openedCount <= 1) return this.sadFrames;
        if (this.openedCount <= 2) return this.medHappyFrames;
        return this.happyFrames;
    }
}
