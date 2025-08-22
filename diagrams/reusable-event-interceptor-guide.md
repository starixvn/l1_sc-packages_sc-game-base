# Reusable Event Interceptor System Guide

## Overview

The Event Interceptor System has been designed to be **reusable across any event consumer** in the SC Game Base architecture. This guide shows you how to integrate interceptors into different types of event consumers beyond just bet processing.

**Current Implementation**: The system is currently implemented in `ProcessBetQueue` cron with `PromotionBetInterceptor`, providing a proven foundation for expansion to other consumers.

## Architecture Components

### 1. **EventInterceptorMixin**

- **Purpose**: Provides interceptor functionality to any class
- **Location**: `src/core/mixins/event-interceptor-mixin.js`
- **Use Case**: Apply to any consumer that needs interceptor support

### 2. **BaseEventInterceptor**

- **Purpose**: Base class for creating interceptors for any event type
- **Location**: `src/core/event-interceptors/base-event-interceptor.js`
- **Use Case**: Extend this for custom interceptor implementations

## Current Implementation Example

### ProcessBetQueue with PromotionBetInterceptor

```javascript
// Current working implementation in process-bet-queue.js
import EventInterceptorMixin from "../mixins/event-interceptor-mixin.js";

// Create base class
class BaseBetProcessor {
  constructor() {
    // Base class for ProcessBetQueue
  }
}

// Apply interceptor mixin
const BetProcessorWithInterceptors = EventInterceptorMixin(BaseBetProcessor);

export default class ProcessBetQueue extends BetProcessorWithInterceptors {
  constructor({
    definition,
    gameData,
    placeBetPublisher,
    placeBet,
    logService,
    betsRepository,
    betLogsRepository,
    gameManagementApiClientFactory,
    baseMetrics,
    betEventInterceptors = [], // Array of interceptors
  }) {
    super();

    // Standard dependencies
    this.definition = definition;
    this.gameData = gameData;
    this.placeBetPublisher = placeBetPublisher;
    this.placeBet = placeBet;
    this.logService = logService;
    this.betsRepository = betsRepository;
    this.betLogsRepository = betLogsRepository;
    this.baseMetrics = baseMetrics;
    this.gameManagementApiClient = gameManagementApiClientFactory.instance();

    // Initialize interceptor system
    this.initializeInterceptors(betEventInterceptors, "bet");
  }

  async proceedBet(player, payload) {
    // Get applicable interceptors for this bet
    const applicableInterceptors = this.getApplicableInterceptors({ payload });

    if (!(await this.validateBetRequest(player, payload))) {
      return;
    }

    // Execute beforeEvent interceptors
    const beforeEventResult = await this.executeInterceptorEvent("beforeEvent", applicableInterceptors, {
      player,
      payload,
    });

    if (!beforeEventResult.success) {
      return; // Error already handled by interceptor
    }

    // Transform bet info with interceptors
    let betInfo = this.formatApiBetInfo(payload);
    betInfo = this.executeInterceptorTransform("enhanceBetInfo", applicableInterceptors, {
      betInfo,
      payload,
    });

    const apiResult = await this.placeBet({ id: player.UID, session: player.session }, betInfo);
    const { response } = apiResult;

    if (apiResult.isOk) {
      await this.handleSuccessBet(player, response, betInfo.gameRoundId, payload, applicableInterceptors);
    } else {
      await this.handleFailedBet(player, response, payload, applicableInterceptors);
    }
  }

  async handleSuccessBet(player, balance, roundId, bet, applicableInterceptors) {
    // ... existing logic ...

    const betTime = await this.upsertBet(player, roundId, bet, rate, applicableInterceptors);

    // Execute afterSuccessEvent interceptors
    if (applicableInterceptors) {
      await this.executeInterceptorEvent("afterSuccessEvent", applicableInterceptors, {
        player,
        bet,
        balance,
        betTime,
      });
    }
  }

  async upsertBet(player, roundId, bet, rate, applicableInterceptors) {
    let newBet = {
      uid: player.UID,
      name: player.profile.name,
      time: new Date(),
      odds: configs.odds,
      roundId,
      clientSeed: bet.clientSeed,
    };

    // Transform bet record with interceptors
    if (applicableInterceptors) {
      newBet = this.executeInterceptorTransform("enhanceBetRecord", applicableInterceptors, {
        betRecord: newBet,
        bet,
      });
    }

    // ... database operations ...
  }
}
```

## Usage Patterns

### Pattern 1: Adding Interceptors to Existing Consumer

```javascript
// Before: Regular consumer
import GameData from "./../game-data";

export default class MyEventConsumer {
  constructor({ gameData, logService }) {
    this.gameData = gameData;
    this.logService = logService;
  }

  async consume(eventData) {
    // Process event
  }
}
```

```javascript
// After: Consumer with interceptors
import GameData from "./../game-data";
import EventInterceptorMixin from "../mixins/event-interceptor-mixin.js";

// Create base class
class BaseMyProcessor {
  constructor() {}
}

// Apply interceptor mixin
const MyProcessorWithInterceptors = EventInterceptorMixin(BaseMyProcessor);

export default class MyEventConsumer extends MyProcessorWithInterceptors {
  constructor({ gameData, logService, myEventInterceptors = [] }) {
    super();
    this.gameData = gameData;
    this.logService = logService;

    // Initialize interceptor system
    this.initializeInterceptors(myEventInterceptors, "my-event-type");
  }

  async consume(eventData) {
    // Get applicable interceptors
    const interceptors = this.getApplicableInterceptors({ eventData });

    // Execute beforeEvent
    const beforeResult = await this.executeInterceptorEvent("beforeEvent", interceptors, {
      eventData,
      gameData: this.gameData,
    });

    if (!beforeResult.success) {
      return; // Handle error
    }

    // Transform data if needed
    let processedData = this.prepareData(eventData);
    processedData = this.executeInterceptorTransform("enhanceData", interceptors, {
      data: processedData,
      eventData,
    });

    // Process the event
    const result = await this.processEvent(processedData);

    // Execute appropriate after event
    if (result.success) {
      await this.executeInterceptorEvent("afterSuccessEvent", interceptors, {
        eventData,
        result,
      });
    } else {
      await this.executeInterceptorEvent("afterFailureEvent", interceptors, {
        eventData,
        error: result.error,
      });
    }
  }
}
```

### Pattern 2: Creating Custom Interceptors

```javascript
// Example: Audit interceptor for any event type
import BaseEventInterceptor from "./base-event-interceptor.js";

export default class AuditInterceptor extends BaseEventInterceptor {
  constructor({ logService, definition, auditApiClient }) {
    super({ logService, definition });
    this.auditApiClient = auditApiClient;
  }

  shouldIntercept(context) {
    // Intercept if audit client is available
    return Boolean(this.auditApiClient);
  }

  async beforeEvent(context) {
    try {
      await this.auditApiClient.logEventStart({
        eventType: this.eventType,
        timestamp: new Date(),
        context: this.sanitizeContext(context),
      });
      return { success: true };
    } catch (error) {
      this.logService.logError("Audit logging failed", error);
      return { success: false, error: error.message };
    }
  }

  async afterSuccessEvent(context) {
    await this.auditApiClient.logEventSuccess({
      eventType: this.eventType,
      timestamp: new Date(),
      context: this.sanitizeContext(context),
    });
  }

  async afterFailureEvent(context) {
    await this.auditApiClient.logEventFailure({
      eventType: this.eventType,
      timestamp: new Date(),
      error: context.error,
    });
  }

  transformEventData(transformName, context) {
    // Add audit metadata to any data transformation
    const data = Object.values(context)[0];
    return {
      ...data,
      audit: {
        interceptorName: this.name,
        timestamp: new Date(),
        transformName,
      },
    };
  }

  sanitizeContext(context) {
    // Remove sensitive data for audit logs
    const { player, ...safeContext } = context;
    return {
      ...safeContext,
      playerId: player?.UID || "unknown",
    };
  }
}
```

### Pattern 3: Container Registry Configuration

```javascript
// Current implementation in container-registry.js
registerInterceptors() {
    this.container.register({
        // Individual interceptor registration
        promotionBetInterceptor: asClass(EventInterceptors.PromotionBetInterceptor).singleton().proxy(),

        // Future interceptors can be added here
        // auditInterceptor: asClass(EventInterceptors.AuditInterceptor).singleton(),
        // analyticsInterceptor: asClass(EventInterceptors.AnalyticsInterceptor).singleton(),
    });
}

registerInterceptorArrays() {
    this.container.register({
        // Bet processing interceptors (current implementation)
        betEventInterceptors: asFunction(() => {
            const interceptors = [];

            const promotionBetInterceptor = this.container.resolve("promotionBetInterceptor");
            if (promotionBetInterceptor) {
                interceptors.push(promotionBetInterceptor);
            }

            // Future interceptors can be added conditionally
            // if (this.container.hasRegistration("auditInterceptor")) {
            //     interceptors.push(this.container.resolve("auditInterceptor"));
            // }

            return interceptors;
        }).singleton(),

        // Future interceptor arrays for other event types
        // settlementEventInterceptors: asFunction((container) => {
        //     const interceptors = [];
        //     if (container.hasRegistration("analyticsSettlementInterceptor")) {
        //         interceptors.push(container.resolve("analyticsSettlementInterceptor"));
        //     }
        //     return interceptors;
        // }).singleton(),

        // userEventInterceptors: asFunction((container) => {
        //     const interceptors = [];
        //     if (container.hasRegistration("sessionTrackingInterceptor")) {
        //         interceptors.push(container.resolve("sessionTrackingInterceptor"));
        //     }
        //     return interceptors;
        // }).singleton(),
    });
}
```

## Real-World Use Cases

### 1. **Current Implementation: PromotionBetInterceptor**

```javascript
// Actual working interceptor in the codebase
import BaseEventInterceptor from "./base-event-interceptor.js";

export default class PromotionBetInterceptor extends BaseEventInterceptor {
  constructor({ logService, definition, placeBetPublisher, gamePromotionApiClient }) {
    super({ logService, definition });
    this.placeBetPublisher = placeBetPublisher;
    this.gamePromotionApiClient = gamePromotionApiClient.instance();
  }

  shouldIntercept(context) {
    const { payload } = context;
    return !!(payload && payload.usePromotion && payload.promotionId && this.isPromotionApiAvailable());
  }

  async beforeEvent(context) {
    const { player, payload } = context;
    // Deduct bonus item before bet placement
    const deductResult = await this.gamePromotionApiClient.deductBonusItem({
      operatorId: player.session.operatorId,
      playerId: player.session.playerId,
      promotionId: player.promotion.promotionId,
      siteName: player.session.siteName,
    });

    if (!deductResult || !deductResult.success) {
      // Publish failure notification
      this.placeBetPublisher.publishGameFailedBet(player.UID, {
        endBet: -1,
        betChoice: payload.betChoice,
        notice: { errorCode: helpers.noticeHelper.invalidBet, msg: "Promotion deduction failed" },
      });
      return { success: false };
    }

    // Update player's promotion data
    player.promotion.remainingBonusItems = deductResult.remainingBonusItems || player.promotion.remainingBonusItems - 1;
    return { success: true };
  }

  transformEventData(transformName, context) {
    const { payload, betInfo, betRecord, betLog, bet } = context;

    switch (transformName) {
      case "enhanceBetInfo":
        if (betInfo && payload.promotionId) {
          betInfo.promotionCode = payload.promotionCode;
          betInfo.promotionId = payload.promotionId;
        }
        return betInfo;

      case "enhanceBetRecord":
        if (bet?.promotionId) {
          betRecord.promotionId = bet.promotionId;
        }
        return betRecord;

      case "enhanceBetLog":
        if (bet?.promotionId) {
          betLog.promotionId = bet.promotionId;
        }
        return betLog;

      default:
        return super.transformEventData(transformName, context);
    }
  }
}
```

### 2. **Future Implementation: User Sign-In Consumer**

```javascript
// Example of how to extend to other consumers
import EventInterceptorMixin from "../mixins/event-interceptor-mixin.js";

const UserSignInWithInterceptors = EventInterceptorMixin(class {});

export default class UserSignInConsumer extends UserSignInWithInterceptors {
  constructor({ gameData, logService, userEventInterceptors = [] }) {
    super();
    this.gameData = gameData;
    this.logService = logService;
    this.initializeInterceptors(userEventInterceptors, "user-signin");
  }

  async consume(user, sessionData) {
    const interceptors = this.getApplicableInterceptors({ user, sessionData });

    // Track sign-in attempt
    await this.executeInterceptorEvent("beforeEvent", interceptors, {
      user,
      sessionData,
    });

    // Enhanced session data
    let enhancedSession = this.executeInterceptorTransform("enhanceSession", interceptors, {
      sessionData,
      user,
    });

    // Process sign-in
    const signInResult = await this.processSignIn(user, enhancedSession);

    // Track result
    if (signInResult.success) {
      await this.executeInterceptorEvent("afterSuccessEvent", interceptors, {
        user,
        sessionData: enhancedSession,
        result: signInResult,
      });
    } else {
      await this.executeInterceptorEvent("afterFailureEvent", interceptors, {
        user,
        error: signInResult.error,
      });
    }
  }
}
```

## Standard Transform Names

Based on current implementation, use these standardized transform names:

### **Bet Processing Transforms**

- `enhanceBetInfo` - Enhance API bet information before submission
- `enhanceBetRecord` - Enhance bet record before database storage
- `enhanceBetLog` - Enhance bet log before database storage

### **Future Transform Names**

- `enhanceSession` - Enhance user session data
- `enhanceRound` - Enhance round data
- `enhanceSettlement` - Enhance settlement data
- `enhanceUserData` - Enhance user profile data

## Best Practices

### 1. **Naming Conventions**

- **Event Types**: Use kebab-case (e.g., 'bet', 'settlement', 'user-signin', 'game-round')
- **Interceptor Arrays**: Use pattern `{eventType}EventInterceptors`
- **Transform Names**: Use camelCase with 'enhance' prefix (e.g., 'enhanceBetInfo', 'enhanceSession')

### 2. **Error Handling**

- Always check `beforeEvent` result before proceeding
- Use `afterFailureEvent` for cleanup and rollback operations
- Log errors appropriately using the interceptor's log method

### 3. **Performance Considerations**

- Keep `shouldIntercept` checks lightweight
- Avoid heavy operations in `transformEventData`
- Use async operations wisely in event methods

### 4. **Testing**

```javascript
describe("ProcessBetQueue with Interceptors", () => {
  let processBetQueue;
  let mockPromotionInterceptor;

  beforeEach(() => {
    mockPromotionInterceptor = {
      shouldIntercept: jest.fn().mockReturnValue(true),
      beforeEvent: jest.fn().mockResolvedValue({ success: true }),
      afterSuccessEvent: jest.fn(),
      transformEventData: jest.fn((transformName, ctx) => {
        if (transformName === "enhanceBetInfo") {
          return { ...Object.values(ctx)[0], promotionId: "test-promo" };
        }
        return Object.values(ctx)[0];
      }),
    };

    processBetQueue = new ProcessBetQueue({
      gameData: mockGameData,
      definition: mockDefinition,
      logService: mockLogService,
      betEventInterceptors: [mockPromotionInterceptor],
      // ... other dependencies
    });
  });

  it("should execute interceptor workflow for promotion bet", async () => {
    const player = createMockPlayer();
    const promotionPayload = {
      amount: 100,
      betChoice: "red",
      usePromotion: true,
      promotionId: "promo123",
    };

    await processBetQueue.proceedBet(player, promotionPayload);

    expect(mockPromotionInterceptor.shouldIntercept).toHaveBeenCalled();
    expect(mockPromotionInterceptor.beforeEvent).toHaveBeenCalled();
    expect(mockPromotionInterceptor.transformEventData).toHaveBeenCalledWith("enhanceBetInfo", expect.any(Object));
  });
});
```

## Workflow Summary

1. **Apply Mixin**: Use `EventInterceptorMixin` to add interceptor support
2. **Initialize**: Call `initializeInterceptors()` with interceptor array and event type
3. **Filter**: Use `getApplicableInterceptors()` to get relevant interceptors
4. **Execute Events**: Call `executeInterceptorEvent()` for lifecycle events
5. **Transform Data**: Use `executeInterceptorTransform()` for data enhancement
6. **Handle Results**: Check success/failure and respond appropriately

## Current Status and Roadmap

**✅ Implemented:**

- EventInterceptorMixin providing core functionality
- BaseEventInterceptor base class
- PromotionBetInterceptor with full lifecycle support
- ProcessBetQueue integration with interceptors
- Container registry support for interceptor arrays
- Comprehensive test coverage

**🚧 Potential Extensions:**

- User session interceptors
- Round management interceptors
- Settlement interceptors
- Analytics interceptors
- Audit logging interceptors

This reusable system provides consistent interceptor functionality across all event consumers while maintaining the established SC Game Base architecture patterns.
