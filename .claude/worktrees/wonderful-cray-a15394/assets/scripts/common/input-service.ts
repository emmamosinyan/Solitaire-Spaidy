import { input, Input, EventTouch, Node, UITransform, Vec2 } from 'cc';
import { IEventBus } from 'db://assets/scripts/common/event-bus';
import { EVT_DRAG_CANCEL, EVT_DRAG_END, EVT_DRAG_MOVE, EVT_DRAG_START, EVT_HITTABLE_REGISTER, EVT_HITTABLE_UNREGISTER, EVT_TAP } from 'db://assets/scripts/common/events';

export interface WorldObjectHit {
    id: string;
    node: Node;
}

export interface TapEvent {
    type: 'Tap';
    x: number;
    y: number;
    hits: WorldObjectHit[];
}

export interface DragStartEvent {
    type: 'DragStart';
    startX: number;
    startY: number;
    hits: WorldObjectHit[];
}

export interface DragMoveEvent {
    type: 'DragMove';
    x: number;
    y: number;
}

export interface DragEndEvent {
    type: 'DragEnd';
    x: number;
    y: number;
    hits: WorldObjectHit[];
}

export interface DragCancelEvent {
    type: 'DragCancel';
}

export type InputEvent = TapEvent | DragStartEvent | DragMoveEvent | DragEndEvent | DragCancelEvent;

export interface IInputService {
    start(): void;
    stop(): void;
}

export class InputService implements IInputService {
    private readonly bus: IEventBus;
    private readonly registry: Map<string, { node: Node; } > = new Map();
    private isPointerDown = false;
    private dragStarted = false;
    private startX = 0;
    private startY = 0;
    private startTimeMs = 0;
    private startHits: WorldObjectHit[] = [];
    private busUnsubs: Array<() => void> = [];

    // Thresholds to distinguish Tap vs Drag
    private static readonly HOLD_THRESHOLD_MS = 25;
    private static readonly MOVE_THRESHOLD_PX = 4;

    constructor(params: { bus: IEventBus }) {
        this.bus = params.bus;
    }

    start(): void {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);

        // Listen for hittable registry events
        this.busUnsubs.push(
            this.bus.subscribe(EVT_HITTABLE_REGISTER, (e: any) => {
                const { node } = e;
                if (node) {
                    this.registry.set(node.uuid, { node });
                }
            })
        );
        this.busUnsubs.push(
            this.bus.subscribe(EVT_HITTABLE_UNREGISTER, (e: any) => {
                const { id } = e;
                if (id) this.registry.delete(id);
            })
        );
    }

    stop(): void {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);

        for (const u of this.busUnsubs) {
            try { u(); } catch {}
        }
        this.busUnsubs = [];
        this.registry.clear();
    }

    private onTouchStart(evt: EventTouch): void {
        const loc = evt.getLocation();
        this.isPointerDown = true;
        this.dragStarted = false;
        this.startX = loc.x;
        this.startY = loc.y;
        this.startTimeMs = performance.now();
        this.startHits = this.hitTest(loc.x, loc.y);
    }

    private onTouchMove(evt: EventTouch): void {
        if (!this.isPointerDown) return;
        const loc = evt.getLocation();

        // If drag hasn't started yet, gate by hold + movement thresholds
        if (!this.dragStarted) {
            const elapsed = performance.now() - this.startTimeMs;
            const dx = loc.x - this.startX;
            const dy = loc.y - this.startY;
            const distSq = dx * dx + dy * dy;
            const moveThresholdSq = InputService.MOVE_THRESHOLD_PX * InputService.MOVE_THRESHOLD_PX;

            if (elapsed >= InputService.HOLD_THRESHOLD_MS && distSq >= moveThresholdSq) {
                this.dragStarted = true;
                this.bus.publish<DragStartEvent>({
                    type: EVT_DRAG_START,
                    startX: this.startX,
                    startY: this.startY,
                    hits: this.startHits,
                });
            } else {
                return;
            }
        }

        this.bus.publish<DragMoveEvent>({
            type: EVT_DRAG_MOVE,
            x: loc.x,
            y: loc.y,
        });
    }

    private onTouchEnd(evt: EventTouch): void {
        const loc = evt.getLocation();
        if (!this.isPointerDown) return;

        if (this.dragStarted) {
            const hits = this.hitTest(loc.x, loc.y);
            this.bus.publish<DragEndEvent>({ type: EVT_DRAG_END, x: loc.x, y: loc.y, hits });
        } else {
            const hitsTap = this.hitTest(loc.x, loc.y);
            this.bus.publish<TapEvent>({ type: EVT_TAP, x: loc.x, y: loc.y, hits: hitsTap });
        }

        this.isPointerDown = false;
        this.dragStarted = false;
    }

    private onTouchCancel(): void {
        if (!this.isPointerDown) return;
        if (this.dragStarted) {
            this.bus.publish<DragCancelEvent>({ type: EVT_DRAG_CANCEL });
        }
        this.isPointerDown = false;
        this.dragStarted = false;
    }

    private hitTest(x: number, y: number): WorldObjectHit[] {
        const hits: WorldObjectHit[] = [];
        for (const [id, entry] of this.registry) {
            const ui = entry.node.getComponent(UITransform);
            if (!ui) continue;
            if (ui.hitTest(new Vec2(x, y))) {
                hits.push({id, node: entry.node});
            }
        }
        
        // Сортируем хиты: сначала по z-позиции, потом по siblingIndex (UI иерархии)
        hits.sort((a, b) => {
            // Первый критерий: z-позиция (большие z идут первыми)
            const zDiff = b.node.position.z - a.node.position.z;
            if (Math.abs(zDiff) > 0.01) { // если z отличается значительно
                return zDiff;
            }
            
            // Второй критерий: siblingIndex в UI иерархии (больший индекс = выше в UI)
            return b.node.getSiblingIndex() - a.node.getSiblingIndex();
        });
        
        return hits;
    }
}


