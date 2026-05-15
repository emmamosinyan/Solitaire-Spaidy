# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

This is a **Cocos Creator 3.8.7** project that ships as a **playable HTML5 ad** for the iOS/Samsung Galaxy versions of "Solitaire Smash". It is not a full game — it's a short, self-contained Klondike Solitaire demo that ends in a store-redirect CTA. Store URLs live in [bootstrap.ts:105-106](assets/scripts/bootstrap.ts).

There is no npm/yarn/CLI build flow. All builds, scene editing, and prefab wiring happen inside the **Cocos Creator editor**:
- Open the project root as a Cocos Creator project. The editor regenerates `library/`, `temp/`, and `temp/tsconfig.cocos.json` (which [tsconfig.json](tsconfig.json) extends).
- Final playable HTML is produced via the `super-html` editor extension under [extensions/super-html/](extensions/super-html/) (Menu → Extension → super-html).
- There are no unit tests, lint scripts, or CI. Treat the editor as the test harness — there is no way to verify changes from the shell.

Design resolution is portrait **1080×2368** ([settings/v2/packages/project.json](settings/v2/packages/project.json)). [LayoutController](assets/scripts/ui/layout-controller.ts) handles dynamic re-layout for landscape orientation at runtime.

Code comments and inspector tooltips are predominantly in **Russian**; match that style when editing existing files rather than translating.

## Architecture

### Composition root
[Bootstrap](assets/scripts/bootstrap.ts) is the single Cocos component placed on the scene. Its `onLoad()` instantiates every controller/system in order and wires them together. Plain TS classes (not Components) like `DragDropSystem`, `MoveValidator`, `GameLoopOrchestrator`, `ScoreController`, etc., receive their dependencies via constructor params and expose `start()` / `stop()`. `Bootstrap.onDestroy()` mirrors the construction order to tear them down.

When adding a new system, follow the same shape: `new System({ bus: GlobalEventBus, ... })`, then `system.start()` in `onLoad`, push the field, stop & undefined it in `onDestroy`. Cocos `@ccclass` components (e.g. `CardStack`, `GameConfig`, `LayoutController`, view classes) are wired through `@property` and assigned in the inspector — Bootstrap reads them off itself.

### Event bus is the integration seam
All cross-system communication goes through [GlobalEventBus](assets/scripts/common/event-bus.ts) — a simple publish/subscribe singleton. **Never hardcode event-type strings.** All event names live as exported constants in [assets/scripts/common/events.ts](assets/scripts/common/events.ts) (`EVT_*`, `SOUND_*`). Add new events there with a comment describing the payload shape; subscribers cast generically via `bus.subscribe<MyEvent>(EVT_X, handler)`.

Typical flow for a card move: `InputService` → `EVT_DRAG_*` → `DragDropSystem` → `EVT_DRAGGABLE_DROP_ATTEMPT` → `MoveValidator` → `EVT_MOVE_VALIDATED` / `EVT_CARD_DROP_SUCCESS` → `CardStack` mutation + `ScoreController` + `AudioController` reactions.

### Domain layout under `assets/scripts/`
- `common/` — event bus, event constants, input service (touch/mouse → normalized `EVT_TAP`/`EVT_DRAG_*` with a hittable-node registry)
- `drag/` — `Draggable` component and generic `DragDropSystem` (orchestrates drag lifecycle, reparents to `dragParent`)
- `game/card-system/` — `Card`, `CardStack`, `CardFactory`, and `card-types.ts` (enums + `CardUtils` rules helpers — Cocos `Enum()` registration is required for inspector visibility)
- `game/solitaire-rules/` — `MoveValidator`, `AutoMoveController` (tap-to-foundation), `StockWasteController` (deck recycle)
- `game/score-system/` — `ScoreController`, `MoveCounter` (drives CTA after N moves or target score)
- `game/gameloop/` — `GameLoopOrchestrator` (state machine: INITIALIZING → READY → PLAYING → WON) and `GameConfig` (inspector-tunable rules: tableau layout, score values, alternating-colors toggle, recycle penalty)
- `ui/` — view components: `CTAView` (store redirect), `CurtainView` (fade transitions), `TutorialView` (hand prompt for first move), `LayoutController` (orientation/widget layout), `NotificationView`, `StoreButton`
- `audio/` — `AudioController` + `AudioCatalog` (sound effect lookup driven by `EVT_PLAY_SOUND`)
- `super_html/` — adapter that forwards lifecycle calls (`download()`, `game_end()`, `is_audio()`, etc.) to the `window.super_html` injected by ad networks

### Import paths
Use Cocos's database scheme for cross-script imports — e.g. `import { Card } from 'db://assets/scripts/game/card-system/card'`. Relative paths work within the same folder but the `db://` form is the project convention. Bootstrap imports the engine via `from 'cc'`.

### Inspector-wired references
Bootstrap holds direct references to scene nodes that Cocos can't autowire: `stockStack`, `wasteStack`, exactly 4 `foundationStacks`, exactly 7 `tableauStacks`, `cardPrefab`, `cardResourcesCatalog`, etc. (validated in [Bootstrap.getGameStacks()](assets/scripts/bootstrap.ts:282)). If you add a new component that needs scene wiring, expect to also manually assign it in the editor — code changes alone won't be enough.

### Layout rebuild signal
[LayoutController](assets/scripts/ui/layout-controller.ts) emits a Cocos node event `'layout-rebuild-cards'` (not via the bus) on orientation/size change. Bootstrap listens and calls `rebuildCardsLayout()` on every stack. Card-position math that depends on stack geometry must go through this path so portrait/landscape transitions stay consistent.

## TypeScript settings

[tsconfig.json](tsconfig.json) sets `strict: false` and extends an editor-generated base. Existing code uses optional fields liberally (`?:`) and `console.warn` for missing-inspector-reference checks rather than runtime errors — match that style for editor-tunable dependencies.
