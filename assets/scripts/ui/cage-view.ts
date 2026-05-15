import { _decorator, Component, Sprite, SpriteFrame, Node, Vec3, tween, Prefab, instantiate, UITransform, UIOpacity } from 'cc';
import { GlobalEventBus } from 'db://assets/scripts/common/event-bus';
import { EVT_CARD_MOVED, EVT_MOVES_TARGET_REACHED } from 'db://assets/scripts/common/events';

const { ccclass, property } = _decorator;

const TOTAL_LOCKS = 4;
const ANIM_INTERVAL = 0.45;

/**
 * Отображение клетки со Spidey.
 * Каждые movesPerLock успешных ходов открывают один замок.
 * После 4 замков — клетка открывается и через 2 секунды показывается экран победы.
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

    @property({ type: [SpriteFrame], tooltip: 'Кадры грустного Spidey — кадры 7 и 8' })
    private sadFrames: SpriteFrame[] = [];

    @property({ type: [SpriteFrame], tooltip: 'Кадры Spidey начинающего радоваться — кадры 5 и 6' })
    private medHappyFrames: SpriteFrame[] = [];

    @property({ type: [SpriteFrame], tooltip: 'Кадры счастливого Spidey — кадры 1 и 2' })
    private happyFrames: SpriteFrame[] = [];

    @property({ type: [Node], tooltip: '4 узла замков' })
    private lockNodes: Node[] = [];

    @property({ type: SpriteFrame, tooltip: 'Спрайт закрытого замка' })
    private lockClosedFrame: SpriteFrame = null!;

    @property({ type: SpriteFrame, tooltip: 'Спрайт открытого замка' })
    private lockOpenedFrame: SpriteFrame = null!;

    @property({ type: SpriteFrame, tooltip: 'Спрайт вспышки при открытии замка — назначь burst.png' })
    private lockBurstFrame: SpriteFrame = null!;

    @property(Sprite)
    private messageSprite: Sprite = null!;

    @property({ type: SpriteFrame, tooltip: 'help_message.png — начальное сообщение' })
    private helpMessageFrame: SpriteFrame = null!;

    @property({ type: SpriteFrame, tooltip: 'keep_going_message.png — после 2 замков' })
    private keepGoingMessageFrame: SpriteFrame = null!;

    @property({ type: SpriteFrame, tooltip: 'free_message.png — после всех 4 замков' })
    private freeMessageFrame: SpriteFrame = null!;

    @property({ type: [SpriteFrame], tooltip: '3 кадра конфетти — confetti.png (кадры от маленького к большому)' })
    private confettiFrames: SpriteFrame[] = [];

    @property({ tooltip: 'Сколько успешных ходов нужно для открытия одного замка' })
    private movesPerLock: number = 2;

    @property({ tooltip: 'Смещение по X для medHappy кадра (вправо = положительное)' })
    private medHappyOffsetX: number = 0;

    @property({ tooltip: 'Смещение по X для happy кадра (вправо = положительное)' })
    private happyOffsetX: number = 0;

    @property({ tooltip: 'Смещение конфетти по X от позиции персонажа (вправо = положительное)' })
    private confettiOffsetX: number = 500;

    @property({ tooltip: 'Смещение конфетти по Y от позиции персонажа (вверх = положительное)' })
    private confettiOffsetY: number = 1850;

    private openedCount: number = 0;
    private moveCount: number = 0;
    private frameIdx: number = 0;
    private unsubs: Array<() => void> = [];
    private mascotBaseX: number = 0;

    private readonly tickAnimation = (): void => {
        const frames = this.activeFrames();
        if (!this.mascotSprite || frames.length < 2) return;
        this.frameIdx = (this.frameIdx + 1) % frames.length;
        this.mascotSprite.spriteFrame = frames[this.frameIdx];
    };

    onLoad(): void {
        this.unsubs.push(
            GlobalEventBus.subscribe(EVT_CARD_MOVED, () => this.onSuccessfulMove())
        );

        if (this.cageSprite && this.cageClosedFrame) {
            this.cageSprite.spriteFrame = this.cageClosedFrame;
        }
        if (this.mascotSprite && this.sadFrames.length > 0) {
            this.mascotSprite.spriteFrame = this.sadFrames[0];
            this.mascotBaseX = this.mascotSprite.node.position.x;
        }
        if (this.messageSprite && this.helpMessageFrame) {
            this.messageSprite.spriteFrame = this.helpMessageFrame;
        }

        for (const lock of this.lockNodes) {
            if (!lock) continue;
            const sprite = lock.getComponent(Sprite);
            if (sprite && this.lockClosedFrame) {
                sprite.spriteFrame = this.lockClosedFrame;
            }
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

    private onSuccessfulMove(): void {
        if (this.openedCount >= TOTAL_LOCKS) return;

        this.moveCount++;

        if (this.moveCount % this.movesPerLock === 0) {
            this.openNextLock();
        }
    }

    private openNextLock(): void {
        const lockIdx = this.openedCount;
        this.openedCount++;

        this.animateLockOpen(lockIdx);

        // Сбрасываем анимацию на первый кадр нового выражения
        this.frameIdx = 0;
        const frames = this.activeFrames();
        if (this.mascotSprite && frames.length > 0) {
            this.mascotSprite.spriteFrame = frames[0];
            const offsetX = this.openedCount >= TOTAL_LOCKS ? this.happyOffsetX
                : (this.openedCount >= 2 ? this.medHappyOffsetX : 0);
            const pos = this.mascotSprite.node.position;
            this.mascotSprite.node.setPosition(this.mascotBaseX + offsetX, pos.y, pos.z);
        }

        this.updateMessage();

        if (this.openedCount >= TOTAL_LOCKS) {
            this.scheduleOnce(() => this.openCage(), 0.4);
        }
    }

    private spawnConfetti(): void {
        if (this.confettiFrames.length === 0) return;

        const parent = this.node.parent ?? this.node;
        const count = 12;

        for (let i = 0; i < count; i++) {
            // Случайная задержка чтобы конфетти появлялись волнами
            this.scheduleOnce(() => {
                const piece = new Node('Confetti');
                parent.addChild(piece);
                piece.layer = this.node.layer;
                piece.setSiblingIndex(parent.children.length - 1);

                // Конфетти над головой персонажа
                const refPos = this.mascotSprite ? this.mascotSprite.node.worldPosition : this.node.worldPosition;
                const randX = refPos.x + this.confettiOffsetX + (Math.random() - 0.5) * 100;
                const randY = refPos.y + this.confettiOffsetY + Math.random() * 80;
                piece.setWorldPosition(randX, randY, 0);
                piece.setScale(0.5 + Math.random() * 0.8, 0.5 + Math.random() * 0.8, 1);

                const transform = piece.addComponent(UITransform);
                transform.setContentSize(80, 80);

                const sprite = piece.addComponent(Sprite);
                sprite.spriteFrame = this.confettiFrames[0];
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;

                const opacity = piece.addComponent(UIOpacity);
                opacity.opacity = 255;

                // Цикл по 3 кадрам
                let frameIdx = 0;
                const frameInterval = 0.1;
                const advance = () => {
                    frameIdx++;
                    if (frameIdx < this.confettiFrames.length) {
                        sprite.spriteFrame = this.confettiFrames[frameIdx];
                        this.scheduleOnce(advance, frameInterval);
                    }
                };
                this.scheduleOnce(advance, frameInterval);

                // Фейд аут после показа всех кадров
                tween(opacity)
                    .delay(this.confettiFrames.length * frameInterval)
                    .to(0.4, { opacity: 0 }, { easing: 'sineIn' })
                    .call(() => { if (piece && piece.isValid) piece.destroy(); })
                    .start();

            }, i * 0.08);
        }
    }

    private updateMessage(): void {
        if (!this.messageSprite) return;

        let frame: SpriteFrame | null = null;
        if (this.openedCount >= TOTAL_LOCKS) {
            frame = this.freeMessageFrame;
        } else if (this.openedCount >= 2) {
            frame = this.keepGoingMessageFrame;
        } else {
            frame = this.helpMessageFrame;
        }

        if (frame) {
            this.messageSprite.spriteFrame = frame;
        }
    }

    private animateLockOpen(idx: number): void {
        const lock = this.lockNodes[idx];
        if (!lock) {
            console.warn(`CageView: lockNodes[${idx}] не назначен в инспекторе`);
            return;
        }

        const sprite = lock.getComponent(Sprite);
        const lockOpacity = lock.getComponent(UIOpacity) ?? lock.addComponent(UIOpacity);
        const originalScale = lock.scale.clone();
        // Снимаем мировую позицию до старта анимации, чтобы burst попал точно в центр замка
        const lockWorldPos = lock.worldPosition.clone();

        tween(lock)
            .to(0.12, { scale: new Vec3(originalScale.x * 1.4, originalScale.y * 1.4, 1) }, { easing: 'backOut' })
            .call(() => {
                if (sprite && this.lockOpenedFrame) {
                    sprite.spriteFrame = this.lockOpenedFrame;
                }
                this.spawnLockEffect(lockWorldPos);
            })
            .to(0.18, { scale: originalScale }, { easing: 'backIn' })
            .call(() => {
                // Замок исчезает через 0.6 с после открытия — уменьшается и фейдится
                this.scheduleOnce(() => {
                    tween(lock)
                        .to(0.25, { scale: new Vec3(originalScale.x * 1.3, originalScale.y * 1.3, 1) }, { easing: 'backOut' })
                        .to(0.3, { scale: Vec3.ZERO }, { easing: 'sineIn' })
                        .call(() => { lock.active = false; })
                        .start();
                    tween(lockOpacity)
                        .delay(0.15)
                        .to(0.4, { opacity: 0 }, { easing: 'sineIn' })
                        .start();
                }, 0.6);
            })
            .start();
    }

    private spawnLockEffect(worldPos: Vec3): void {
        if (!this.lockBurstFrame) return;

        // Создаём узел эффекта вручную
        const effect = new Node('LockBurst');
        const parent = this.node.parent ?? this.node;
        parent.addChild(effect);
        effect.layer = this.node.layer;
        effect.setSiblingIndex(parent.children.length - 1);
        effect.setWorldPosition(worldPos);

        // UITransform нужен чтобы Sprite отображался
        const transform = effect.addComponent(UITransform);
        transform.setContentSize(200, 200);

        // Sprite с burst изображением
        const sprite = effect.addComponent(Sprite);
        sprite.spriteFrame = this.lockBurstFrame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;

        // UIOpacity для анимации прозрачности
        const opacity = effect.addComponent(UIOpacity);
        opacity.opacity = 255;

        // Анимация: вырастает и исчезает
        effect.setScale(0.2, 0.2, 1);
        tween(effect)
            .to(0.2, { scale: new Vec3(1.3, 1.3, 1) }, { easing: 'backOut' })
            .to(0.3, { scale: new Vec3(1.6, 1.6, 1) }, { easing: 'sineIn' })
            .start();
        tween(opacity)
            .delay(0.15)
            .to(0.35, { opacity: 0 }, { easing: 'sineIn' })
            .call(() => { if (effect && effect.isValid) effect.destroy(); })
            .start();
    }

    private exitMascotFromCage(): void {
        if (!this.mascotSprite) return;

        const mascotNode = this.mascotSprite.node;
        const originalScale = mascotNode.scale.clone();
        const originalPos = mascotNode.position.clone();

        // Поднимаем маскота поверх клетки — перемещаем в конец списка дочерних узлов родителя
        const parent = mascotNode.parent;
        if (parent) {
            mascotNode.setParent(parent, true); // keepWorldTransform = true
            mascotNode.setSiblingIndex(parent.children.length - 1);
        }

        // Поднимаем сообщение "Im free" поверх маскота
        if (this.messageSprite) {
            const msgNode = this.messageSprite.node;
            const msgParent = msgNode.parent;
            if (msgParent) {
                msgNode.setParent(msgParent, true);
                msgNode.setSiblingIndex(msgParent.children.length - 1);
            }
        }

        // Анимация выхода: небольшая задержка → вылетает вперёд (масштаб + смещение вниз-вперёд)
        tween(mascotNode)
            .delay(0.15)
            .to(0.25, { scale: new Vec3(originalScale.x * 1.25, originalScale.y * 1.25, 1) }, { easing: 'backOut' })
            .to(0.2, { scale: new Vec3(originalScale.x * 1.15, originalScale.y * 1.15, 1) }, { easing: 'sineOut' })
            .start();

        // Небольшой прыжок вверх и обратно
        tween(mascotNode)
            .delay(0.15)
            .by(0.2, { position: new Vec3(0, 40, 0) }, { easing: 'sineOut' })
            .by(0.25, { position: new Vec3(0, -40, 0) }, { easing: 'bounceOut' })
            .start();
    }

    private openCage(): void {
        if (this.cageSprite && this.cageOpenedFrame) {
            this.cageSprite.spriteFrame = this.cageOpenedFrame;
        }

        tween(this.node)
            .to(0.1, { scale: new Vec3(1.07, 1.07, 1) }, { easing: 'sineOut' })
            .to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'backIn' })
            .start();

        this.exitMascotFromCage();
        this.spawnConfetti();

        // Через 2 секунды показываем экран победы
        this.scheduleOnce(() => {
            GlobalEventBus.publish({ type: EVT_MOVES_TARGET_REACHED, moves: 4, target: 4 });
        }, 2);
    }

    // 0–1 замков → грустный; 2–3 замка → полусчастливый; 4 замка → счастливый
    private activeFrames(): SpriteFrame[] {
        if (this.openedCount <= 1) return this.sadFrames;
        if (this.openedCount < TOTAL_LOCKS) return this.medHappyFrames;
        return this.happyFrames;
    }
}
