import { Component, _decorator, SpriteFrame } from 'cc';
import { CardSuit, CardRank } from './game/card-system/card-types';

const { ccclass, property } = _decorator;

/**
 * Каталог ресурсов для карт
 * Содержит все спрайты карт, организованные по мастям
 */
@ccclass('CardResourcesCatalog')
export class CardResourcesCatalog extends Component {
    @property(SpriteFrame)
    public cardBack: SpriteFrame = null!;

    @property([SpriteFrame])
    public heartSprites: SpriteFrame[] = [];

    @property([SpriteFrame]) 
    public diamondSprites: SpriteFrame[] = [];

    @property([SpriteFrame])
    public clubSprites: SpriteFrame[] = [];

    @property([SpriteFrame])
    public spadeSprites: SpriteFrame[] = [];

    /**
     * Возвращает спрайт для заданной карты
     */
    public getCardSprite(suit: CardSuit, rank: CardRank): SpriteFrame | null {
        const rankIndex = this.getRankIndex(rank);
        
        switch (suit) {
            case CardSuit.HEARTS:
                return this.heartSprites[rankIndex] || null;
            case CardSuit.DIAMONDS:
                return this.diamondSprites[rankIndex] || null;
            case CardSuit.CLUBS:
                return this.clubSprites[rankIndex] || null;
            case CardSuit.SPADES:
                return this.spadeSprites[rankIndex] || null;
            default:
                return null;
        }
    }

    /**
     * Возвращает спрайт рубашки карты
     */
    public getCardBack(): SpriteFrame {
        return this.cardBack;
    }

    /**
     * Возвращает индекс ранга для массива спрайтов
     */
    private getRankIndex(rank: CardRank): number {
        const ranks = [
            CardRank.ACE, CardRank.TWO, CardRank.THREE, CardRank.FOUR,
            CardRank.FIVE, CardRank.SIX, CardRank.SEVEN, CardRank.EIGHT,
            CardRank.NINE, CardRank.TEN, CardRank.JACK, CardRank.QUEEN, CardRank.KING
        ];
        
        return ranks.indexOf(rank);
    }
}
