# Promotion System Integration Guide

## Overview

The `PromotionFreeSpinsConsumer` provides a unified promotion system for games built with `sc-game-base`. It handles both **promotion expiry checking** and **gift code redemption** with optimal performance and backward compatibility.

## Key Features

### 🚀 **Unified Promotion Handling**

- **Expiry Management**: Automatic checking and expiration of promotions
- **Gift Code Redemption**: Complete redemption flow with validation
- **Centralized State**: Single source of truth via `gameData.promotionReady`
- **Performance Optimized**: Early exit conditions and minimal API calls

### 🔄 **Backward Compatibility**

- **Optional Integration**: Games without promotion features continue working unchanged
- **Graceful Degradation**: Safe handling when promotion API is unavailable
- **Zero Overhead**: No performance impact for non-promotion games

## Integration Requirements

### 1. **API Client Dependency**

Your game needs a promotion API client to enable promotion features:

```javascript
// Required for promotion functionality
import { GamePromotionApiClientFactory } from "your-promotion-api-package";

// Register in your container
container.register({
  gamePromotionApiClient: asValue(GamePromotionApiClientFactory),
});
```

### 2. **Consumer Registration**

Register the `PromotionFreeSpinsConsumer` in your dependency injection container:

```javascript
import { PromotionFreeSpinsConsumer } from "sc-game-base";

container.register({
  promotionFreeSpinsConsumer: asClass(PromotionFreeSpinsConsumer).singleton(),
});
```

### 3. **Required Dependencies**

The consumer requires these dependencies to be available:

```javascript
// Core dependencies (always required)
gameData: asValue(gameDataInstance),
promotionFreeSpinsPublisher: asClass(YourPromotionPublisher).singleton(),
logService: asValue(logServiceInstance),

// Optional dependency (enables promotion features)
gamePromotionApiClient: asValue(GamePromotionApiClientFactory), // Can be null/undefined
```

## Implementation Steps

### 1. **Enable Promotion Support in Game Cron**

The `BaseGameCron` automatically detects and configures promotion readiness:

```javascript
// No changes needed - BaseGameCron handles this automatically
export default class YourGameCron extends BaseGameCron {
  constructor(dependencies) {
    super(dependencies); // Includes promotionFreeSpinsConsumer
  }

  // checkPromotionReadiness() is called automatically in start()
  // gameData.promotionReady is set automatically
}
```

### 2. **Configure Socket Router**

Update your socket router to handle redemption events:

```javascript
import { BaseSocketRouter } from "sc-game-base";

export default class YourSocketRouter extends BaseSocketRouter {
  constructor(dependencies) {
    super({
      ...dependencies,
      promotionFreeSpinsConsumer, // Required for redeem functionality
    });
  }

  // handleRedeem() method automatically available
  // Routes to promotionFreeSpinsConsumer.consume()
}
```

### 3. **Implement Promotion Publisher**

Create a publisher for promotion-specific events:

```javascript
export default class YourPromotionFreeSpinsPublisher {
  constructor({ socket, logService }) {
    this.socket = socket;
    this.logService = logService;
  }

  publishToUser(uid, payload) {
    this.socket.to(uid).emit("promotion-update", payload);
  }

  publishEndPromotion(playerIds) {
    playerIds.forEach((playerId) => {
      this.socket.to(playerId).emit("promotion-expired");
    });
  }
}
```

## What to Override

### 1. **Promotion Bet Amount Logic (Required)**

Override `getPromotionBetAmount` in your `PlaceBetConsumer`:

```javascript
export default class YourPlaceBetConsumer extends PlaceBetConsumer {
  getPromotionBetAmount(player) {
    // Implement your game-specific promotion bet logic
    if (player.promotion?.betLevel) {
      return this.gameData.gameConfigs.betLevels[player.promotion.betLevel];
    }
    return player.promotion?.initialBonusItem || 100; // Default amount
  }
}
```

### 2. **Promotion Validation Criteria (Optional)**

Override `composePromotionValidationCriteria` if needed:

```javascript
export default class YourPlaceBetConsumer extends PlaceBetConsumer {
  composePromotionValidationCriteria(player, betChoice, amount) {
    const baseCriteria = super.composePromotionValidationCriteria(player, betChoice, amount);

    // Add game-specific validation
    return {
      ...baseCriteria,
      customGameRule: this.validateCustomRule(player, betChoice),
    };
  }
}
```

### 3. **Custom Promotion Publisher (Optional)**

Extend the base publisher for game-specific events:

```javascript
export default class YourPromotionPublisher extends BasePromotionPublisher {
  publishGameSpecificPromotionEvent(player, eventData) {
    this.socket.to(player.UID).emit("custom-promotion-event", {
      ...eventData,
      gameId: this.gameData.gameConfigs.gameId,
    });
  }
}
```

## Configuration Examples

### Minimal Setup (Promotion-Ready Game)

```javascript
// container-registry.js
import { PromotionFreeSpinsConsumer } from "sc-game-base";
import { GamePromotionApiClientFactory } from "your-api-package";

container.register({
  // Core dependencies
  gameData: asValue(gameDataInstance),
  logService: asValue(logServiceInstance),

  // Promotion dependencies
  gamePromotionApiClient: asValue(GamePromotionApiClientFactory),
  promotionFreeSpinsConsumer: asClass(PromotionFreeSpinsConsumer).singleton(),
  promotionFreeSpinsPublisher: asClass(YourPromotionPublisher).singleton(),
});
```

### Backward Compatible Setup (Legacy Game)

```javascript
// container-registry.js - No promotion features
container.register({
  // Core dependencies only
  gameData: asValue(gameDataInstance),
  logService: asValue(logServiceInstance),

  // Promotion dependencies NOT registered
  // gamePromotionApiClient: undefined,
  // promotionFreeSpinsConsumer: undefined,

  // Game continues to work normally
});
```

### Full Integration Setup (New Game)

```javascript
// container-registry.js
container.register({
  // Core game dependencies
  gameData: asValue(gameDataInstance),
  definition: asValue(gameDefinition),
  logService: asValue(logServiceInstance),

  // Promotion system
  gamePromotionApiClient: asValue(GamePromotionApiClientFactory),
  promotionFreeSpinsConsumer: asClass(PromotionFreeSpinsConsumer).singleton(),
  promotionFreeSpinsPublisher: asClass(YourPromotionPublisher).singleton(),

  // Game consumers
  placeBetConsumer: asClass(YourPlaceBetConsumer).singleton(),

  // Game cron
  baseGameCron: asClass(YourGameCron).singleton(),

  // Socket router
  baseSocketRouter: asClass(YourSocketRouter).singleton(),
});
```

## API Client Requirements

Your `gamePromotionApiClient` must implement these methods:

```javascript
// Required API methods
class YourPromotionApiClient {
  // For expiry checking
  async getExpiringPromotions(gameId) {
    // Return array of promotions expiring soon
    return [
      {
        promotionId: "promo123",
        endDate: "2024-01-01T12:00:00Z",
        players: ["player1", "player2"],
      },
    ];
  }

  // For gift code redemption
  async redeemGiftCode({ giftCode, operatorId, siteName, playerId, currencyGroup, gameId }) {
    // Return redemption result
    return {
      success: true,
      promotion: {
        promotionId: "promo123",
        promotionCode: "GIFT123",
        remainingBonusItems: 10,
        initialBonusItem: 100,
        endDate: "2024-01-01T12:00:00Z",
        // ... other promotion data
      },
    };
  }

  // For promotion details
  async getPromotionById(promotionId) {
    return {
      promotionId: "promo123",
      gameIds: ["game1", "game2"], // Games where promotion is valid
      // ... other promotion details
    };
  }
}
```

## Runtime Behavior

### 1. **Game Startup Sequence**

```
1. BaseGameCron.start()
2. checkPromotionReadiness()
   - If promotionFreeSpinsConsumer exists:
     - Set gameData.promotionReady = hasPromotionApiClient()
   - If promotionFreeSpinsConsumer is null:
     - Set gameData.promotionReady = false
3. Continue normal game startup
```

### 2. **Promotion Expiry Checking**

```
Every cron cycle:
1. promotionFreeSpinsConsumer.checkExpiry()
2. Early exit if !gameData.promotionReady
3. Early exit if no players have promotions
4. Check timing (only on minute boundaries)
5. Call API and expire promotions if needed
```

### 3. **Gift Code Redemption**

```
Client sends redeem event:
1. BaseSocketRouter.handleRedeem()
2. promotionFreeSpinsConsumer.consume()
3. Early exit if !gameData.promotionReady
4. Call API to redeem gift code
5. Update player promotion data
6. Publish result to client
```

## Performance Characteristics

### **Optimal Performance**

- **Single API Check**: Promotion readiness determined once at startup
- **Early Exit Conditions**: Skip processing when not needed
- **Cached State**: All consumers use `gameData.promotionReady` boolean
- **No Logging Overhead**: Pure functions without expensive I/O

### **Memory Usage**

- **Minimal Footprint**: Only active when promotions are actually used
- **Shared State**: Single `gameData.promotionReady` flag for entire game
- **Clean Shutdown**: No background processes or timers

### **API Call Optimization**

- **Conditional Calls**: Only call promotion API when necessary
- **Player Filtering**: Check if any players have promotions before API calls
- **Time-based Batching**: Expiry checks only on minute boundaries

## Best Practices

### 1. **Error Handling**

```javascript
// Always implement proper error handling
export default class YourPromotionPublisher {
  publishToUser(uid, payload) {
    try {
      this.socket.to(uid).emit("promotion-update", payload);
    } catch (error) {
      this.logService?.logError("Failed to publish promotion update:", error);
    }
  }
}
```

### 2. **Validation**

```javascript
// Validate promotion data before processing
getPromotionBetAmount(player) {
    if (!player?.promotion?.betLevel) {
        return this.gameData.gameConfigs.defaultBetAmount || 100;
    }

    const betAmount = this.gameData.gameConfigs.betLevels[player.promotion.betLevel];
    return betAmount > 0 ? betAmount : 100; // Fallback to safe amount
}
```

### 3. **Testing**

```javascript
// Mock the promotion consumer in tests
describe("YourGameLogic", () => {
  beforeEach(() => {
    mockPromotionConsumer = {
      hasPromotionApiClient: jest.fn().mockReturnValue(true),
      consume: jest.fn(),
      checkExpiry: jest.fn(),
    };
  });
});
```

### 4. **Monitoring**

```javascript
// Log important promotion events
publishEndPromotion(playerIds) {
    this.logService?.logInfo(`Expired promotions for ${playerIds.length} players`);
    playerIds.forEach(playerId => {
        this.socket.to(playerId).emit('promotion-expired');
    });
}
```

## Migration Guide

### From No Promotions → Basic Promotions

1. **Add API Client**: Register `gamePromotionApiClient` in container
2. **Add Consumer**: Register `promotionFreeSpinsConsumer` in container
3. **Add Publisher**: Implement and register promotion publisher
4. **Update Router**: Inject `promotionFreeSpinsConsumer` into socket router
5. **Test**: Verify `gameData.promotionReady = true` on startup

### From Legacy Promotion → Unified Consumer

1. **Remove Old Consumer**: Unregister old `redeemConsumer`
2. **Update Imports**: Change imports to use `PromotionFreeSpinsConsumer`
3. **Update Router**: Change `redeemConsumer` to `promotionFreeSpinsConsumer`
4. **Remove Duplicate Logic**: Let unified consumer handle both expiry and redemption
5. **Update Tests**: Adapt tests to new consumer interface

## Troubleshooting

### **Promotion System Not Working**

```javascript
// Check gameData.promotionReady status
console.log("Promotion ready:", this.gameData.promotionReady);

// Verify API client injection
console.log("API client available:", this.promotionFreeSpinsConsumer?.hasPromotionApiClient());

// Check consumer registration
console.log("Consumer injected:", !!this.promotionFreeSpinsConsumer);
```

### **Expiry Checks Not Running**

```javascript
// Verify players have promotions
const playersWithPromotions = Object.values(this.gameData.ingame || {}).filter((player) => player.promotion);
console.log("Players with promotions:", playersWithPromotions.length);
```

### **Redemption Failing**

```javascript
// Check API client implementation
try {
  const result = await this.promotionApiClient.redeemGiftCode(testPayload);
  console.log("API working:", result.success);
} catch (error) {
  console.error("API error:", error.message);
}
```

## Version Compatibility

- **sc-game-base 6.0.0+**: Full unified promotion system
- **sc-game-base 5.x**: Legacy separate consumers (deprecated)
- **Migration**: Update to 6.0.0+ for optimal promotion performance

## Related Documentation

- [Promotion Bet Validation Guide](./PROMOTION_BET_VALIDATION.md)
- [Event Consumer Patterns](../README.md#event-consumer-pattern)
- [Dependency Injection Guide](../README.md#dependency-registration)
