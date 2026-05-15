import { Node, Component, _decorator } from 'cc';

const {ccclass, property} = _decorator;

@ccclass('Draggable')
export abstract class Draggable extends Component {
    abstract canDrag(): boolean;
    abstract setDragPosition(x: number, y: number, offsetX?: number, offsetY?: number): void;
    abstract setDragParent(parent: Node): void;
    abstract resetDragState(): void;
    abstract clearDragState(): void;
}