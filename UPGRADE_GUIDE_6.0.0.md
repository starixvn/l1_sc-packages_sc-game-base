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
- Required container registry updates for interceptor arrays

### 3. **API Changes**

- `PlaceBetConsumer` includes new promotion methods: `getPromotionBetAmount()` and `handlePromotionLogic()`
- `ProcessBetQueue` constructor requires new `betEventInterceptors` parameter for interceptor integration
- New validation methods in consumers for promotion eligibility

### 4. **Container Registry Changes**

- New interceptor registrations required
- Promotion client registration (simplified from GamePromotionApiClientFactory)
- Interceptor array factory patterns

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

### Step 2: Update Container Registry

```javascript
// src/container-registry.js (or your container file)
import { GamePromotionApiClient } from "@sc/game-promotion-api-client";
import * as EventInterceptors from "sc-game-base/core/event-interceptors";
import { PromotionClient } from "sc-game-base/core/game-promotion-api-client-factory";

export default class YourGameContainerRegistry extends ContainerRegistry {
  register(appConfigs, definition, gameData) {
    // Call parent registration first
    const container = super.register(appConfigs, definition, gameData);

    // Add your game-specific registrations
    this.registerGameSpecificServices();

    return container;
  }

  registerGameSpecificServices() {
    // Your existing game-specific registrations
    this.container.register({
      // ... your existing services
    });
  }
}
```

### Step 3: Add Promotion API Configuration

**Note: This step is OPTIONAL.** Skip if you don't need promotion features.

Add promotion API settings to your application configuration:

```javascript
// src/configs/app-config.js
export const appConfigs = {
  // ... existing configs

  // Promotion API settings (OPTIONAL - only add if you need promotion features)
  promotionApiSettings: {
    baseUrl: process.env.PROMOTION_API_BASE_URL || "https://promotion-api.example.com",
    timeout: parseInt(process.env.PROMOTION_API_TIMEOUT) || 5000,
    useAuthentication: process.env.PROMOTION_API_USE_AUTH !== "false",
  },
};
```

### Step 4: Create Event Interceptors (If Needed)

If your game requires custom promotion logic, create game-specific interceptors that integrate with `ProcessBetQueue`:

```javascript
// src/event-interceptors/your-game-promotion-interceptor.js
import { BaseEventInterceptor } from "sc-game-base/core/event-interceptors";

export default class YourGamePromotionInterceptor extends BaseEventInterceptor {
  constructor({ promotionClient, logService }) {
    super();
    this.promotionApiClient = promotionClient.instance();
    this.logService = logService;
  }

  shouldIntercept(context) {
    // Your game-specific logic to determine if this interceptor applies
    const { payload } = context;
    return payload?.usePromotion === true && this.promotionApiClient !== null;
  }

  async beforeEvent(context) {
    // Custom logic before bet processing
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

### Step 5: Register Custom Interceptors and ProcessBetQueue Integration

```javascript
// src/container-registry.js
import YourGamePromotionInterceptor from "./event-interceptors/your-game-promotion-interceptor.js";

export default class YourGameContainerRegistry extends ContainerRegistry {
  registerInterceptors() {
    // Call parent method first
    super.registerInterceptors();

    // Register your game-specific interceptors
    this.container.register({
      yourGamePromotionInterceptor: asClass(YourGamePromotionInterceptor).singleton(),
    });
  }

  registerInterceptorArrays() {
    // Register interceptor arrays for ProcessBetQueue integration
    this.container.register({
      betEventInterceptors: asFunction((container) => {
        const interceptors = [];

        // Add base promotion interceptor
        if (container.hasRegistration("promotionBetInterceptor")) {
          interceptors.push(container.resolve("promotionBetInterceptor"));
        }

        // Add your game-specific interceptors
        if (container.hasRegistration("yourGamePromotionInterceptor")) {
          interceptors.push(container.resolve("yourGamePromotionInterceptor"));
        }

        return interceptors;
      }).singleton(),
    });
  }

  registerProcessors() {
    // ProcessBetQueue automatically integrates with betEventInterceptors
    super.registerProcessors();
  }
}
```

### Step 6: Extend PlaceBetConsumer for Promotion Support

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

### Step 7: Update Container Registration

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

### Step 8: Configuration Updates

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

## 🧪 Testing Strategy

### Unit Tests

Update your test files to include promotion scenarios:

```javascript
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

### Issue 1: Container Resolution Errors

**Problem**: Interceptors not properly registered
**Solution**: Ensure `registerInterceptorArrays()` is called after all interceptors are registered

### Issue 2: Missing Promotion Client

**Problem**: `promotionClient` not found
**Solution**: Verify the client is registered in container registry and promotion API settings are configured

### Issue 3: Validation Failures

**Problem**: Promotion validation always fails
**Solution**: Check that `composePromotionValidationCriteria` returns valid criteria format

### Issue 4: Interceptor Not Triggered

**Problem**: Custom interceptor never executes
**Solution**: Verify `shouldIntercept()` method returns `true` for your scenarios and that interceptors are properly registered in `betEventInterceptors`

### Issue 5: Promotion API Configuration Missing

**Problem**: PromotionClient not initialized
**Solution**: Ensure `promotionApiSettings` is properly configured in your app config

### Issue 6: ProcessBetQueue Integration Issues

**Problem**: Interceptors not executing in ProcessBetQueue
**Solution**: Verify `betEventInterceptors` array is properly passed to ProcessBetQueue constructor and contains your interceptors

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
- [ ] Promotion flows working correctly
- [ ] Performance metrics within acceptable ranges
- [ ] Error handling tested
- [ ] Monitoring and alerting configured
- [ ] Documentation updated
- [ ] Team trained on new features

---

**Version**: 6.0.0  
**Last Updated**: 2025  
**Compatibility**: Node.js 16+, Pentagon API Client 1.0+
