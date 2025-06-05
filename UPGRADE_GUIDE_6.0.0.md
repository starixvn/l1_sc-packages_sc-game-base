# SC-Game-Base 6.x.x Upgrade Guide: Promotion Integration

## Overview

SC-Game-Base 6.x.x introduces comprehensive promotion support through Pentagon's official `@sc/game-promotion-api-client` package. This major version includes breaking changes and new architectural patterns that require careful migration.

## ⚡ Backwards Compatibility

**Important**: Existing services without promotion API configuration will continue to work normally. The promotion features are **completely optional** and do not affect core betting functionality.

### What Still Works Without Promotion Setup:

- ✅ Regular bet processing
- ✅ User sign-in flows
- ✅ All existing game mechanics
- ✅ Payment processing
- ✅ Event publishing/consuming
- ✅ Current interceptor patterns

### What Requires Migration:

- 🔧 Only services that want to **add** promotion features
- 🔧 Custom interceptors that need promotion integration
- 🔧 Games requiring promotion-specific bet amounts

### No-Op Behavior:

When promotion API is not configured:

- Promotion-related methods return `null` or skip silently
- No API calls are made to promotion services
- Bet processing continues with standard flow
- No errors or warnings are generated

```javascript
// Example: This will work fine without promotion API setup
const consumer = new PlaceBetConsumer(/* standard dependencies */);
// All existing functionality works normally
// Promotion methods simply return null/false
```

## 🚨 Breaking Changes

### 1. **New Required Dependencies**

```json
{
  "@sc/game-promotion-api-client": "^1.0.0"
}
```

### 2. **Event Interceptor System with Process-Bet-Queue Integration**

- Event interceptors integrate directly with `ProcessBetQueue` through the `betEventInterceptors` parameter
- Mixin-based architecture for interceptor functionality in `ProcessBetQueue`
- **Automatic container registry setup** for interceptor arrays

### 3. **API Changes**

- `PlaceBetConsumer` includes new promotion methods: `getPromotionBetAmount()` and `handlePromotionLogic()`
- `InGameConsumer` automatically includes promotion data in game payload when player has active promotions
- `ProcessBetQueue` constructor automatically receives `betEventInterceptors` parameter
- New validation methods in consumers for promotion eligibility

### 4. **Container Registry Changes**

- **Automatic interceptor registrations** - no manual setup required
- **Automatic promotion client registration** - handled by base ContainerRegistry
- Interceptor array factory patterns handled automatically

## 📋 Pre-Migration Checklist

- [ ] **Decide if you need promotion features** (optional - most services can skip)
- [ ] Review current promotion requirements (if applicable)
- [ ] Backup existing codebase
- [ ] Ensure Pentagon API client access (only if adding promotions)
- [ ] Plan testing strategy
- [ ] Review architectural patterns
- [ ] Update CI/CD pipelines for new dependencies (if adding promotions)

## 🔧 Migration Steps

### Minimal Migration (No Promotion Features)

If you only want to upgrade to 6.x.x without adding promotion features, follow these minimal steps:

```bash
# 1. Update dependency
npm install sc-game-base@^6.0.0

# 2. No other changes required!
# Your existing code will work as-is
```

**That's it!** Your service will work exactly the same as before. All promotion-related functionality will be automatically disabled.

### Full Migration (With Promotion Features)

Follow all steps below only if you want to add promotion functionality to your service.

### Step 1: Update Dependencies

```bash
npm install @sc/game-promotion-api-client@^1.0.0
npm install sc-game-base@^6.0.0
```

### Step 2: Container Registry Setup

**Good News**: Container registration is handled automatically! The base `ContainerRegistry` class automatically:

- Registers the promotion client (`gamePromotionApiClient`)
- Registers the `PromotionBetInterceptor`
- Sets up interceptor arrays (`betEventInterceptors`)
- Configures `ProcessBetQueue` integration

**No manual container registration needed** unless you want to add custom interceptors.

```javascript
// src/container-registry.js - ONLY if extending with custom interceptors
import { ContainerRegistry } from "sc-game-base/core";
import YourCustomInterceptor from "./event-interceptors/your-custom-interceptor.js";

export default class YourGameContainerRegistry extends ContainerRegistry {
  // Base registration handles everything automatically
  register(appConfigs, definition, gameData) {
    const container = super.register(appConfigs, definition, gameData);

    // Only add this if you have custom interceptors
    this.registerCustomInterceptors();

    return container;
  }

  // OPTIONAL: Only needed for custom interceptors
  registerCustomInterceptors() {
    this.container.register({
      yourCustomInterceptor: asClass(YourCustomInterceptor).singleton(),
    });
  }

  // OPTIONAL: Override interceptor arrays to add custom interceptors
  registerInterceptorArrays() {
    this.container.register({
      betEventInterceptors: asFunction(({ promotionBetInterceptor, yourCustomInterceptor }) => {
        const interceptors = [];

        // Base promotion interceptor (automatically available)
        if (promotionBetInterceptor) {
          interceptors.push(promotionBetInterceptor);
        }

        // Add your custom interceptors
        if (yourCustomInterceptor) {
          interceptors.push(yourCustomInterceptor);
        }

        return interceptors;
      }).singleton(),
    });
  }
}
```

### Step 3: Add Promotion API Configuration

**This is the main step you need**: Add promotion API settings to enable promotion features:

```javascript
// src/configs/app-config.js
export const appConfigs = {
  // ... existing configs

  // Add this to enable promotion features
  promotionApiSettings: {
    baseUrl: process.env.PROMOTION_API_BASE_URL || "https://promotion-api.example.com",
    timeout: parseInt(process.env.PROMOTION_API_TIMEOUT) || 5000,
    useAuthentication: process.env.PROMOTION_API_USE_AUTH !== "false",
  },
};
```

**Without this configuration**, the promotion client returns `null` and all promotion features are disabled.

### Step 4: Using the Built-in PromotionBetInterceptor

The `PromotionBetInterceptor` is automatically registered and handles all standard promotion workflows:

- ✅ **Automatic promotion detection** via `payload.usePromotion` and `payload.promotionId`
- ✅ **Bonus item deduction** before bet placement
- ✅ **Promotion ticket creation** after successful bets
- ✅ **Rollback handling** for failed bets
- ✅ **Data enhancement** for bet records, logs, and API calls

**No additional code needed** - it works automatically when:

1. `promotionApiSettings` is configured
2. Client sends promotion data in bet payload

### Built-in InGameConsumer Promotion Support

The `InGameConsumer` automatically includes promotion data when players enter the game:

- ✅ **Automatic promotion data inclusion** in game payload
- ✅ **Seamless client-side promotion display**
- ✅ **No additional configuration required**
- ✅ **Graceful handling** of players without promotions

**Promotion data included in game payload:**

```javascript
// Game payload automatically includes promotion when available
{
  "roundId": "round-123",
  "gameConfigs": { /* game settings */ },
  "user": { /* user data */ },
  "promotion": {
    "promotionId": "winter2024",
    "code": "WIN24",
    "bonusItemCount": 5,
    "isActive": true,
    "promotionType": "free_bet",
    "expiryDate": "2024-12-31T23:59:59Z",
    "lastUsedDate": "2024-01-15T10:30:00Z"
  }
  // ... other game data
}
```

#### Built-in PromotionBetInterceptor Features:

```javascript
// The interceptor automatically handles these bet payload patterns:

// Standard promotion bet
{
  "amount": 100,
  "betChoice": "red",
  "usePromotion": true,           // Triggers promotion processing
  "promotionId": "winter2024",    // Identifies the promotion
  // ... other bet fields
}

// The interceptor automatically:
// 1. Validates promotion data
// 2. Calls gamePromotionApiClient.deductBonusItem()
// 3. Enhances bet info with promotion metadata
// 4. Creates promotion ticket on success
// 5. Rolls back on failure
```

#### Accessing PromotionBetInterceptor in Your Code:

```javascript
// Import from core if you need to reference it
import { EventInterceptors } from "sc-game-base/core";
const { PromotionBetInterceptor } = EventInterceptors;

// Or import directly
import { PromotionBetInterceptor } from "sc-game-base/core/event-interceptors";

// Example: Extending the built-in interceptor
export default class MyGamePromotionInterceptor extends PromotionBetInterceptor {
  constructor(dependencies) {
    super(dependencies);
  }

  // Override shouldIntercept to add game-specific conditions
  shouldIntercept(context) {
    const baseCheck = super.shouldIntercept(context);

    // Add game-specific logic
    const { payload } = context;
    return baseCheck && payload.gameMode !== "practice";
  }

  // Override transformEventData to add game-specific fields
  transformEventData(transformName, context) {
    // Call parent transformation first
    let result = super.transformEventData(transformName, context);

    // Add game-specific enhancements
    if (transformName === "enhanceBetRecord") {
      const { payload } = context;
      if (payload.gameSpecificData) {
        result.gameSpecificData = payload.gameSpecificData;
      }
    }

    return result;
  }
}
```

### Step 5: Create Custom Event Interceptors (Advanced)

Only needed if you require completely custom promotion logic beyond extending the built-in interceptor:

```javascript
// src/event-interceptors/your-game-promotion-interceptor.js
import { BaseEventInterceptor } from "sc-game-base/core/event-interceptors";

export default class YourGamePromotionInterceptor extends BaseEventInterceptor {
  constructor({ gamePromotionApiClient, logService, definition }) {
    super({ logService, definition });
    this.gamePromotionApiClient = gamePromotionApiClient.instance();
  }

  shouldIntercept(context) {
    const { payload } = context;

    // Game-specific logic - example: only for special game modes
    return payload?.usePromotion === true && payload?.gameMode === "tournament" && this.gamePromotionApiClient !== null;
  }

  async beforeEvent(context) {
    const { player, payload } = context;

    try {
      // Game-specific promotion validation
      if (payload.gameSpecificPromotionCheck) {
        // Your validation logic
      }

      return { success: true };
    } catch (error) {
      this.logService?.logError("Game-specific promotion validation failed:", error);
      return {
        success: false,
        error: "Game-specific promotion validation failed",
      };
    }
  }

  transformEventData(transformName, context) {
    const { payload, betInfo, betRecord, betLog, bet } = context;

    switch (transformName) {
      case "enhanceBetInfo":
        // Add game-specific metadata to bet info
        if (payload?.gameSpecificData) {
          betInfo.metadata = {
            ...betInfo.metadata,
            gameSpecificData: payload.gameSpecificData,
          };
        }
        return betInfo;

      case "enhanceBetRecord":
        // Add game-specific fields to bet record
        if (bet?.gameSpecificField) {
          betRecord.gameSpecificField = bet.gameSpecificField;
        }
        return betRecord;

      case "enhanceBetLog":
        // Add game-specific fields to bet log
        if (bet?.gameSpecificLog) {
          betLog.gameSpecificLog = bet.gameSpecificLog;
        }
        return betLog;

      default:
        return super.transformEventData(transformName, context);
    }
  }

  async afterSuccessEvent(context) {
    // Custom logic after successful bet
    const { player, bet, balance } = context;

    try {
      // Game-specific success handling
      if (bet.triggerSpecialEvent) {
        // Your post-success logic
      }
    } catch (error) {
      this.logService?.logError("Game-specific success handling failed:", error);
    }
  }

  async afterFailureEvent(context) {
    // Custom logic after failed bet
    const { player, bet, notice } = context;

    try {
      // Game-specific failure handling
      if (bet.requiresSpecialCleanup) {
        // Your cleanup logic
      }
    } catch (error) {
      this.logService?.logError("Game-specific failure handling failed:", error);
    }
  }
}
```

### Step 6: Extend PlaceBetConsumer for Promotion Support (Optional)

Only needed if you require game-specific promotion bet amount calculations:

```javascript
// src/event-consumers/your-game-place-bet-consumer.js
import { PlaceBetConsumer } from "sc-game-base/core/event-consumers";

export default class YourGamePlaceBetConsumer extends PlaceBetConsumer {
  /**
   * Override to implement game-specific promotion bet amount logic
   * @param {Object} player - Player object
   * @param {Object} payload - Bet payload
   * @returns {number} Promotional bet amount
   */
  getPromotionBetAmount(player, payload) {
    // Slot games: different amounts based on lines
    if (payload.betChoice === "spin" && payload.lines) {
      return payload.lines * 10; // 10 coins per line
    }

    // Table games: fixed amount based on table
    if (payload.tableId) {
      const tablePromoAmounts = {
        "vip-table": 100,
        "standard-table": 50,
        "beginner-table": 25,
      };
      return tablePromoAmounts[payload.tableId] || 0;
    }

    // Default behavior
    return super.getPromotionBetAmount(player, payload);
  }

  /**
   * Override to add game-specific promotion validation
   * @param {Object} player - Player object
   * @returns {Array} Additional validation criteria
   */
  composePromotionValidationCriteria(player) {
    const baseCriteria = super.composePromotionValidationCriteria?.(player) || [];

    // Add game-specific validation
    if (player.promotion) {
      const gameSpecificCriteria = [
        {
          failure: player.promotion.gameRestrictions && !player.promotion.gameRestrictions.includes(this.definition.id),
          notice: this.getNoticeObj("Game not eligible for this promotion"),
        },
        {
          failure: player.profile.level < 10, // Level requirement
          notice: this.getNoticeObj("Minimum level 10 required for promotions"),
        },
      ];

      return baseCriteria.concat(gameSpecificCriteria);
    }

    return baseCriteria;
  }
}
```

### Step 7: Update Container Registration (If Using Custom Components)

```javascript
// Register your custom consumer instead of the base one
registerConsumers() {
    super.registerConsumers();

    // Override with your custom consumer
    this.container.register({
        placeBetConsumer: asClass(YourGamePlaceBetConsumer).singleton(),
    });
}
```

### Step 8: Configuration Updates (Optional)

Add promotion-related configuration to your game configs:

```javascript
// src/game-configs/your-game-config.js
export const gameConfigs = {
  // ... existing configs

  // Promotion-related configs
  promotionSettings: {
    enablePromotions: true,
    maxPromotionBetsPerRound: 5,
    allowPromotionStacking: false,
    promotionTimeoutMs: 30000,
  },
};
```

## 🎯 What's Automatic vs Manual

### ✅ **Automatic (No Action Required)**

- Promotion client registration (`gamePromotionApiClient`)
- `PromotionBetInterceptor` registration
- `betEventInterceptors` array creation
- `ProcessBetQueue` integration with interceptors
- `InGameConsumer` promotion data inclusion in game payload
- Graceful degradation when promotion API not configured
- **Standard promotion workflows** (deduct → bet → ticket/rollback)

### 🔧 **Manual (Only If Needed)**

- Promotion API configuration (`promotionApiSettings`)
- Custom interceptors for game-specific logic
- Custom `PlaceBetConsumer` extensions
- Game-specific promotion validation rules
- **Extending built-in PromotionBetInterceptor** for game-specific enhancements

## 🧪 Testing Strategy

### Unit Tests

Update your test files to include promotion scenarios:

```javascript
// __tests__/in-game-consumer.test.js
describe("InGameConsumer with Promotions", () => {
  let consumer;
  let mockPlayer;

  beforeEach(() => {
    mockPlayer = {
      profile: { name: "testPlayer" },
      session: { currencyGroupId: 1, currencyCode: "USD", multiplier: 1000 },
      socketClient: { emit: jest.fn() },
    };
    consumer = new InGameConsumer(/* dependencies */);
  });

  it("should include promotion data when player has promotion", async () => {
    const promotionData = {
      promotionId: "winter2024",
      code: "WIN24",
      bonusItemCount: 5,
      isActive: true,
      promotionType: "free_bet",
      expiryDate: "2024-12-31T23:59:59Z",
      lastUsedDate: "2024-01-15T10:30:00Z",
    };

    mockPlayer.promotion = promotionData;
    consumer.getUserInfo = jest.fn().mockReturnValue({ UID: 1, name: "user", red: 2000 });

    const payload = await consumer.buildPayload(mockPlayer);

    expect(payload.promotion).toEqual(promotionData);
  });

  it("should not include promotion data when player has no promotion", async () => {
    consumer.getUserInfo = jest.fn().mockReturnValue({ UID: 1, name: "user", red: 2000 });

    const payload = await consumer.buildPayload(mockPlayer);

    expect(payload.promotion).toBeUndefined();
  });
});

// __tests__/place-bet-consumer.test.js
describe("YourGamePlaceBetConsumer with Promotions", () => {
  let consumer;
  let mockPlayer;

  beforeEach(() => {
    // Setup with promotion data
    mockPlayer = {
      profile: { name: "testPlayer", level: 15 },
      promotion: {
        promotionId: "test-promo-123",
        bonusItemCount: 10,
        endDate: new Date(Date.now() + 86400000), // 24 hours from now
        isActive: true,
      },
    };

    consumer = new YourGamePlaceBetConsumer(/* dependencies */);
  });

  describe("getPromotionBetAmount", () => {
    it("should return correct amount for spin with lines", () => {
      const payload = { betChoice: "spin", lines: 5 };
      const amount = consumer.getPromotionBetAmount(mockPlayer, payload);
      expect(amount).toBe(50); // 5 lines * 10 coins
    });

    it("should return table-specific amount", () => {
      const payload = { tableId: "vip-table" };
      const amount = consumer.getPromotionBetAmount(mockPlayer, payload);
      expect(amount).toBe(100);
    });
  });

  describe("promotion validation", () => {
    it("should validate game restrictions", () => {
      mockPlayer.promotion.gameRestrictions = [1, 2, 3]; // Current game not included
      const criteria = consumer.composePromotionValidationCriteria(mockPlayer);
      const failed = criteria.find((c) => c.failure);
      expect(failed).toBeDefined();
    });

    it("should validate player level requirement", () => {
      mockPlayer.profile.level = 5; // Below required level
      const criteria = consumer.composePromotionValidationCriteria(mockPlayer);
      const failed = criteria.find((c) => c.failure);
      expect(failed).toBeDefined();
    });
  });
});
```

### Integration Tests

```javascript
// __tests__/integration/promotion-flow.test.js
describe("Promotion Integration Flow", () => {
  it("should handle complete promotion bet flow through ProcessBetQueue", async () => {
    // Test the complete flow from consumer to ProcessBetQueue with interceptors
    const mockPromotionClient = {
      instance: () => ({
        deductBonusItem: jest.fn().mockResolvedValue({ success: true }),
        createPromotionTicket: jest.fn().mockResolvedValue({ ticketId: "ticket-123" }),
        rollbackBonusItem: jest.fn().mockResolvedValue({ success: true }),
      }),
    };

    // Setup ProcessBetQueue with interceptors
    const processBetQueue = new ProcessBetQueue({
      // ... dependencies
      betEventInterceptors: [promotionInterceptor],
    });

    // Setup test scenario
    // Execute bet
    // Verify promotion API calls
    // Verify responses
  });
});
```

## 🚨 Common Migration Issues

### Issue 1: Container Resolution Error for betEventInterceptors

**Problem**: Getting Awilix resolution error: `processBetQueue -> betEventInterceptors -> container`

```
Resolution path: processBetQueue -> betEventInterceptors -> container
    at resolve (node_modules\awilix\lib\container.js:252:23)
    ...
    cannot resolve path
```

**Root Cause**: The `registerInterceptorArrays()` method in older versions incorrectly tried to access the container directly in the factory function.

**Solution**: Upgrade to sc-game-base 6.0.0+ which fixes this issue, or if extending `ContainerRegistry`, use the correct Awilix pattern:

```javascript
// ❌ WRONG - This causes the error
registerInterceptorArrays() {
  this.container.register({
    betEventInterceptors: asFunction((container) => { // Wrong parameter
      if (container.hasRegistration("promotionBetInterceptor")) { // Wrong approach
        // ...
      }
    }).singleton(),
  });
}

// ✅ CORRECT - Use dependency injection
registerInterceptorArrays() {
  this.container.register({
    betEventInterceptors: asFunction(({ promotionBetInterceptor, yourCustomInterceptor }) => {
      const interceptors = [];

      if (promotionBetInterceptor) {
        interceptors.push(promotionBetInterceptor);
      }

      if (yourCustomInterceptor) {
        interceptors.push(yourCustomInterceptor);
      }

      return interceptors;
    }).singleton(),
  });
}
```

### Issue 2: Promotion Features Not Working

**Problem**: Promotion bets are processed as regular bets
**Solution**: Ensure `promotionApiSettings` is configured in your app config. Without this, promotion features are automatically disabled.

### Issue 3: Container Resolution Errors

**Problem**: Custom interceptors not properly registered
**Solution**: Ensure `registerInterceptorArrays()` is called after all custom interceptors are registered

### Issue 4: Missing Promotion Client

**Problem**: `gamePromotionApiClient` not found
**Solution**: This should be automatic. Verify you're extending from the base `ContainerRegistry` class properly.

### Issue 5: Validation Failures

**Problem**: Promotion validation always fails
**Solution**: Check that `composePromotionValidationCriteria` returns valid criteria format

### Issue 6: Custom Interceptor Not Triggered

**Problem**: Custom interceptor never executes
**Solution**: Verify `shouldIntercept()` method returns `true` for your scenarios and that interceptors are properly registered in `betEventInterceptors`

### Issue 7: ProcessBetQueue Integration Issues

**Problem**: Interceptors not executing in ProcessBetQueue
**Solution**: This should be automatic. Verify you haven't overridden the base `registerCrons()` method incorrectly.

## 📊 Performance Considerations

### 1. **API Call Optimization**

- Promotion API calls are asynchronous and may add latency
- Consider implementing timeout configurations
- Monitor API response times

### 2. **Memory Usage**

- Interceptor arrays are created per game instance
- Monitor memory usage with multiple interceptors
- Consider lazy loading for game-specific interceptors

### 3. **Database Impact**

- Additional promotion metadata in bet records
- Consider indexing promotion-related fields
- Monitor query performance

## 🔍 Monitoring & Debugging

### Logging Enhancements

```javascript
// Add promotion-specific logging
this.logService.logInfo("Promotion bet processing", {
  playerId: player.UID,
  promotionId: player.promotion?.promotionId,
  betAmount: payload.amount,
  promotionAmount: this.getPromotionBetAmount(player, payload),
});
```

### Metrics Collection

```javascript
// Track promotion-related metrics
this.baseMetrics.incrementCounter("promotion_bets_processed");
this.baseMetrics.recordTimer("promotion_api_response_time", responseTime);
```

## 📚 Additional Resources

- [Event Interceptor Pattern Documentation](./docs/event-interceptors.md)
- [Promotion API Client Documentation](https://pentagon-docs.sc.com/game-promotion-api-client)
- [SC-Game-Base Architecture Guide](./docs/architecture.md)
- [Testing Patterns for Game Services](./docs/testing-patterns.md)

## 🆘 Support

If you encounter issues during migration:

1. **Check Logs**: Review application logs for specific error messages
2. **Verify Configuration**: Ensure all required configs are set
3. **Test in Isolation**: Test promotion features separately
4. **Review Examples**: Check example implementations in test files
5. **Contact Team**: Reach out to the sc-game-base team for assistance

## 📝 Post-Migration Checklist

- [ ] All tests passing
- [ ] Promotion flows working correctly (if enabled)
- [ ] Performance metrics within acceptable ranges
- [ ] Error handling tested
- [ ] Monitoring and alerting configured
- [ ] Documentation updated
- [ ] Team trained on new features

---

**Version**: 6.0.0  
**Last Updated**: 2025  
**Compatibility**: Node.js 16+, Pentagon API Client 1.0+
