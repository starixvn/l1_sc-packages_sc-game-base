# Reusable Event Interceptor System Guide

## Overview

The Event Interceptor System has been designed to be **reusable across any event consumer** in the SC Game Base architecture. This guide shows you how to integrate interceptors into different types of event consumers beyond just bet processing.

## Architecture Components

### 1. **EventInterceptorMixin**

- **Purpose**: Provides interceptor functionality to any class
- **Location**: `src/core/mixins/event-interceptor-mixin.js`
- **Use Case**: Apply to any consumer that needs interceptor support

### 2. **BaseGenericEventInterceptor**

- **Purpose**: Base class for creating interceptors for any event type
- **Location**: `src/core/event-interceptors/base-generic-event-interceptor.js`
- **Use Case**: Extend this for custom interceptor implementations

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
import BaseGenericEventInterceptor from "./base-generic-event-interceptor.js";

export default class AuditInterceptor extends BaseGenericEventInterceptor {
  constructor({ logService, definition, auditApiClient }) {
    super({ logService, definition }, "audit"); // Event type
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
      this.log("logError", "Audit logging failed", error);
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

### Pattern 3: Configuring Multiple Interceptor Types

```javascript
// In container-registry.js
registerInterceptorArrays() {
    this.container.register({
        // Bet processing interceptors
        betEventInterceptors: asFunction((container) => {
            const interceptors = [];
            if (container.hasRegistration("promotionBetInterceptor")) {
                interceptors.push(container.resolve("promotionBetInterceptor"));
            }
            if (container.hasRegistration("auditInterceptor")) {
                interceptors.push(container.resolve("auditInterceptor"));
            }
            return interceptors;
        }).singleton(),

        // Settlement interceptors
        settlementEventInterceptors: asFunction((container) => {
            const interceptors = [];
            if (container.hasRegistration("analyticsSettlementInterceptor")) {
                interceptors.push(container.resolve("analyticsSettlementInterceptor"));
            }
            if (container.hasRegistration("auditInterceptor")) {
                interceptors.push(container.resolve("auditInterceptor"));
            }
            return interceptors;
        }).singleton(),

        // Round management interceptors
        roundEventInterceptors: asFunction((container) => {
            const interceptors = [];
            if (container.hasRegistration("metricsInterceptor")) {
                interceptors.push(container.resolve("metricsInterceptor"));
            }
            return interceptors;
        }).singleton(),

        // User action interceptors
        userEventInterceptors: asFunction((container) => {
            const interceptors = [];
            if (container.hasRegistration("sessionTrackingInterceptor")) {
                interceptors.push(container.resolve("sessionTrackingInterceptor"));
            }
            return interceptors;
        }).singleton(),
    });
}
```

## Real-World Use Cases

### 1. **User Sign-In Consumer with Interceptors**

```javascript
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

### 2. **Game Round Consumer with Interceptors**

```javascript
import EventInterceptorMixin from "../mixins/event-interceptor-mixin.js";

const RoundProcessorWithInterceptors = EventInterceptorMixin(class {});

export default class GameRoundConsumer extends RoundProcessorWithInterceptors {
  constructor({ gameData, logService, roundEventInterceptors = [] }) {
    super();
    this.gameData = gameData;
    this.logService = logService;
    this.initializeInterceptors(roundEventInterceptors, "game-round");
  }

  async consume(roundData) {
    const interceptors = this.getApplicableInterceptors({ roundData });

    // Pre-round processing
    const beforeResult = await this.executeInterceptorEvent("beforeEvent", interceptors, {
      roundData,
      gameData: this.gameData,
    });

    if (!beforeResult.success) return;

    // Enhanced round data
    let enhancedRound = this.executeInterceptorTransform("enhanceRound", interceptors, {
      roundData,
    });

    // Process round
    const result = await this.processRound(enhancedRound);

    // Post-round processing
    if (result.success) {
      await this.executeInterceptorEvent("afterSuccessEvent", interceptors, {
        roundData: enhancedRound,
        result,
      });
    } else {
      await this.executeInterceptorEvent("afterFailureEvent", interceptors, {
        roundData: enhancedRound,
        error: result.error,
      });
    }
  }
}
```

## Best Practices

### 1. **Naming Conventions**

- **Event Types**: Use kebab-case (e.g., 'bet', 'settlement', 'user-signin', 'game-round')
- **Interceptor Arrays**: Use pattern `{eventType}EventInterceptors`
- **Transform Names**: Use camelCase (e.g., 'enhanceBetInfo', 'enhanceSession')

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
describe("MyEventConsumer with Interceptors", () => {
  let consumer;
  let mockInterceptor;

  beforeEach(() => {
    mockInterceptor = {
      shouldIntercept: jest.fn().mockReturnValue(true),
      beforeEvent: jest.fn().mockResolvedValue({ success: true }),
      afterSuccessEvent: jest.fn(),
      transformEventData: jest.fn((_name, ctx) => Object.values(ctx)[0]),
    };

    consumer = new MyEventConsumer({
      gameData: mockGameData,
      logService: mockLogService,
      myEventInterceptors: [mockInterceptor],
    });
  });

  it("should execute interceptor workflow", async () => {
    await consumer.consume({ eventData: "test" });

    expect(mockInterceptor.shouldIntercept).toHaveBeenCalled();
    expect(mockInterceptor.beforeEvent).toHaveBeenCalled();
    expect(mockInterceptor.afterSuccessEvent).toHaveBeenCalled();
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

This reusable system provides consistent interceptor functionality across all event consumers while maintaining the established SC Game Base architecture patterns.
