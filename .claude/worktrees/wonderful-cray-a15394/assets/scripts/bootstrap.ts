import { _decorator, Component, Prefab, Node, Camera, AudioSource, Label } from 'cc';
import { GlobalEventBus } from 'db://assets/scripts/common/event-bus';
import { InputService, IInputService } from 'db://assets/scripts/common/input-service';
import { DragDropSystem } from 'db://assets/scripts/drag/drag-drop-system';

import { TutorialView } from 'db://assets/scripts/ui/tutorial-view';
import { CurtainView } from 'db://assets/scripts/ui/curtain-view';
import { CTAView } from 'db://assets/scripts/ui/cta-view';
import { LayoutController } from 'db://assets/scripts/ui/layout-controller';
import { AudioCatalog } from 'db://assets/scripts/audio/audio-catalog';
import { AudioController } from 'db://assets/scripts/audio/audio-controller';
import { CardResourcesCatalog } from 'db://assets/scripts/card-resources-catalog';
import { MoveValidator } from 'db://assets/scripts/game/solitaire-rules/move-validator';
import { StockWasteController } from 'db://assets/scripts/game/solitaire-rules/stock-waste-controller';
import { AutoMoveController } from 'db://assets/scripts/game/solitaire-rules/auto-move-controller';
import { ScoreController } from 'db://assets/scripts/game/score-system/score-controller';
import { MoveCounter } from 'db://assets/scripts/game/score-system/move-counter';
import { CardFactory } from 'db://assets/scripts/game/card-system/card-factory';
import { CardStack } from 'db://assets/scripts/game/card-system/card-stack';
import { GameLoopOrchestrator, GameStacks } from 'db://assets/scripts/game/gameloop/gameloop-orchestrator';
import { GameConfig } from 'db://assets/scripts/game/gameloop/game-config';
import { TableauDragController } from 'db://assets/scripts/game/tableau-drag-controller';
import super_html_playable from 'db://assets/scripts/super_html/super_html_playable';

const { ccclass, property } = _decorator;

@ccclass('Bootstrap')
export class Bootstrap extends Component {
    private inputService?: IInputService;
    private dragDropSystem?: DragDropSystem;
    private moveValidator?: MoveValidator;
    private stockWasteController?: StockWasteController;
    private autoMoveController?: AutoMoveController;
    private scoreController?: ScoreController;
    private moveCounter?: MoveCounter;
    private cardFactory?: CardFactory;
    private gameLoopOrchestrator?: GameLoopOrchestrator;
    private tableauDragController?: TableauDragController;
    private gameStacks?: GameStacks;

    @property({ type: Node })
    private dragParent: Node;

    @property({ type: Camera })
    private camera: Camera;

    @property(TutorialView)
    private tutorialView?: TutorialView;

    @property(CurtainView)
    private curtainView?: CurtainView;

    @property(CTAView)
    private ctaView?: CTAView;

    @property(AudioCatalog)
    private audioCatalog?: AudioCatalog;

    @property({ type: Node })
    private audioSourceParent: Node;

    @property(AudioSource)
    private musicAudioSource: AudioSource;

    @property(CardResourcesCatalog)
    private cardResourcesCatalog?: CardResourcesCatalog;

    @property(Prefab)
    private cardPrefab?: Prefab;

    @property(Prefab)
    private moneySpritePrefab?: Prefab;

    @property({ type: Node })
    private moneyTarget?: Node;

    @property({ type: Node })
    private scoreContainer?: Node;

    // Стопки игрового поля назначаются через инспектор
    @property(CardStack)
    private stockStack?: CardStack;
    
    @property(CardStack)  
    private wasteStack?: CardStack;
    
    @property([CardStack])
    private foundationStacks: CardStack[] = [];
    
    @property([CardStack])
    private tableauStacks: CardStack[] = [];

    @property(Label)
    private scoreLabel?: Label;

    @property(GameConfig)
    private gameConfig?: GameConfig;

    @property(LayoutController)
    private layoutController?: LayoutController;

    private audioController?: AudioController;


    private appStoreLink = "https://apps.apple.com/us/app/solitaire-smash-real-cash/id6446482475";
    private googlePlayLink = "https://galaxystore.samsung.com/detail/com.play.solitairesmash";

    onLoad() {
        // Устанавливаем ссылки на сторы для super-html
        super_html_playable.set_app_store_url(this.appStoreLink);
        super_html_playable.set_google_play_url(this.googlePlayLink);
        if (this.layoutController) {
            this.layoutController.node.on('layout-rebuild-cards', this.rebuildAllCardStacks, this);
        }

        this.inputService = new InputService({ bus: GlobalEventBus });
        this.inputService.start();

        this.dragDropSystem = new DragDropSystem({ bus: GlobalEventBus, dragParentObject: this.dragParent, camera: this.camera });
        this.dragDropSystem.start();

        this.audioController = new AudioController({
            bus: GlobalEventBus,
            catalog: this.audioCatalog,
            audioSourceParent: this.audioSourceParent,
            musicAudioSource: this.musicAudioSource,
        });
        this.audioController.start();

        // Инициализируем систему валидации ходов
        this.moveValidator = new MoveValidator({ bus: GlobalEventBus });
        this.moveValidator.start();

        // Инициализируем контроллер автоматического перемещения
        this.autoMoveController = new AutoMoveController({ bus: GlobalEventBus });
        this.autoMoveController.start();

        // Инициализируем систему подсчета очков
        if (this.scoreLabel && this.gameConfig) {
            const config = this.gameConfig.getConfig();
            this.scoreController = new ScoreController({
                bus: GlobalEventBus,
                scoreLabel: this.scoreLabel,
                targetScore: config.targetScore,
                enableRecyclePenalty: config.enableRecyclePenalty,
                scoreRules: config.scoreRules,
                moneySpritePrefab: this.moneySpritePrefab,
                moneyTarget: this.moneyTarget,
                scoreContainer: this.scoreContainer,
                camera: this.camera
            });
            this.scoreController.start();

            // Подключаем ScoreController к CTAView
            if (this.ctaView) {
                this.ctaView.setScoreController(this.scoreController);
                console.log('Bootstrap: ScoreController подключен к CTAView');
            }
        } else {
            if (!this.scoreLabel) {
                console.warn('Bootstrap: Score Label не назначен в инспекторе');
            }
            if (!this.gameConfig) {
                console.warn('Bootstrap: GameConfig не назначен в инспекторе');
            }
        }

        // Инициализируем счетчик ходов
        if (this.gameConfig) {
            const config = this.gameConfig.getConfig();
            this.moveCounter = new MoveCounter({
                bus: GlobalEventBus,
                targetMoves: config.movesToEnd
            });
            this.moveCounter.start();
        }

        // Инициализируем контроллер перетаскивания tableau карт
        this.tableauDragController = new TableauDragController({ bus: GlobalEventBus });
        this.tableauDragController.start();

        // Инициализируем фабрику карт
        if (this.cardPrefab && this.cardResourcesCatalog) {
            this.cardFactory = new CardFactory({
                cardPrefab: this.cardPrefab,
                resourcesCatalog: this.cardResourcesCatalog,
                camera: this.camera
            });
        } else {
            console.warn('Bootstrap: CardPrefab или CardResourcesCatalog не назначены в инспекторе');
        }

        // Получаем стопки из инспектора
        this.gameStacks = this.getGameStacks();
        
        // Устанавливаем dragParent для всех стопок
        if (this.gameStacks && this.dragParent) {
            this.gameStacks.stock.setDragParent(this.dragParent);
            this.gameStacks.waste.setDragParent(this.dragParent);
            this.gameStacks.foundations.forEach(stack => stack.setDragParent(this.dragParent));
            this.gameStacks.tableau.forEach(stack => stack.setDragParent(this.dragParent));
            console.log('Bootstrap: dragParent установлен для всех стопок');
        }

        // Передаем gameStacks и camera в TutorialView
        if (this.tutorialView && this.gameStacks && this.camera) {
            this.tutorialView.setGameStacks(this.gameStacks);
            this.tutorialView.camera = this.camera;
            console.log('Bootstrap: GameStacks и Camera переданы в TutorialView');
        }
        
        // Инициализируем StockWasteController если стопки готовы
        if (this.gameStacks) {
            this.stockWasteController = new StockWasteController({
                bus: GlobalEventBus,
                stacks: {
                    stock: this.gameStacks.stock,
                    waste: this.gameStacks.waste
                }
            });
            this.stockWasteController.start();
        }

        // Устанавливаем стопки для AutoMoveController
        if (this.gameStacks && this.autoMoveController) {
            this.autoMoveController.setGameStacks(this.gameStacks);
        }
        
        // Создаем GameLoop Orchestrator
        if (this.gameStacks && this.gameConfig) {
            this.gameLoopOrchestrator = new GameLoopOrchestrator({
                bus: GlobalEventBus,
                cardFactory: this.cardFactory,
                moveValidator: this.moveValidator!,
                stacks: this.gameStacks,
                config: this.gameConfig.getConfig()
            });
            
            // Запускаем игру
            this.gameLoopOrchestrator.start();
        } else {
            if (!this.gameConfig) {
                console.error('Bootstrap: GameConfig не назначен в инспекторе!');
            }
        }
        
    }

    onDestroy() {
        // Отписываемся от событий LayoutController
        if (this.layoutController) {
            this.layoutController.node.off('layout-rebuild-cards', this.rebuildAllCardStacks, this);
        }

        this.dragDropSystem?.stop();
        this.dragDropSystem = undefined;
        this.inputService?.stop();
        this.inputService = undefined;
        this.audioController?.stop();
        this.audioController = undefined;
        this.moveValidator?.stop();
        this.moveValidator = undefined;
        this.stockWasteController?.stop();
        this.stockWasteController = undefined;
        this.autoMoveController?.stop();
        this.autoMoveController = undefined;
        this.scoreController?.stop();
        this.scoreController = undefined;
        this.moveCounter?.stop();
        this.moveCounter = undefined;
        
        this.gameLoopOrchestrator?.stop();
        this.gameLoopOrchestrator = undefined;

        this.tableauDragController?.stop();
        this.tableauDragController = undefined;
    }

    /**
     * Получает стопки из инспектора
     */
    private getGameStacks(): GameStacks | null {
        // Проверяем что все необходимые стопки назначены
        if (!this.stockStack || !this.wasteStack || 
            this.foundationStacks.length !== 4 || 
            this.tableauStacks.length !== 7) {
            console.error('Bootstrap: Не все стопки назначены в инспекторе!', {
                stockStack: !!this.stockStack,
                wasteStack: !!this.wasteStack,
                foundationStacks: this.foundationStacks.length,
                tableauStacks: this.tableauStacks.length
            });
            return null;
        }

        return {
            stock: this.stockStack,
            waste: this.wasteStack,
            foundations: this.foundationStacks,
            tableau: this.tableauStacks
        };
    }

    /**
     * Перестраивает layout всех карт во всех стопках
     */
    private rebuildAllCardStacks(): void {
        // Перестраиваем stock и waste
        if (this.stockStack) {
            this.stockStack.rebuildCardsLayout();
        }
        if (this.wasteStack) {
            this.wasteStack.rebuildCardsLayout();
        }

        // Перестраиваем foundation стопки
        this.foundationStacks.forEach((stack) => {
            if (stack) {
                stack.rebuildCardsLayout();
            }
        });

        // Перестраиваем tableau стопки
        this.tableauStacks.forEach((stack) => {
            if (stack) {
                stack.rebuildCardsLayout();
            }
        });
    }
}

