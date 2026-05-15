// Canonical event names used across systems. Import and use instead of hard-coded strings.

// Input low-level normalized events (published by InputService)
export const EVT_TAP = 'Tap'; // Tap { x, y, hits }
export const EVT_DRAG_START = 'DragStart'; // DragStart { startX, startY, hits }
export const EVT_DRAG_MOVE = 'DragMove'; // DragMove { x, y }
export const EVT_DRAG_END = 'DragEnd'; // DragEnd { x, y, hits }
export const EVT_DRAG_CANCEL = 'DragCancel'; // DragCancel {}

// Hittable registry events (published by scene/UI when nodes become hittable)
export const EVT_HITTABLE_REGISTER = 'HittableRegister'; // { node }
export const EVT_HITTABLE_UNREGISTER = 'HittableUnregister'; // { id }

// Gameplay events

// Drag-drop events
export const EVT_DRAGGABLE_DROP_ATTEMPT = 'DraggableDropAttempt'; // { draggable, x, y, hits }
export const EVT_DRAG_STARTED_WITH_DRAGGABLE = 'DragStartedWithDraggable'; // { draggable }

// Card events
export const EVT_CARD_SELECTED = 'CardSelected'; // { card }
export const EVT_CARD_MOVED = 'CardMoved'; // { card, fromStack, toStack }
export const EVT_CARD_FLIPPED = 'CardFlipped'; // { card, isRevealed }
export const EVT_CARD_DROP_SUCCESS = 'CardDropSuccess'; // { card, fromStack, toStack }
export const EVT_CARD_DROP_FAILED = 'CardDropFailed'; // { card, reason }

// Stack events  
export const EVT_STACK_CARD_ADDED = 'StackCardAdded'; // { stack, card }
export const EVT_STACK_CARD_REMOVED = 'StackCardRemoved'; // { stack, card }
export const EVT_STACK_UPDATED = 'StackUpdated'; // { stack }

// Move validation events
export const EVT_MOVE_VALIDATED = 'MoveValidated'; // { card, targetStack }
export const EVT_MOVE_REJECTED = 'MoveRejected'; // { card, reason }
export const EVT_AUTO_MOVE_AVAILABLE = 'AutoMoveAvailable'; // { card }
export const EVT_AUTO_MOVE_EXECUTED = 'AutoMoveExecuted'; // { card, cardsCount, fromStack, toStack }
export const EVT_AUTO_MOVE_FAILED = 'AutoMoveFailed'; // { card, reason }

// Score events
export const EVT_SCORE_CHANGED = 'ScoreChanged'; // { oldScore, newScore, points, reason }
export const EVT_TARGET_SCORE_REACHED = 'TargetScoreReached'; // { score, target }

// Move counter events
export const EVT_MOVES_TARGET_REACHED = 'MovesTargetReached'; // { moves, target }

// GameLoop events
export const EVT_GAME_INITIALIZED = 'GameInitialized'; // {}
export const EVT_GAME_STATE_CHANGED = 'GameStateChanged'; // { oldState, newState }
export const EVT_GAME_WON = 'GameWon'; // {}
export const EVT_CARDS_DEALT = 'CardsDealt'; // {}
export const EVT_NO_MOVES_AVAILABLE = 'NoMovesAvailable'; // {}

// Stock-Waste events
export const EVT_STOCK_FLIPPED = 'StockFlipped'; // { card, stockCards, wasteCards }
export const EVT_WASTE_RECYCLED = 'WasteRecycled'; // { cardsRecycled, stockCards, wasteCards }

// Tableau drag events
export const EVT_TABLEAU_DRAG_CHAIN_CREATED = 'TableauDragChainCreated'; // { primaryCard, childCards }
export const EVT_TABLEAU_DRAG_CHAIN_CLEARED = 'TableauDragChainCleared'; // { cards }

// Tutorial events

export const EVT_TUTORIAL_HIDE = 'TutorialHide'; // {}
export const EVT_TUTORIAL_STEP_CHANGED = 'TutorialStepChanged'; // { step }

// Curtain animation events
export const EVT_CURTAIN_FADE_IN_REQUESTED = 'CurtainFadeInRequested'; // {}
export const EVT_CURTAIN_FADE_IN_COMPLETE = 'CurtainFadeInComplete'; // {}
export const EVT_CURTAIN_FADE_OUT_REQUESTED = 'CurtainFadeOutRequested'; // {}
export const EVT_CURTAIN_FADE_OUT_COMPLETE = 'CurtainFadeOutComplete'; // {}

// Audio events
export const EVT_PLAY_SOUND = 'PlaySound'; // { soundType: string }

// Sound type constants
export const SOUND_CARD_DEAL = 'CardDeal';
export const SOUND_CARD_MOVE = 'CardMove';
export const SOUND_SCORE_INCREASED = 'ScoreIncreased';
export const SOUND_WON = 'Won';
export const SOUND_CANT_TAP = 'CantTap';
export const SOUND_NOTIFICATION = 'Notification';

// CTA events
export const EVT_CTA_SHOWN = 'CTAShown'; // {}

// Layout events
export const EVT_LAYOUT_REBUILT = 'LayoutRebuilt'; // {} - опубликуется после завершения перестройки layout'а


