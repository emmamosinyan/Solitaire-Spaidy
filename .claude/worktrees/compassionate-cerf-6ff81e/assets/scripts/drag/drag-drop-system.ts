import { IEventBus } from 'db://assets/scripts/common/event-bus';
import { EVT_DRAG_CANCEL, EVT_DRAG_END, EVT_DRAG_MOVE, EVT_DRAG_START, EVT_DRAGGABLE_DROP_ATTEMPT, EVT_DRAG_STARTED_WITH_DRAGGABLE, EVT_CTA_SHOWN } from 'db://assets/scripts/common/events';
import type { DragCancelEvent, DragEndEvent, DragMoveEvent, DragStartEvent } from 'db://assets/scripts/common/input-service';
import { Draggable } from 'db://assets/scripts/drag/draggable';
import {Node, Component, Camera, Vec3} from 'cc';


export class DragDropSystem {
    private readonly bus: IEventBus;
    private readonly dragParentObject: Node;
    private readonly camera: Camera;
    private readonly unsubs: Array<() => void> = [];
    private current: Draggable | null = null;
    private dragOffsetX: number = 0;
    private dragOffsetY: number = 0;
    private ctaShown: boolean = false;

    constructor(params: { bus: IEventBus, dragParentObject: Node, camera: Camera }) {
        this.bus = params.bus;
        this.dragParentObject = params.dragParentObject;
        this.camera = params.camera;
    }

    start(): void {
        this.unsubs.push(
            this.bus.subscribe<DragStartEvent>(EVT_DRAG_START, (e) => this.onDragStart(e))
        );
        this.unsubs.push(
            this.bus.subscribe<DragMoveEvent>(EVT_DRAG_MOVE, (e) => this.onDragMove(e))
        );
        this.unsubs.push(
            this.bus.subscribe<DragEndEvent>(EVT_DRAG_END, (e) => this.onDragEnd(e))
        );
        this.unsubs.push(
            this.bus.subscribe<DragCancelEvent>(EVT_DRAG_CANCEL, (e) => this.onDragCancel(e))
        );
        this.unsubs.push(
            this.bus.subscribe(EVT_CTA_SHOWN, () => this.onCTAShown())
        );
    }

    stop(): void {
        for (const u of this.unsubs) {
            try { u(); } catch {}
        }
        this.unsubs.length = 0;
        this.current = null;
    }

    private onDragStart(e: DragStartEvent): void {
        if (this.ctaShown) return; // CTA показан — игнорируем
        if (this.current) return; // уже тянем что-то — игнорируем

        for (const h of e.hits) {
            const iv = h.node.getComponents(Component).find(c => c instanceof Draggable) as Draggable | undefined;
            if (!iv) continue;
            if (iv.canDrag()) {
                this.current = iv;
                
                // Вычисляем offset для конкретного draggable объекта
                const worldPos = iv.node.worldPosition;
                const screenPos = new Vec3();
                this.camera.worldToScreen(worldPos, screenPos);
                
                this.dragOffsetX = screenPos.x - e.startX;
                this.dragOffsetY = screenPos.y - e.startY;
                
                this.current.setDragParent(this.dragParentObject);
                this.current.setDragPosition(e.startX, e.startY, this.dragOffsetX, this.dragOffsetY);
                
                // Публикуем событие о начале перетаскивания с конкретным draggable
                this.bus.publish({
                    type: EVT_DRAG_STARTED_WITH_DRAGGABLE,
                    draggable: this.current
                });
                
                break;
            }
        }
    }

    private onDragMove(e: DragMoveEvent): void {
        if (!this.current) return;
        this.current.setDragPosition(e.x, e.y, this.dragOffsetX, this.dragOffsetY);
    }

    private onDragEnd(e: DragEndEvent): void {
        if (this.current) {
            const filteredHits = e.hits.filter(hit => hit.node !== this.current!.node);
            
            this.bus.publish({
                type: EVT_DRAGGABLE_DROP_ATTEMPT,
                draggable: this.current,
                x: e.x,
                y: e.y,
                hits: filteredHits
            });
        }
        
        this.current = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
    }

    private onDragCancel(_e: DragCancelEvent): void {
        this.current = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
    }

    private onCTAShown(): void {
        this.ctaShown = true;
        console.log('DragDropSystem: CTA показан, система отключена');
    }
}

