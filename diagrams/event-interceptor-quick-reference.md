# Event Interceptor System - Quick Reference

## TL;DR

Event Interceptors provide a clean way to add cross-cutting functionality (promotions, analytics, etc.) to bet processing without modifying core logic.

## 🚀 Quick Start

### 1. Create Interceptor

```javascript
// my-interceptor.js
import BaseEventInterceptor from "./base-event-interceptor.js";

export default class MyInterceptor extends BaseEventInterceptor {
  constructor({ logService, definition, myApiClient }) {
    super({ logService, definition });
    this.myApiClient = myApiClient;
  }

  shouldIntercept(context) {
    return context.payload?.myFlag && this.myApiClient;
  }

  async beforeEvent(context) {
    try {
      const result = await this.myApiClient.process(context);
      return { success: result.ok };
    } catch (error) {
      this.logService.logError("Processing failed:", error);
      return { success: false };
    }
  }
}
```

### 2. Register in Container

```javascript
// container-registry.js
registerInterceptors() {
    super.registerInterceptors();
    this.container.register({
        myInterceptor: asClass(MyInterceptor).singleton(),
    });
}

registerInterceptorArrays() {
    this.container.register({
        betEventInterceptors: asFunction((container) => [
            container.promotionBetInterceptor,
            container.myInterceptor, // Add here
        ]).singleton(),
    });
}
```

### 3. Export from Index

```javascript
// event-interceptors/index.js
export { MyInterceptor };
```

## 📋 Method Reference

| Method                              | Purpose                         | Return               | When Called             |
| ----------------------------------- | ------------------------------- | -------------------- | ----------------------- |
| `shouldIntercept(context)`          | Check if interceptor should run | `boolean`            | Before every bet        |
| `beforeEvent(context)`              | Pre-bet processing              | `{success: boolean}` | Before bet API call     |
| `afterSuccessEvent(context)`        | Post-success operations         | `void`               | After successful bet    |
| `afterFailureEvent(context)`        | Cleanup/rollback                | `void`               | After failed bet        |
| `transformEventData(name, context)` | Enhance data                    | `Object`             | During data preparation |

## 📦 Context Objects

### shouldIntercept & beforeEvent

```javascript
{
    player: { UID, profile: {name}, session: {playerId, operatorId} },
    payload: { betChoice, amount, usePromotion, promotionId }
}
```

### afterSuccessEvent

```javascript
{
    player: { /* same */ },
    bet: { betChoice, amount, roundId },
    balance: { red: 1000 },
    betTime: Date
}
```

### transformEventData

```javascript
{
    betInfo: { amount, gameId, metadata },     // enhanceBetInfo
    betRecord: { uid, name, time, roundId },   // enhanceBetRecord
    betLog: { uid, choice, amount, time }      // enhanceBetLog
}
```

## ✅ Best Practices Checklist

### shouldIntercept

- [ ] Fast checks first (payload flags)
- [ ] Validate API client availability
- [ ] Return false if any dependency missing

### beforeEvent

- [ ] Always return `{success: boolean}`
- [ ] Handle exceptions with try/catch
- [ ] Log errors with player context
- [ ] Don't block on non-critical failures

### afterSuccessEvent/afterFailureEvent

- [ ] Never throw exceptions
- [ ] Log errors but continue processing
- [ ] Keep operations lightweight

### transformEventData

- [ ] Only transform when necessary
- [ ] Use switch statement for transform types
- [ ] Call `super.transformEventData()` for unknown types

### General

- [ ] Single responsibility per interceptor
- [ ] Use dependency injection
- [ ] Write unit tests
- [ ] Follow game base naming conventions

## 🛠 Common Patterns

### API Availability Check

```javascript
shouldIntercept(context) {
    if (!context.payload?.flag) return false;
    if (!this.apiClient) return false;
    return true;
}
```

### Error Handling

```javascript
async beforeEvent(context) {
    try {
        const result = await this.apiClient.call();
        return { success: !!result };
    } catch (error) {
        this.logService.logError(`Failed for ${context.player.profile.name}:`, error);
        return { success: false };
    }
}
```

### Data Enhancement

```javascript
transformEventData(transformName, context) {
    switch (transformName) {
        case "enhanceBetInfo":
            if (this.shouldEnhance(context)) {
                context.betInfo.metadata.myFlag = true;
            }
            return context.betInfo;
        default:
            // Default implementation returns first context value
            return super.transformEventData(transformName, context);
    }
}
```

## 🐛 Troubleshooting

| Problem                 | Check                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| Interceptor not called  | `shouldIntercept` returns true? Registered in container? Added to array? |
| beforeEvent blocks bets | Returns `{success: true}`? No unhandled exceptions?                      |
| Data not enhanced       | Transform name correct? Method implemented? Context has data?            |
| API calls fail          | Client injected? Available in `shouldIntercept`? Error handling?         |

## 📊 Performance Tips

### Do ✅

- Light `shouldIntercept` checks
- Fail fast on missing dependencies
- Log errors, don't throw in after\* methods
- Minimal data transformation

### Don't ❌

- Heavy logic in `shouldIntercept`
- Block bet processing on non-critical failures
- Transform data unnecessarily
- Skip error handling

## 🧪 Testing Template

```javascript
describe("MyInterceptor", () => {
  let interceptor, mockApiClient, context;

  beforeEach(() => {
    mockApiClient = { process: jest.fn() };
    interceptor = new MyInterceptor({
      logService: { logError: jest.fn() },
      definition: { id: 1 },
      myApiClient: mockApiClient,
    });

    context = {
      player: { profile: { name: "Test" } },
      payload: { myFlag: true },
    };
  });

  it("should intercept when flag is true", () => {
    expect(interceptor.shouldIntercept(context)).toBe(true);
  });

  it("should not intercept when API unavailable", () => {
    interceptor.myApiClient = null;
    expect(interceptor.shouldIntercept(context)).toBe(false);
  });

  it("should handle API success", async () => {
    mockApiClient.process.mockResolvedValue({ ok: true });
    const result = await interceptor.beforeEvent(context);
    expect(result.success).toBe(true);
  });
});
```

---

For detailed documentation, see [event-interceptor-system.md](./event-interceptor-system.md)
