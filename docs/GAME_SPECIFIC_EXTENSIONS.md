# Game-Specific Extension Guide

## Overview

The `sc-game-base` package provides a flexible architecture for extending promotion functionality in game-specific packages like `sc-slot-game-base`, `sc-table-game-base`, etc.

## Extension Points

### 1. UserSignInConsumer Extensions

#### Adding Game-Specific Promotion Fields

```javascript
class SlotUserSignInConsumer extends UserSignInConsumer {
  extendPromo(baseData, originalPromotion) {
    return {
      ...baseData,
      betLevel: originalPromotion.betLevel,
      reelConfig: originalPromotion.reelConfig,
      maxPaylines: originalPromotion.maxPaylines,
    };
  }
}
```

```javascript
class CascadingSlotUserSignInConsumer extends SlotUserSignInConsumer {
  extendPromo(baseData, originalPromotion) {
    const slotData = super.extendPromo(baseData, originalPromotion);
    return {
      ...slotData,
      coinValue: originalPromotion.coinValue,
      cascadeMultiplier: originalPromotion.cascadeMultiplier,
    };
  }
}
```

### 2. PlaceBetConsumer Extensions

#### Game-Specific Bet Amount Calculation

```javascript
class SlotPlaceBetConsumer extends PlaceBetConsumer {
  getPromoBetAmount(player, payload) {
    if (!player.promotion?.betLevel) return 0;
    const amounts = { 1: 5, 2: 10, 3: 25, 4: 50 };
    return amounts[player.promotion.betLevel] || 0;
  }

  extendPromoPayload(basePayload, player, originalPayload) {
    return {
      ...basePayload,
      paylines: this.calcPaylines(player.promotion),
      coinValue: this.calcCoinValue(player.promotion),
    };
  }

  calcPaylines(promotion) {
    return promotion.betLevel >= 3 ? 25 : 20;
  }

  calcCoinValue(promotion) {
    return promotion.betLevel >= 2 ? 0.1 : 0.05;
  }
}
```

```javascript
class CascadingSlotPlaceBetConsumer extends SlotPlaceBetConsumer {
  extendPromoPayload(basePayload, player, originalPayload) {
    const slotPayload = super.extendPromoPayload(basePayload, player, originalPayload);
    return {
      ...slotPayload,
      coinValue: player.promotion.coinValue || slotPayload.coinValue,
      maxCascades: this.calcMaxCascades(player.promotion),
    };
  }

  calcMaxCascades(promotion) {
    return promotion.betLevel >= 4 ? 10 : 5;
  }
}
```

### 3. PromotionFreeSpinsConsumer Extensions

```javascript
class SlotPromotionFreeSpinsConsumer extends PromotionFreeSpinsConsumer {
  extendPromo(baseData, originalPromotion) {
    return {
      ...baseData,
      betLevel: originalPromotion.betLevel,
      freeSpinConfig: originalPromotion.freeSpinConfig,
      reelSet: originalPromotion.reelSet,
    };
  }
}
```

### 4. Table Game Extensions

```javascript
class TablePlaceBetConsumer extends PlaceBetConsumer {
  getPromoBetAmount(player, payload) {
    if (!player.promotion?.tableLevel) return 0;
    const amounts = { bronze: 10, silver: 25, gold: 50, platinum: 100 };
    return amounts[player.promotion.tableLevel] || 0;
  }

  extendPromoPayload(basePayload, player, originalPayload) {
    return {
      ...basePayload,
      tableId: this.selectTable(player.promotion),
      sideBeetsEnabled: player.promotion.tableLevel === "platinum",
    };
  }

  selectTable(promotion) {
    return promotion.tableLevel === "platinum" ? "vip-table" : "standard-table";
  }
}
```

## Pure Function Benefits

The new architecture emphasizes pure functions for:

### 1. Better Testability

```javascript
describe("shouldUsePromotion", () => {
  it("should return true for claimed promotion", () => {
    const player = { promotion: { isClaimed: true } };
    expect(consumer.shouldUsePromotion(player)).toBe(true);
  });
});
```

### 2. Predictable Behavior

```javascript
const promotionData = createBasePromoData(promotion, now);
```

### 3. Easier Debugging

```javascript
const result = extendPromo(baseData, originalPromotion);
console.log("Input:", baseData, originalPromotion);
console.log("Output:", result);
```

## Migration Guidelines

### From Old Architecture

```javascript
player.promotion = {
  promotionId: promotion.promotionId,
  betLevel: promotion.betLevel,
};
```

### To New Architecture

```javascript
const baseData = this.createBasePromoData(promotion, now);
const extendedData = this.extendPromo(baseData, promotion);
player.promotion = {
  ...extendedData,
};
```

## Container Registration

```javascript
export default class SlotGameContainerRegistry extends BaseGameContainerRegistry {
  registerConsumers() {
    super.registerConsumers();
    this.container.register({
      userSignInConsumer: asClass(SlotUserSignInConsumer).singleton(),
      placeBetConsumer: asClass(SlotPlaceBetConsumer).singleton(),
      promotionFreeSpinsConsumer: asClass(SlotPromotionFreeSpinsConsumer).singleton(),
    });
  }
}
```

## Event Flow and Timing

### PromotionBetInterceptor Event Sequence

```
1. beforeEvent() → Deduct bonus item
2. Place bet → (Game-specific bet processing)
3. afterSuccessEvent() → Create promotion ticket
4. [Bonus rounds] → (Slot games may have additional processing)
5. endPromotionEvent() → Update totalWin + check completion
```

**Key Points:**

- **totalWin Updates**: Happen in `endPromotionEvent` to ensure all game processing is complete
- **Slot Bonus Rounds**: May run between `afterSuccessEvent` and `endPromotionEvent`
- **Data Consistency**: `totalWin` only updates after successful promotion ticket creation

## Benefits

1. **🎯 Separation of Concerns** - Base package handles core logic, game packages handle specifics
2. **🔧 Extensibility** - Easy to add new game types without modifying base
3. **🧪 Testability** - Pure functions are easier to test
4. **📦 Maintainability** - Changes to game-specific logic don't affect base
5. **⚡ Performance** - No unused fields in base package
6. **🔄 Reusability** - Extension patterns can be reused across game types
7. **⏰ Accurate Timing** - `endPromotionEvent` ensures proper sequence for bonus rounds
