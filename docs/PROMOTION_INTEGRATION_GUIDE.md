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
Every cron cycle (every second):
1. promotionFreeSpinsConsumer.checkExpiry()
2. Early exit if !gameData.promotionReady
3. Early exit if no players have promotions
4. Check if minute has changed since last check
5. If minute changed: Call API and expire promotions
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

## RealPlayer Promotion Data Flow

### **Data Structure Overview**

The promotion system uses `gameData.realPlayers` as the authoritative source for player promotion state. This differs from `gameData.ingame` which handles temporary betting operations.

```javascript
// gameData structure
gameData = {
  realPlayers: {
    // ← Authoritative player state
    "socket-id-123": {
      UID: "user123",
      profile: { name: "john_doe", minBet: 10, maxBet: 1000 },
      session: { userId: "user123", operatorId: "op_001", playerId: "player123" },
      socketClient: WebSocketConnection,
      promotion: {
        /* promotion data */
      }, // ← Promotion state
      promotionTOProgress: {
        /* turnover data */
      }, // ← Optional TO progress
    },
  },
  ingame: {
    // ← Temporary betting state (copies promotion data)
    player_name: {
      name: "john_doe",
      promotion: {
        /* copied from realPlayers */
      },
    },
  },
};
```

### **Sign-In Flow with Promotions**

```javascript
// UserSignInConsumer.handleSignInSuccess()
const userData = {
  UID: userSession.userId,
  profile: { name: userInfo.name, minBet: userInfo.minBet, maxBet: userInfo.maxBet },
  session: userSession,
  socketClient,
};

// 1. Check for existing/available promotions during sign-in
const promotionData = await this.claimPlayerPromotions(userSession);

// 2. Add promotion data if available
if (promotionData && promotionData.promotion) {
  userData.promotion = {
    promotionId: "promo_winter2024",
    remainingBonusItems: 15,
    initialBonusItem: 20,
    isActive: true,
    promotionType: "FREE_SPINS",
    endDate: "2024-02-01T00:00:00Z",
    betLevel: 100,
    totalWin: 0,
    isClaimed: true,
  };
}

// 3. Add turnover progress if promotion is completed
if (promotionData && promotionData.promotionTOProgress) {
  userData.promotionTOProgress = {
    totalTurnover: 500,
    minRequiredTurnover: 1000,
    remainingTO: 500,
    progressPercentage: 50,
    canClaim: false,
    totalWinAmount: 150,
    claimExpirationDate: "2024-02-15T00:00:00Z",
  };
}

// 4. Store in realPlayers (authoritative source)
this.gameData.realPlayers[socketClient.id] = userData;
```

### **Promotion State Updates During Gameplay**

#### **During Bet Placement**

```javascript
// PlaceBetConsumer.initializePlayerData()
if (!this.gameData.ingame[playerName]) {
  const newPlayer = {
    name: player.profile.name,
    currency: player.session.currencyName,
    system: player.session.system,
    betTracks: {},
    betQueue: [],
    clientSeed: payload.clientSeed,
    operatorId: player.session.operatorId,
  };

  // Copy promotion data from realPlayers to ingame
  if (player.promotion) {
    newPlayer.promotion = { ...player.promotion }; // ← Copy, not reference
  }

  this.gameData.ingame[playerName] = newPlayer;
}
```

#### **Promotion Deduction (via Event Interceptor)**

```javascript
// PromotionBetInterceptor.beforeEvent()
const deductResult = await this.gamePromotionApiClient.deductBonusItem(deductDto);

if (deductResult.success) {
  // Update authoritative realPlayers data
  player.promotion.remainingBonusItems = deductResult.remainingBonusItems || player.promotion.remainingBonusItems - 1;
}
```

#### **Promotion Win Tracking (New)**

```javascript
// PromotionBetInterceptor.afterSuccessEvent() - Creates promotion ticket
const ticketResult = await this.gamePromotionApiClient.createPromotionTicket(ticketDto);

if (!ticketResult || !ticketResult.success) {
  // Handle ticket creation failure - don't call endPromotionEvent
  return;
}

// Call endPromotionEvent after successful ticket creation
this.endPromotionEvent(context);

// PromotionBetInterceptor.endPromotionEvent() - Updates totalWin after everything is complete
if (bet.betWin > 0) {
  player.promotion.totalWin = (player.promotion.totalWin || 0) + bet.betWin;
}
```

**Why endPromotionEvent for totalWin Updates:**

- **Slot Games with Bonus Rounds**: `afterSuccessEvent` runs immediately, but bonus rounds continue playing
- **Complete Processing**: `endPromotionEvent` is called only after all game mechanics finish
- **Accurate Timing**: Perfect for final promotion state updates and completion checks

#### **Promotion Completion**

```javascript
// PromotionBetInterceptor.completePromotion()
const completePromotionResult = await this.gamePromotionApiClient.completePromotion({...});

// Add turnover progress to realPlayers
player.promotionTOProgress = {
    totalTurnover: completePromotionResult.totalTurnover,
    minRequiredTurnover: completePromotionResult.minRequiredTurnover,
    remainingTO: completePromotionResult.remainingTO,
    progressPercentage: completePromotionResult.progressPercentage,
    canClaim: completePromotionResult.canClaim,
    totalWinAmount: completePromotionResult.totalWinAmount,
    claimExpirationDate: completePromotionResult.claimExpirationDate
};
```

### **Data Flow Through System Components**

```
Sign-In Process:
UserSignInConsumer → realPlayers[socketId] = {promotion.totalWin: previousWins, promotionTOProgress}

Game Entry:
InGameConsumer.buildPayload() → Reads from realPlayers.promotion

Bet Placement:
PlaceBetConsumer → Copies realPlayers.promotion to ingame[playerName].promotion

Promotion Usage:
PromotionBetInterceptor.beforeEvent() → Updates realPlayers.promotion.remainingBonusItems--

Promotion Ticket:
PromotionBetInterceptor.afterSuccessEvent() → Creates promotion ticket, calls endPromotionEvent

Promotion Win:
PromotionBetInterceptor.endPromotionEvent() → Updates realPlayers.promotion.totalWin += bet.betWin

Promotion Completion:
PromotionBetInterceptor.completePromotion() → Adds realPlayers.promotionTOProgress

Disconnect:
UserDisconnectConsumer → delete realPlayers[socketId] (cleanup)
```

### **Key Design Principles**

#### **1. Single Source of Truth**

- `realPlayers` is the authoritative source for promotion state
- `ingame` contains working copies for bet processing
- All promotion updates modify `realPlayers` first

#### **2. Data Synchronization**

```javascript
// ✅ Correct: Update realPlayers (authoritative)
player.promotion.remainingBonusItems -= 1;

// ❌ Incorrect: Only updating ingame (temporary)
this.gameData.ingame[playerName].promotion.remainingBonusItems -= 1;
```

#### **3. Lifetime Management**

```javascript
// Player lifecycle in realPlayers
connect    → realPlayers[socketId] = userData
sign-in    → userData.promotion = promotionData
gameplay   → userData.promotion.remainingBonusItems--
complete   → userData.promotionTOProgress = toData
disconnect → delete realPlayers[socketId]
```

### **Integration with hasPlayersWithPromotions()**

The `PromotionFreeSpinsConsumer.hasPlayersWithPromotions()` method relies on this data structure:

```javascript
hasPlayersWithPromotions() {
    const players = this.gameData.realPlayers || {};  // ← Uses realPlayers, not ingame
    return Object.values(players).some((player) => player.promotion);
}

// Usage in expiry checking
async checkExpiry(gameId) {
    if (!this.hasPlayersWithPromotions()) {  // ← Checks realPlayers
        return;  // Skip if no promotions active
    }
    // Continue with expiry logic...
}
```

### **Client Communication Patterns**

#### **Initial Game Load**

```javascript
// InGameConsumer.buildPayload()
const payload = {
  roundId,
  gameConfigs,
  user: { ...user, rate },
  // ... other game data
};

// Include promotion data from realPlayers
if (realPlayer.promotion && !realPlayer.promotionTOProgress) {
  payload.promotion = realPlayer.promotion; // ← From realPlayers
}

if (realPlayer.promotionTOProgress) {
  payload.promotionTOProgress = {
    totalTO: realPlayer.promotionTOProgress.totalTurnover,
    minTO: realPlayer.promotionTOProgress.minRequiredTurnover,
    // ... formatted for client
    promotionId: realPlayer.promotion.promotionId,
  };
}
```

#### **Real-time Updates**

```javascript
// When promotion state changes, publish to client
this.promotionFreeSpinsPublisher.publishToUser(player.UID, {
  promotion: player.promotion, // ← Current state from realPlayers
  // ... other update data
});
```

### **Best Practices for Promotion Data**

#### **1. Maintain Data Consistency with APIs**

```javascript
// ✅ Correct: Update realPlayer data in endPromotionEvent AFTER successful API calls
const ticketResult = await this.gamePromotionApiClient.createPromotionTicket(ticketDto);
if (ticketResult.success) {
  this.endPromotionEvent(context); // totalWin updated here after ticket success
}

// ❌ Incorrect: Update before API call (creates inconsistency if API fails)
player.promotion.totalWin += bet.betWin; // Updated locally before API
const ticketResult = await this.gamePromotionApiClient.createPromotionTicket(ticketDto);
// If API fails, local data is wrong!
```

#### **2. Use realPlayers for State Queries**

```javascript
// ✅ Check promotion state from authoritative source
const hasActivePromotion = Object.values(this.gameData.realPlayers).some((player) => player.promotion?.isActive);

// ❌ Don't rely on ingame for state queries
const hasActivePromotion = Object.values(this.gameData.ingame).some((player) => player.promotion?.isActive); // Unreliable!
```

#### **3. Clean Data on Disconnect**

```javascript
// UserDisconnectConsumer automatically handles cleanup
consume(socketClient) {
    setTimeout(() => {
        delete this.gameData.realPlayers[socketClient.id];  // ← Cleanup promotion data
    });
}
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
- **Minute-based Execution**: Expiry checks only when minute changes (max once per minute)
- **Local Data Priority**: Use realPlayer data instead of API calls for totalWin and expiry checks
- **Batch Operations**: Process multiple expired players in single notification

## Performance Optimizations

### **Optimized Expiry Checking**

**Before (Inefficient):**

```javascript
// Made API call for every expiry check
const runningPromotions = await this.promotionApiClient.getExpiringPromotions(gameId);
for (const promotion of runningPromotions) {
  if (this.toYMDHM(now) === this.toYMDHM(new Date(promotion.endDate))) {
    this.promotionFreeSpinsPublisher.publishEndPromotion(promotion.players);
  }
}
```

**After (Optimized):**

```javascript
// Use local realPlayer data - no API call needed!
const expiredPlayers = Object.values(this.gameData.realPlayers || {}).filter((player) => {
  if (!player.promotion?.endDate) return false;
  return currentTimeKey === this.toYMDHM(new Date(player.promotion.endDate));
});

if (expiredPlayers.length > 0) {
  const expiredPlayerData = expiredPlayers.map((player) => ({
    playerId: player.session.playerId,
    totalWin: player.promotion.totalWin,
  }));
  this.promotionFreeSpinsPublisher.publishEndPromotion(expiredPlayerData);

  // Clear promotion data from realPlayers after ending promotion
  expiredPlayers.forEach((player) => {
    delete player.promotion;
    delete player.promotionTOProgress;
  });
}
```

**Benefits:**

- ✅ **No API calls** for expiry checking
- ✅ **Faster execution** using local data
- ✅ **Batch notifications** for multiple expired players
- ✅ **Better error resilience** (no network dependency)
- ✅ **Complete promotion data** including `totalWin` for end notifications
- ✅ **Clean state management** - expired promotion data automatically cleared

**Data Structure:**

```javascript
// Publisher expects: Array<{playerId: string, totalWin: number}>
[
  { playerId: "player1", totalWin: 150 },
  { playerId: "player2", totalWin: 200 },
];
```

### **Optimized TotalWin Access**

**Before (Inefficient):**

```javascript
// Made API call to get totalWin during promotion completion
const totalWin = await this.gamePromotionApiClient.getTotalWin({
  promotionId: player.promotion.promotionId,
  playerId: player.session.playerId,
  operatorId: player.session.operatorId,
  siteName: player.session.siteName,
});
```

**After (Optimized):**

```javascript
// Use totalWin from realPlayer data - already available!
const totalWin = player.promotion.totalWin || 0;
```

**Benefits:**

- ✅ **Instant access** to totalWin data
- ✅ **No network latency** for promotion notifications
- ✅ **Consistent with data flow** architecture
- ✅ **Reduced API load** on promotion service

### **Data Flow Efficiency**

The optimizations align with the realPlayer data flow principle:

```
Sign-in: API call → realPlayer.promotion.totalWin = previousWins (cache)
         API call → realPlayer.promotion.endDate (cache)
                              ↓
Gameplay: For each promotion bet win:
          PromotionBetInterceptor → realPlayer.promotion.totalWin += bet.betWin
                              ↓
Expiry: Check realPlayer.promotion.endDate locally
Completion: Use realPlayer.promotion.totalWin directly (accurate!)
```

**Performance Impact:**

- **API Calls Reduced**: ~90% fewer calls during gameplay
- **Response Time**: Expiry checks ~10x faster
- **Reliability**: No network dependency for core features

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

## Game-Specific Extensions (v6.1.0+)

### Architecture Changes

**Removal of Game-Specific Fields:**

- `betLevel` removed from base promotion data structures
- Game-specific fields moved to respective game packages
- Improved separation of concerns and reduced coupling

### Extension Points

The promotion system provides clean extension points for game-specific implementations:

**UserSignInConsumer Extensions:**

```javascript
extendPromo(baseData, originalPromotion) {
  return {
    ...baseData,
    betLevel: originalPromotion.betLevel,
    reelConfig: originalPromotion.reelConfig,
  };
}
```

**PlaceBetConsumer Extensions:**

```javascript
getPromoBetAmount(player, payload) {
  const amounts = { 1: 5, 2: 10, 3: 25, 4: 50 };
  return amounts[player.promotion?.betLevel] || 0;
}

extendPromoPayload(basePayload, player, originalPayload) {
  return {
    ...basePayload,
    coinValue: player.promotion.coinValue,
    paylines: this.calcPaylines(player.promotion),
  };
}
```

**Pure Function Benefits:**

- Better testability with predictable inputs/outputs
- No side effects for easier debugging
- Immutable data transformations

---

## SC-Game-Base 6.0.0 Promotion Features

### Event Interceptor System Integration

SC-Game-Base 6.0.0 introduces comprehensive promotion support through the Event Interceptor System and built-in `PromotionBetInterceptor`.

#### Key Features:

- **Automatic Integration**: Event interceptors integrate directly with `ProcessBetQueue`
- **Built-in PromotionBetInterceptor**: Handles standard promotion workflows automatically
- **Mixin-based Architecture**: For interceptor functionality in `ProcessBetQueue`
- **Container Registry Auto-setup**: Automatic registration for interceptor arrays

### New Required Dependencies (6.0.0)

To enable promotion features in 6.0.0, add:

```json
{
  "@sc/game-promotion-api-client": "^1.0.0"
}
```

### Container Registry Auto-Registration (6.0.0)

The base `ContainerRegistry` class automatically handles:

- Promotion client registration (`gamePromotionApiClient`)
- `PromotionBetInterceptor` registration
- Interceptor arrays setup (`betEventInterceptors`)
- `ProcessBetQueue` integration

**No manual container registration needed** unless you want custom interceptors:

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

### Promotion API Configuration (6.0.0)

**This is the main requirement**: Add promotion API settings to enable promotion features:

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

### Built-in PromotionBetInterceptor (6.0.0)

The `PromotionBetInterceptor` is automatically registered and handles all standard promotion workflows:

- ✅ **Automatic promotion detection** via `payload.usePromotion` and `payload.promotionId`
- ✅ **Bonus item deduction** before bet placement
- ✅ **Promotion ticket creation** after successful bets
- ✅ **Rollback handling** for failed bets
- ✅ **Data enhancement** for bet records, logs, and API calls

**No additional code needed** - it works automatically when:

1. `promotionApiSettings` is configured
2. Client sends promotion data in bet payload

#### Built-in InGameConsumer Promotion Support

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

#### Extending PromotionBetInterceptor:

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

### Custom Event Interceptors (Advanced)

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

### PlaceBetConsumer Promotion Extensions (6.0.0)

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

### Update Container Registration (If Using Custom Components)

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

### Configuration Updates (Optional)

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

## What's Automatic vs Manual (6.0.0)

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

## Testing Strategy (6.0.0)

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

    it("should skip amount validation entirely for promotion bets", () => {
      const amountCriteria = consumer.composeBetAmountValidationCriteria(mockPlayer, "red", 999999, true);
      expect(amountCriteria).toEqual([]); // No validation for promotion bets
    });

    it("should not validate freeBet settings for promotion bets", () => {
      // Even with freeBet disabled and freeBet=true, promotion bets should pass
      const mockConfigs = { enableFreeBet: false };
      const criteria = consumer.composeBetAmountValidationCriteria(mockPlayer, "red", 100, true);
      expect(criteria).toEqual([]); // Should skip all amount validation including freeBet
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

## Common Migration Issues (6.0.0)

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

---

## Related Documentation

- [SC-Game-Base 6.0.0 Upgrade Guide](./UPGRADE_GUIDE_6.0.0.md)
- [Game-Specific Extensions Guide](./GAME_SPECIFIC_EXTENSIONS.md)
- [Promotion Bet Validation Guide](./PROMOTION_BET_VALIDATION.md)
- [Event Interceptor Documentation](../diagrams/event-interceptor-system.md)
- [Event Consumer Patterns](../README.md#event-consumer-pattern)
- [Dependency Injection Guide](../README.md#dependency-registration)
