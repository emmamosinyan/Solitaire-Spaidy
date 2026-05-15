import { _decorator, Component, Node, Widget, view, UITransform, Layout, Size, UIOpacity, tween } from 'cc';
import { GlobalEventBus } from 'db://assets/scripts/common/event-bus';
import { EVT_LAYOUT_REBUILT } from 'db://assets/scripts/common/events';

const { ccclass, property } = _decorator;

@ccclass('LayoutController')
export class LayoutController extends Component {
    @property({ type: Node })
    private gameplayContainer?: Node;

    @property({ type: Node })
    private logoWidget?: Node;

    @property({ type: Node })
    private playNowWidget?: Node;

    @property({ type: UITransform, tooltip: 'Фон для масштабирования под разрешение экрана' })
    private background?: UITransform;

    @property({ tooltip: 'Дополнительный множитель масштаба фона в landscape (1 = без изменений)' })
    private landscapeBackgroundScale: number = 1;

    @property({ type: [Node] })
    private landscapeScaleElements: Node[] = [];

    @property({ type: [Node] })
    private landscapeRotateElements: Node[] = [];

    @property(Layout)
    private tableauLayout?: Layout;

    @property(Layout)
    private foundationLayout?: Layout;

    @property(Layout)
    private stockWasteLayout?: Layout;

    @property(UIOpacity)
    private parentOpacity?: UIOpacity;

    // === Landscape позиции ===

    @property({ tooltip: 'Logo — отступ сверху в landscape' })
    private logoLandscapeTop: number = 100;

    @property({ tooltip: 'Logo — отступ слева в landscape' })
    private logoLandscapeLeft: number = 70;

    @property({ tooltip: 'Logo — масштаб в landscape (1 = без изменений)' })
    private logoLandscapeScale: number = 1;

    @property({ type: Node, tooltip: 'Прогресс-бар / счёт' })
    private progressBarWidget?: Node;

    @property({ tooltip: 'Progress Bar — отступ сверху в landscape' })
    private progressBarLandscapeTop: number = 100;

    @property({ tooltip: 'Progress Bar — отступ слева в landscape' })
    private progressBarLandscapeLeft: number = 70;

    @property({ tooltip: 'Progress Bar — масштаб в landscape (1 = без изменений)' })
    private progressBarLandscapeScale: number = 1;

    @property({ tooltip: 'Play Now — отступ сверху в landscape' })
    private playNowLandscapeTop: number = 100;

    @property({ tooltip: 'Play Now — отступ справа в landscape' })
    private playNowLandscapeRight: number = 70;

    @property({ tooltip: 'Play Now — масштаб в landscape (1 = без изменений)' })
    private playNowLandscapeScale: number = 1;

    @property({ type: Node, tooltip: 'CageWidget — родительский узел клетки, персонажа и замков' })
    private cageWidget?: Node;

    @property({ tooltip: 'CageWidget — отступ сверху в landscape' })
    private cageLandscapeTop: number = 60;

    @property({ tooltip: 'CageWidget — отступ справа в landscape' })
    private cageLandscapeRight: number = 60;

    @property({ tooltip: 'CageWidget — масштаб в landscape (1 = без изменений)' })
    private cageLandscapeScale: number = 0.5;

    @property({ type: Node, tooltip: 'ExplainerMessage — объясняющее сообщение' })
    private explainerMessage?: Node;

    @property({ tooltip: 'ExplainerMessage — отступ сверху в landscape' })
    private explainerMessageLandscapeTop: number = 100;

    @property({ tooltip: 'ExplainerMessage — отступ слева в landscape' })
    private explainerMessageLandscapeLeft: number = 70;

    @property({ tooltip: 'ExplainerMessage — масштаб в landscape (1 = без изменений)' })
    private explainerMessageLandscapeScale: number = 1;

    @property({ type: Node, tooltip: 'ExplainerMessage-001 — второе объясняющее сообщение' })
    private explainerMessage001?: Node;

    @property({ tooltip: 'ExplainerMessage-001 — отступ сверху в landscape' })
    private explainerMessage001LandscapeTop: number = 100;

    @property({ tooltip: 'ExplainerMessage-001 — отступ слева в landscape' })
    private explainerMessage001LandscapeLeft: number = 70;

    @property({ tooltip: 'ExplainerMessage-001 — масштаб в landscape (1 = без изменений)' })
    private explainerMessage001LandscapeScale: number = 1;

    // Private properties
    private currentOrientation: 'portrait' | 'landscape' = 'portrait';
    private onResizeCallback?: () => void;
    private resizeDebounceTimer?: number;
    private gameplayContainerWidget?: Widget;
    private logoWidgetComponent?: Widget;
    private playNowWidgetComponent?: Widget;
    private tableauLayoutWidget?: Widget;
    private foundationLayoutWidget?: Widget;
    private stockWasteLayoutWidget?: Widget;
    private progressBarWidgetComponent?: Widget;
    private cageWidgetComponent?: Widget;
    private explainerMessageWidgetComponent?: Widget;
    private explainerMessage001WidgetComponent?: Widget;
    private logoPortraitScale: number = 1;
    private playNowPortraitScale: number = 1;
    private progressBarPortraitScale: number = 1;
    private cagePortraitScale: number = 1;
    private explainerMessagePortraitScale: number = 1;
    private explainerMessage001PortraitScale: number = 1;
    private baselineCardStackWidth: number = 0;
    private baselineCardStackHeight: number = 0;
    private isInitialSetup: boolean = true;
    private backgroundOriginalWidth: number = 0;
    private backgroundOriginalHeight: number = 0;

    onLoad() {
        this.initializeWidgets();
        this.storeBaselineCardStackSize();
        this.storeBackgroundOriginalSize();
        this.startOrientationTracking();

        // Применяем начальную настройку layout'а для текущей ориентации
        this.scheduleOnce(() => {
            this.scaleBackground();
            this.setupGameplayContainerScaling();
        }, 0);
    }

    onDestroy() {
        this.stopOrientationTracking();
        this.clearWidgetReferences();
    }

    /**
     * Инициализирует Widget компоненты для всех layout элементов
     */
    private initializeWidgets(): void {
        // Инициализируем Widget для gameplayContainer
        if (this.gameplayContainer) {
            this.gameplayContainerWidget = this.gameplayContainer.getComponent(Widget);
            if (!this.gameplayContainerWidget) {
                this.gameplayContainerWidget = this.gameplayContainer.addComponent(Widget);
            }
        }

        // Инициализируем Widget для logoWidget
        if (this.logoWidget) {
            this.logoWidgetComponent = this.logoWidget.getComponent(Widget);
            if (!this.logoWidgetComponent) {
                this.logoWidgetComponent = this.logoWidget.addComponent(Widget);
            }
            this.logoPortraitScale = this.logoWidget.scale.x;
        }

        // Инициализируем Widget для playNowWidget
        if (this.playNowWidget) {
            this.playNowWidgetComponent = this.playNowWidget.getComponent(Widget);
            if (!this.playNowWidgetComponent) {
                this.playNowWidgetComponent = this.playNowWidget.addComponent(Widget);
            }
            this.playNowPortraitScale = this.playNowWidget.scale.x;
        }

        // Для progressBarWidget сохраняем только масштаб — Widget добавляется лениво при первом landscape
        if (this.progressBarWidget) {
            this.progressBarPortraitScale = this.progressBarWidget.scale.x;
        }

        // Инициализируем Widget для tableauLayout
        if (this.tableauLayout) {
            this.tableauLayoutWidget = this.tableauLayout.getComponent(Widget);
            if (!this.tableauLayoutWidget) {
                this.tableauLayoutWidget = this.tableauLayout.addComponent(Widget);
            }
        }

        // Инициализируем Widget для foundationLayout
        if (this.foundationLayout) {
            this.foundationLayoutWidget = this.foundationLayout.getComponent(Widget);
            if (!this.foundationLayoutWidget) {
                this.foundationLayoutWidget = this.foundationLayout.addComponent(Widget);
            }
        }

        // Инициализируем Widget для stockWasteLayout
        if (this.stockWasteLayout) {
            this.stockWasteLayoutWidget = this.stockWasteLayout.getComponent(Widget);
            if (!this.stockWasteLayoutWidget) {
                this.stockWasteLayoutWidget = this.stockWasteLayout.addComponent(Widget);
            }
        }

        // Для cageWidget сохраняем только масштаб — Widget добавляется лениво при первом landscape
        if (this.cageWidget) {
            this.cagePortraitScale = this.cageWidget.scale.x;
        }

        // Для explainerMessage сохраняем только масштаб — Widget добавляется лениво при первом landscape
        if (this.explainerMessage) {
            this.explainerMessagePortraitScale = this.explainerMessage.scale.x;
        }

        // Для explainerMessage001 сохраняем только масштаб — Widget добавляется лениво при первом landscape
        if (this.explainerMessage001) {
            this.explainerMessage001PortraitScale = this.explainerMessage001.scale.x;
        }
    }

    /**
     * Очищает ссылки на Widget'ы
     */
    private clearWidgetReferences(): void {
        this.gameplayContainerWidget = undefined;
        this.logoWidgetComponent = undefined;
        this.playNowWidgetComponent = undefined;
        this.tableauLayoutWidget = undefined;
        this.foundationLayoutWidget = undefined;
        this.stockWasteLayoutWidget = undefined;
        this.progressBarWidgetComponent = undefined;
        this.cageWidgetComponent = undefined;
        this.explainerMessageWidgetComponent = undefined;
        this.explainerMessage001WidgetComponent = undefined;
    }

    /**
     * Сохраняет эталонный размер CardStack при загрузке
     */
    private storeBaselineCardStackSize(): void {
        // Получаем эталонный размер из первого найденного layout
        const layouts = [this.tableauLayout, this.foundationLayout, this.stockWasteLayout].filter(Boolean);

        if (layouts.length > 0) {
            const firstLayout = layouts[0]!;
            if (firstLayout.cellSize) {
                this.baselineCardStackWidth = firstLayout.cellSize.width;
                this.baselineCardStackHeight = firstLayout.cellSize.height;
            }
        }
    }

    /**
     * Сохраняет оригинальный размер background при загрузке
     */
    private storeBackgroundOriginalSize(): void {
        if (this.background) {
            this.backgroundOriginalWidth = this.background.width;
            this.backgroundOriginalHeight = this.background.height;
        }
    }

    /**
     * Запускает отслеживание изменения ориентации
     */
    private startOrientationTracking(): void {
        this.onResizeCallback = () => {
            // Масштабируем background НЕМЕДЛЕННО, вне debounce механизма
            this.scaleBackground();

            if (!this.isInitialSetup) {
                this.hideUI();
            }

            // Очищаем предыдущий таймер, если он существует
            if (this.resizeDebounceTimer !== undefined) {
                clearTimeout(this.resizeDebounceTimer);
            }

            // Устанавливаем новый таймер на 150мс
            this.resizeDebounceTimer = setTimeout(() => {
                this.checkOrientationChange();
                this.resizeDebounceTimer = undefined;
            }, 150) as any;
        };

        view.on('canvas-resize', this.onResizeCallback, this);
    }

    /**
     * Останавливает отслеживание изменения ориентации
     */
    private stopOrientationTracking(): void {
        // Очищаем debounce таймер при остановке отслеживания
        if (this.resizeDebounceTimer !== undefined) {
            clearTimeout(this.resizeDebounceTimer);
            this.resizeDebounceTimer = undefined;
        }

        if (this.onResizeCallback) {
            view.off('canvas-resize', this.onResizeCallback, this);
            this.onResizeCallback = undefined;
        }
    }

    /**
     * Проверяет изменение ориентации и применяет трансформации
     */
    private checkOrientationChange(): void {
        const visibleSize = view.getVisibleSize();
        const newOrientation: 'portrait' | 'landscape' = visibleSize.height > visibleSize.width ? 'portrait' : 'landscape';
        this.showUI();

        if (newOrientation !== this.currentOrientation) {
            this.currentOrientation = newOrientation;
            this.setupGameplayContainerScaling();
        }
    }

    /**
     * Скрывает UI (устанавливает opacity в 0)
     */
    private hideUI(): void {
        if (this.parentOpacity) {
            this.parentOpacity.opacity = 0;
        }
    }

    /**
     * Показывает UI с плавным fade in эффектом
     */
    private showUI(): void {
        if (this.parentOpacity && this.parentOpacity.opacity !== 255) {
            tween(this.parentOpacity)
                .to(0.2, { opacity: 255 })
                .start();
        }
    }

    /**
     * Настраивает масштабирование gameplayContainer в зависимости от ориентации экрана
     */
    private setupGameplayContainerScaling(): void {
        // Скрываем UI в начале перестройки (кроме первого запуска)
        if (!this.isInitialSetup) {
            this.hideUI();
        }

        const visibleSize = view.getVisibleSize();
        const isPortrait = visibleSize.height > visibleSize.width;

        this.currentOrientation = isPortrait ? 'portrait' : 'landscape';

        this.applyTransformations(isPortrait);
        this.setupGameplayContainerWidget(isPortrait);
        this.setupLogoWidget(isPortrait);
        this.setupProgressBarWidget(isPortrait);
        this.setupPlayNowWidget(isPortrait);
        this.setupCageWidget(isPortrait);
        this.setupExplainerMessageWidget(isPortrait);
        this.setupExplainerMessage001Widget(isPortrait);

        this.scheduleOnce(() => {
            this.resizeCardStacks(isPortrait);
        }, 0);

        // Показываем UI после завершения всех операций (кроме первого запуска)
        if (!this.isInitialSetup) {
            this.scheduleOnce(() => {
                // Публикуем событие о завершении перестройки ДО fade in
                GlobalEventBus.publish({ type: EVT_LAYOUT_REBUILT });
                this.showUI();
            }, 0.1); // 0.02 (максимальная задержка в resizeCardStacks) + 0.08 буфер
        }

        // После первой настройки разрешаем скрывать UI и публикуем событие
        if (this.isInitialSetup) {
            // Для первоначальной настройки публикуем событие после максимальной задержки
            this.scheduleOnce(() => {
                GlobalEventBus.publish({ type: EVT_LAYOUT_REBUILT });
            }, 0.15); // Чуть больше максимальной задержки в resizeCardStacks (0.02)
        }
        this.isInitialSetup = false;
    }

    /**
     * Применяет трансформации (scale/rotate) к элементам
     */
    private applyTransformations(isPortrait: boolean): void {
        // Настраиваем дополнительные элементы для landscape масштабирования
        if (this.landscapeScaleElements.length > 0) {
            if (isPortrait) {
                this.landscapeScaleElements.forEach((element) => {
                    if (element) {
                        element.setScale(1, 1, 1);
                    }
                });
            } else {
                this.landscapeScaleElements.forEach((element) => {
                    if (element) {
                        element.setScale(2, 2, 1);
                    }
                });
            }
        }

        // Настраиваем элементы для поворота в landscape режиме
        if (this.landscapeRotateElements.length > 0) {
            if (isPortrait) {
                this.landscapeRotateElements.forEach((element) => {
                    if (element) {
                        element.setRotationFromEuler(0, 0, 0);
                    }
                });
            } else {
                this.landscapeRotateElements.forEach((element) => {
                    if (element) {
                        element.setRotationFromEuler(0, 0, 90);
                    }
                });
            }
        }
    }

    /**
     * Настраивает Widget для gameplayContainer
     */
    private setupGameplayContainerWidget(isPortrait: boolean): void {
        if (this.gameplayContainer && this.gameplayContainerWidget) {
            const containerTransform = this.gameplayContainer.getComponent(UITransform);

            if (isPortrait) {
                // Portrait: растягиваем на ширину экрана с отступом сверху 550
                this.gameplayContainerWidget.isAlignTop = true;
                this.gameplayContainerWidget.isAlignBottom = true;
                this.gameplayContainerWidget.isAlignLeft = true;
                this.gameplayContainerWidget.isAlignRight = true;
                this.gameplayContainerWidget.isAlignHorizontalCenter = false;
                this.gameplayContainerWidget.top = 550;
                this.gameplayContainerWidget.left = 0;
                this.gameplayContainerWidget.right = 0;
                this.gameplayContainerWidget.bottom = 0;

                this.gameplayContainer.setScale(1, 1, 1);
                this.gameplayContainerWidget.updateAlignment();
            } else {
                // Landscape: устанавливаем фиксированную ширину и центрируем
                if (containerTransform) {
                    containerTransform.width = 1080;
                }

                this.gameplayContainerWidget.isAlignTop = true;
                this.gameplayContainerWidget.isAlignBottom = true;
                this.gameplayContainerWidget.isAlignLeft = false;
                this.gameplayContainerWidget.isAlignRight = false;
                this.gameplayContainerWidget.isAlignHorizontalCenter = true;
                this.gameplayContainerWidget.top = 0;
                this.gameplayContainerWidget.bottom = 0;
                this.gameplayContainerWidget.horizontalCenter = 0;

                this.gameplayContainerWidget.updateAlignment();
                this.gameplayContainer.setScale(2, 2, 1);
            }
        }
    }

    /**
     * Настраивает Widget для logoWidget
     */
    private setupLogoWidget(isPortrait: boolean): void {
        if (this.logoWidget && this.logoWidgetComponent) {
            if (isPortrait) {
                // Portrait: по центру сверху
                this.logoWidgetComponent.isAlignTop = true;
                this.logoWidgetComponent.isAlignBottom = false;
                this.logoWidgetComponent.isAlignLeft = true;
                this.logoWidgetComponent.isAlignRight = false;
                this.logoWidgetComponent.isAlignHorizontalCenter = false;
                this.logoWidgetComponent.isAlignVerticalCenter = false;
                this.logoWidgetComponent.top = 100;
                this.logoWidgetComponent.left = 50;
                this.logoWidgetComponent.updateAlignment();
                this.logoWidget.setScale(this.logoPortraitScale, this.logoPortraitScale, 1);
            } else {
                // Landscape: позиция из инспектора
                this.logoWidgetComponent.isAlignTop = true;
                this.logoWidgetComponent.isAlignBottom = false;
                this.logoWidgetComponent.isAlignLeft = true;
                this.logoWidgetComponent.isAlignRight = false;
                this.logoWidgetComponent.isAlignHorizontalCenter = false;
                this.logoWidgetComponent.isAlignVerticalCenter = false;
                this.logoWidgetComponent.top = this.logoLandscapeTop;
                this.logoWidgetComponent.left = this.logoLandscapeLeft;
                this.logoWidgetComponent.updateAlignment();
                this.logoWidget.setScale(this.logoLandscapeScale, this.logoLandscapeScale, 1);
            }
        }
    }

    /**
     * Настраивает Widget для playNowWidget
     */
    private setupPlayNowWidget(isPortrait: boolean): void {
        if (this.playNowWidget && this.playNowWidgetComponent) {
            if (isPortrait) {
                // Portrait: снизу в середине с отступом снизу 100
                this.playNowWidgetComponent.isAlignTop = false;
                this.playNowWidgetComponent.isAlignBottom = true;
                this.playNowWidgetComponent.isAlignLeft = false;
                this.playNowWidgetComponent.isAlignRight = false;
                this.playNowWidgetComponent.isAlignHorizontalCenter = true;
                this.playNowWidgetComponent.isAlignVerticalCenter = false;
                this.playNowWidgetComponent.bottom = 200;
                this.playNowWidgetComponent.horizontalCenter = 0;
                this.playNowWidgetComponent.updateAlignment();
                this.playNowWidget.setScale(this.playNowPortraitScale, this.playNowPortraitScale, 1);
            } else {
                // Landscape: позиция из инспектора
                this.playNowWidgetComponent.isAlignTop = true;
                this.playNowWidgetComponent.isAlignBottom = false;
                this.playNowWidgetComponent.isAlignLeft = false;
                this.playNowWidgetComponent.isAlignRight = true;
                this.playNowWidgetComponent.isAlignHorizontalCenter = false;
                this.playNowWidgetComponent.isAlignVerticalCenter = false;
                this.playNowWidgetComponent.top = this.playNowLandscapeTop;
                this.playNowWidgetComponent.right = this.playNowLandscapeRight;
                this.playNowWidgetComponent.updateAlignment();
                this.playNowWidget.setScale(this.playNowLandscapeScale, this.playNowLandscapeScale, 1);
            }
        }
    }

    /**
     * Настраивает Widget для progressBarWidget
     */
    private setupProgressBarWidget(isPortrait: boolean): void {
        if (!this.progressBarWidget) return;

        if (isPortrait) {
            if (this.progressBarWidgetComponent) {
                this.progressBarWidgetComponent.enabled = false;
            }
            this.progressBarWidget.setScale(this.progressBarPortraitScale, this.progressBarPortraitScale, 1);
        } else {
            if (!this.progressBarWidgetComponent) {
                this.progressBarWidgetComponent = this.progressBarWidget.getComponent(Widget) ?? this.progressBarWidget.addComponent(Widget);
            }
            this.progressBarWidgetComponent.enabled = true;
            this.progressBarWidgetComponent.isAlignTop = true;
            this.progressBarWidgetComponent.isAlignBottom = false;
            this.progressBarWidgetComponent.isAlignLeft = true;
            this.progressBarWidgetComponent.isAlignRight = false;
            this.progressBarWidgetComponent.isAlignHorizontalCenter = false;
            this.progressBarWidgetComponent.isAlignVerticalCenter = false;
            this.progressBarWidgetComponent.top = this.progressBarLandscapeTop;
            this.progressBarWidgetComponent.left = this.progressBarLandscapeLeft;
            this.progressBarWidgetComponent.updateAlignment();
            this.progressBarWidget.setScale(this.progressBarLandscapeScale, this.progressBarLandscapeScale, 1);
        }
    }

    /**
     * Настраивает Widget для cageWidget
     */
    private setupCageWidget(isPortrait: boolean): void {
        if (!this.cageWidget) return;

        if (isPortrait) {
            // Portrait: отключаем Widget если он уже создан, восстанавливаем масштаб
            if (this.cageWidgetComponent) {
                this.cageWidgetComponent.enabled = false;
            }
            this.cageWidget.setScale(this.cagePortraitScale, this.cagePortraitScale, 1);
        } else {
            // Landscape: лениво создаём Widget при первом переходе, правый верхний угол
            if (!this.cageWidgetComponent) {
                this.cageWidgetComponent = this.cageWidget.getComponent(Widget) ?? this.cageWidget.addComponent(Widget);
            }
            this.cageWidgetComponent.enabled = true;
            this.cageWidgetComponent.isAlignTop = true;
            this.cageWidgetComponent.isAlignBottom = false;
            this.cageWidgetComponent.isAlignLeft = false;
            this.cageWidgetComponent.isAlignRight = true;
            this.cageWidgetComponent.isAlignHorizontalCenter = false;
            this.cageWidgetComponent.isAlignVerticalCenter = false;
            this.cageWidgetComponent.top = this.cageLandscapeTop;
            this.cageWidgetComponent.right = this.cageLandscapeRight;
            this.cageWidgetComponent.updateAlignment();
            this.cageWidget.setScale(this.cageLandscapeScale, this.cageLandscapeScale, 1);
        }
    }

    /**
     * Настраивает Widget для explainerMessage
     */
    private setupExplainerMessageWidget(isPortrait: boolean): void {
        if (!this.explainerMessage) return;

        if (isPortrait) {
            if (this.explainerMessageWidgetComponent) {
                this.explainerMessageWidgetComponent.enabled = false;
            }
            this.explainerMessage.setScale(this.explainerMessagePortraitScale, this.explainerMessagePortraitScale, 1);
        } else {
            if (!this.explainerMessageWidgetComponent) {
                this.explainerMessageWidgetComponent = this.explainerMessage.getComponent(Widget) ?? this.explainerMessage.addComponent(Widget);
            }
            this.explainerMessageWidgetComponent.enabled = true;
            this.explainerMessageWidgetComponent.isAlignTop = true;
            this.explainerMessageWidgetComponent.isAlignBottom = false;
            this.explainerMessageWidgetComponent.isAlignLeft = true;
            this.explainerMessageWidgetComponent.isAlignRight = false;
            this.explainerMessageWidgetComponent.isAlignHorizontalCenter = false;
            this.explainerMessageWidgetComponent.isAlignVerticalCenter = false;
            this.explainerMessageWidgetComponent.top = this.explainerMessageLandscapeTop;
            this.explainerMessageWidgetComponent.left = this.explainerMessageLandscapeLeft;
            this.explainerMessageWidgetComponent.updateAlignment();
            this.explainerMessage.setScale(this.explainerMessageLandscapeScale, this.explainerMessageLandscapeScale, 1);
        }
    }

    /**
     * Настраивает Widget для explainerMessage001
     */
    private setupExplainerMessage001Widget(isPortrait: boolean): void {
        if (!this.explainerMessage001) return;

        if (isPortrait) {
            if (this.explainerMessage001WidgetComponent) {
                this.explainerMessage001WidgetComponent.enabled = false;
            }
            this.explainerMessage001.setScale(this.explainerMessage001PortraitScale, this.explainerMessage001PortraitScale, 1);
        } else {
            if (!this.explainerMessage001WidgetComponent) {
                this.explainerMessage001WidgetComponent = this.explainerMessage001.getComponent(Widget) ?? this.explainerMessage001.addComponent(Widget);
            }
            this.explainerMessage001WidgetComponent.enabled = true;
            this.explainerMessage001WidgetComponent.isAlignTop = true;
            this.explainerMessage001WidgetComponent.isAlignBottom = false;
            this.explainerMessage001WidgetComponent.isAlignLeft = true;
            this.explainerMessage001WidgetComponent.isAlignRight = false;
            this.explainerMessage001WidgetComponent.isAlignHorizontalCenter = false;
            this.explainerMessage001WidgetComponent.isAlignVerticalCenter = false;
            this.explainerMessage001WidgetComponent.top = this.explainerMessage001LandscapeTop;
            this.explainerMessage001WidgetComponent.left = this.explainerMessage001LandscapeLeft;
            this.explainerMessage001WidgetComponent.updateAlignment();
            this.explainerMessage001.setScale(this.explainerMessage001LandscapeScale, this.explainerMessage001LandscapeScale, 1);
        }
    }

    /**
     * Изменяет размеры всех CardStack в зависимости от ориентации
     */
    private resizeCardStacks(isPortrait: boolean): void {
        if (this.baselineCardStackWidth === 0 || this.baselineCardStackHeight === 0) {
            return;
        }

        if (isPortrait) {
            // Portrait: высчитываем размер на основе tableauLayout
            if (!this.tableauLayout) {
                this.setLayoutCellSize(this.tableauLayout, this.baselineCardStackWidth, this.baselineCardStackHeight);
                this.setLayoutCellSize(this.foundationLayout, this.baselineCardStackWidth, this.baselineCardStackHeight);
                this.setLayoutCellSize(this.stockWasteLayout, this.baselineCardStackWidth, this.baselineCardStackHeight);
                return;
            }

            // Устанавливаем ширину всех layout через Widget с отступами 24 слева и справа
            if (this.tableauLayoutWidget) {
                this.tableauLayoutWidget.isAlignLeft = true;
                this.tableauLayoutWidget.isAlignRight = true;
                this.tableauLayoutWidget.left = 24;
                this.tableauLayoutWidget.right = 24;
            }

            if (this.foundationLayoutWidget) {
                this.foundationLayoutWidget.isAlignLeft = true;
                this.foundationLayoutWidget.isAlignRight = true;
                this.foundationLayoutWidget.left = 24;
                this.foundationLayoutWidget.right = 24;
            }

            if (this.stockWasteLayoutWidget) {
                this.stockWasteLayoutWidget.isAlignLeft = true;
                this.stockWasteLayoutWidget.isAlignRight = true;
                this.stockWasteLayoutWidget.left = 24;
                this.stockWasteLayoutWidget.right = 24;
            }

            // Обновляем Widget'ы layout элементов
            this.scheduleOnce(() => {
                this.tableauLayoutWidget?.updateAlignment();
                this.foundationLayoutWidget?.updateAlignment();
                this.stockWasteLayoutWidget?.updateAlignment();
            }, 0);

            // Вычисляем размер карт на основе размера экрана
            const visibleSize = view.getVisibleSize();
            const layoutWidth = visibleSize.width - 48; // 24 слева + 24 справа
            const tableauCount = 7; // Стандартное количество tableau колонок в солитере
            const spacingX = this.tableauLayout.spacingX || 0;
            const numberOfGaps = tableauCount - 1;
            const totalSpacing = numberOfGaps * spacingX;
            const newCardStackWidth = (layoutWidth - totalSpacing) / tableauCount;

            // Высчитываем высоту с сохранением пропорций
            const aspectRatio = this.baselineCardStackHeight / this.baselineCardStackWidth;
            const newCardStackHeight = newCardStackWidth * aspectRatio;

            // Устанавливаем cellSize для всех GridLayout
            this.setLayoutCellSize(this.tableauLayout, newCardStackWidth, newCardStackHeight);
            this.setLayoutCellSize(this.foundationLayout, newCardStackWidth, newCardStackHeight);
            this.setLayoutCellSize(this.stockWasteLayout, newCardStackWidth, newCardStackHeight);

            // Устанавливаем отступ сверху для tableauLayout
            this.scheduleOnce(() => {
                if (this.foundationLayoutWidget && this.tableauLayoutWidget) {
                    const foundationTop = this.foundationLayoutWidget.top;
                    const tableauTop = foundationTop + newCardStackHeight + 30;
                    this.tableauLayoutWidget.top = tableauTop;
                    this.tableauLayoutWidget.updateAlignment();
                }
            }, 0.01);

            // Перестраиваем карты после настройки Portrait layout'ов
            this.scheduleOnce(() => {
                this.rebuildCards();
            }, 0.02);
        } else {
            // Landscape: отключаем Widget для всех layout и устанавливаем эталонный размер
            if (this.tableauLayoutWidget) {
                this.tableauLayoutWidget.isAlignLeft = false;
                this.tableauLayoutWidget.isAlignRight = false;
                this.tableauLayoutWidget.updateAlignment();
            }

            if (this.foundationLayoutWidget) {
                this.foundationLayoutWidget.isAlignLeft = false;
                this.foundationLayoutWidget.isAlignRight = false;
                this.foundationLayoutWidget.updateAlignment();
            }

            if (this.stockWasteLayoutWidget) {
                this.stockWasteLayoutWidget.isAlignLeft = false;
                this.stockWasteLayoutWidget.isAlignRight = false;
                this.stockWasteLayoutWidget.updateAlignment();
            }

            // Устанавливаем эталонный cellSize для всех GridLayout
            this.setLayoutCellSize(this.tableauLayout, this.baselineCardStackWidth, this.baselineCardStackHeight);
            this.setLayoutCellSize(this.foundationLayout, this.baselineCardStackWidth, this.baselineCardStackHeight);
            this.setLayoutCellSize(this.stockWasteLayout, this.baselineCardStackWidth, this.baselineCardStackHeight);

            // Устанавливаем отступ tableau от foundation с эталонными размерами
            this.scheduleOnce(() => {
                if (this.foundationLayoutWidget && this.tableauLayoutWidget) {
                    const foundationTop = this.foundationLayoutWidget.top || 0;
                    const tableauTop = foundationTop + this.baselineCardStackHeight + 30;
                    this.tableauLayoutWidget.top = tableauTop;
                    this.tableauLayoutWidget.updateAlignment();
                }
            }, 0.01);

            // Перестраиваем карты после настройки Landscape layout'ов
            this.scheduleOnce(() => {
                this.rebuildCards();
            }, 0.02);
        }
    }

    /**
     * Устанавливает cellSize для GridLayout
     */
    private setLayoutCellSize(layout: Layout | undefined, width: number, height: number): void {
        if (!layout) return;

        layout.cellSize = new Size(width, height);
        layout.updateLayout();
    }

    /**
     * Публичный метод для перестройки карт (будет вызываться из Bootstrap)
     */
    public rebuildCards(): void {
        // Публикуем событие для перестройки карт
        this.node.emit('layout-rebuild-cards');
    }

    /**
    * Масштабирует background так, чтобы он покрывал весь экран (fitOutside)
    * Использует оригинальные width/height background и visibleSize окна
    * Гарантирует отсутствие черных полос по краям
    */
    private scaleBackground(): void {
        if (!this.background || this.backgroundOriginalWidth === 0 || this.backgroundOriginalHeight === 0) {
            return;
        }

        const visibleSize = view.getVisibleSize();
        const screenWidth = visibleSize.width;
        const screenHeight = visibleSize.height;

        // Вычисляем scale для покрытия экрана (fitOutside)
        // Берем максимальный scale, чтобы background полностью покрыл экран без черных полос
        const scaleX = screenWidth / this.backgroundOriginalWidth;
        const scaleY = screenHeight / this.backgroundOriginalHeight;
        const isPortrait = screenHeight > screenWidth;
        const multiplier = isPortrait ? 1 : this.landscapeBackgroundScale;
        const finalScale = Math.max(scaleX, scaleY) * multiplier;

        // Применяем scale к node, содержащему background
        if (this.background.node) {
            this.background.node.setScale(finalScale, finalScale, 1);
        }

        console.log(`LayoutController: Background масштабирован (fitOutside) - screen=${screenWidth.toFixed(0)}x${screenHeight.toFixed(0)}, original=${this.backgroundOriginalWidth}x${this.backgroundOriginalHeight}, scale=${finalScale.toFixed(3)}`);
    }
}
