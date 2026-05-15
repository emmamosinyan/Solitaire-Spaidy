import { _decorator, Component } from 'cc';

const { ccclass, property } = _decorator;

/**
 * Конфигурация игры Solitaire
 * Компонент для настройки параметров игры через инспектор Cocos Creator
 */
@ccclass('GameConfig')
export class GameConfig extends Component {
    /**
     * Количество карт в каждой tableau колонке
     * По умолчанию: [1, 2, 3, 4, 5, 6, 7] для стандартного Solitaire
     */
    @property({
        type: [Number],
        tooltip: 'Количество карт в каждой tableau колонке (7 колонок)'
    })
    public tableauLayout: number[] = [1, 2, 3, 4, 5, 6, 7];

    /**
     * Перемешивать ли колоду при создании
     */
    @property({
        tooltip: 'Перемешивать колоду при создании игры'
    })
    public shuffleDeck: boolean = true;

    /**
     * Целевой счет для победы
     */
    @property({
        tooltip: 'Целевой счет для показа CTA экрана'
    })
    public targetScore: number = 100;

    /**
     * Количество успешных ходов для показа CTA
     */
    @property({
        tooltip: 'Количество успешных ходов для показа CTA экрана'
    })
    public movesToEnd: number = 999;

    /**
     * Включить штраф за рециклинг waste
     */
    @property({
        tooltip: 'Штраф за возврат waste в stock (-100 очков)'
    })
    public enableRecyclePenalty: boolean = false;

    /**
     * Требовать чередование цветов карт в tableau (красный-черный-красный-черный)
     * При false можно составлять одноцветные комбинации
     */
    @property({
        tooltip: 'Требовать чередование цветов в tableau (красный-черный)'
    })
    public requireAlternatingColors: boolean = true;

    // === Правила начисления очков ===
    
    /**
     * Очки за перемещение из waste в tableau
     */
    @property({
        tooltip: 'Очки за перемещение карты из waste в tableau'
    })
    public scoreWasteToTableau: number = 5;

    /**
     * Очки за перемещение из waste в foundation
     */
    @property({
        tooltip: 'Очки за перемещение карты из waste в foundation'
    })
    public scoreWasteToFoundation: number = 10;

    /**
     * Очки за перемещение из tableau в foundation
     */
    @property({
        tooltip: 'Очки за перемещение карты из tableau в foundation'
    })
    public scoreTableauToFoundation: number = 10;

    /**
     * Штраф за возврат из foundation в tableau
     */
    @property({
        tooltip: 'Штраф за возврат карты из foundation в tableau (отрицательное значение)'
    })
    public scoreFoundationToTableau: number = -15;

    /**
     * Очки за открытие карты в tableau
     */
    @property({
        tooltip: 'Очки за открытие закрытой карты в tableau'
    })
    public scoreRevealTableauCard: number = 5;

    /**
     * Штраф за рециклинг waste (если включен enableRecyclePenalty)
     */
    @property({
        tooltip: 'Штраф за возврат waste в stock (отрицательное значение)'
    })
    public scoreRecycleWaste: number = -100;

    /**
     * Валидация конфигурации
     */
    onLoad() {
        this.validateConfig();
    }

    /**
     * Проверяет корректность конфигурации
     */
    private validateConfig(): void {
        // Проверяем tableau layout
        if (this.tableauLayout.length !== 7) {
            console.warn(`GameConfig: tableauLayout должен содержать 7 элементов, получено: ${this.tableauLayout.length}`);
            this.tableauLayout = [1, 2, 3, 4, 5, 6, 7];
        }

        // Проверяем что все значения положительные
        for (let i = 0; i < this.tableauLayout.length; i++) {
            if (this.tableauLayout[i] < 0) {
                console.warn(`GameConfig: tableauLayout[${i}] не может быть отрицательным, установлено в 0`);
                this.tableauLayout[i] = 0;
            }
        }

        // Проверяем что сумма карт не превышает 52
        const totalCards = this.tableauLayout.reduce((sum, count) => sum + count, 0);
        if (totalCards > 52) {
            console.error(`GameConfig: Сумма карт в tableau (${totalCards}) превышает 52!`);
        }

        // Проверяем целевой счет
        if (this.targetScore <= 0) {
            console.warn(`GameConfig: targetScore должен быть положительным, установлено в 100`);
            this.targetScore = 100;
        }

        // Проверяем количество ходов
        if (this.movesToEnd <= 0) {
            console.warn(`GameConfig: movesToEnd должен быть положительным, установлено в 5`);
            this.movesToEnd = 5;
        }

        console.log('GameConfig: Конфигурация загружена', {
            tableauLayout: this.tableauLayout,
            shuffleDeck: this.shuffleDeck,
            targetScore: this.targetScore,
            movesToEnd: this.movesToEnd,
            enableRecyclePenalty: this.enableRecyclePenalty,
            requireAlternatingColors: this.requireAlternatingColors,
            scoreRules: {
                wasteToTableau: this.scoreWasteToTableau,
                wasteToFoundation: this.scoreWasteToFoundation,
                tableauToFoundation: this.scoreTableauToFoundation,
                foundationToTableau: this.scoreFoundationToTableau,
                revealTableauCard: this.scoreRevealTableauCard,
                recycleWaste: this.scoreRecycleWaste
            }
        });
    }

    /**
     * Возвращает конфигурацию в виде объекта
     */
    public getConfig(): GameConfigData {
        return {
            tableauLayout: [...this.tableauLayout],
            shuffleDeck: this.shuffleDeck,
            targetScore: this.targetScore,
            movesToEnd: this.movesToEnd,
            enableRecyclePenalty: this.enableRecyclePenalty,
            requireAlternatingColors: this.requireAlternatingColors,
            scoreRules: {
                wasteToTableau: this.scoreWasteToTableau,
                wasteToFoundation: this.scoreWasteToFoundation,
                tableauToFoundation: this.scoreTableauToFoundation,
                foundationToTableau: this.scoreFoundationToTableau,
                revealTableauCard: this.scoreRevealTableauCard,
                recycleWaste: this.scoreRecycleWaste
            }
        };
    }

    /**
     * Устанавливает новую конфигурацию
     */
    public setConfig(config: Partial<GameConfigData>): void {
        if (config.tableauLayout !== undefined) {
            this.tableauLayout = [...config.tableauLayout];
        }
        if (config.shuffleDeck !== undefined) {
            this.shuffleDeck = config.shuffleDeck;
        }
        if (config.targetScore !== undefined) {
            this.targetScore = config.targetScore;
        }
        if (config.movesToEnd !== undefined) {
            this.movesToEnd = config.movesToEnd;
        }
        if (config.enableRecyclePenalty !== undefined) {
            this.enableRecyclePenalty = config.enableRecyclePenalty;
        }
        if (config.requireAlternatingColors !== undefined) {
            this.requireAlternatingColors = config.requireAlternatingColors;
        }
        if (config.scoreRules !== undefined) {
            if (config.scoreRules.wasteToTableau !== undefined) {
                this.scoreWasteToTableau = config.scoreRules.wasteToTableau;
            }
            if (config.scoreRules.wasteToFoundation !== undefined) {
                this.scoreWasteToFoundation = config.scoreRules.wasteToFoundation;
            }
            if (config.scoreRules.tableauToFoundation !== undefined) {
                this.scoreTableauToFoundation = config.scoreRules.tableauToFoundation;
            }
            if (config.scoreRules.foundationToTableau !== undefined) {
                this.scoreFoundationToTableau = config.scoreRules.foundationToTableau;
            }
            if (config.scoreRules.revealTableauCard !== undefined) {
                this.scoreRevealTableauCard = config.scoreRules.revealTableauCard;
            }
            if (config.scoreRules.recycleWaste !== undefined) {
                this.scoreRecycleWaste = config.scoreRules.recycleWaste;
            }
        }
        
        this.validateConfig();
    }
}

/**
 * Интерфейс правил начисления очков
 */
export interface ScoreRules {
    readonly wasteToTableau: number;
    readonly wasteToFoundation: number;
    readonly tableauToFoundation: number;
    readonly foundationToTableau: number;
    readonly revealTableauCard: number;
    readonly recycleWaste: number;
}

/**
 * Интерфейс данных конфигурации
 */
export interface GameConfigData {
    readonly tableauLayout: number[];
    readonly shuffleDeck: boolean;
    readonly targetScore: number;
    readonly movesToEnd: number;
    readonly enableRecyclePenalty: boolean;
    readonly requireAlternatingColors: boolean;
    readonly scoreRules: ScoreRules;
}