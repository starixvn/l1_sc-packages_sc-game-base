# Place Bet System - Class Diagram (Updated with Free Spin)

```mermaid
classDiagram
    class UserSignInConsumer {
        +consume(socketClient, payload)
        +handleSignInSuccess(socketClient, userInfo, userSession)
        +handleUnauthorizedSignIn(socketClient)
        +getUserBetLimit(userSession, userInfo, socketClient)
        +claimPlayerPromotions(userSession) Promise
    }

    class PlaceBetConsumer {
        +consume(player, payload)
        +validateRequestParams(request, player) boolean
        +validateBetRequest(player, betChoice, amount, freeBet, roundId) boolean
        +detectFreeSpinEligibility(player) boolean
        +adjustBetTracks(playerName, bet)
        +handleFreeSpinBet(player, payload) Promise
        +processSuccessfulFreeSpin(player, bet, result) Promise
        +processFailedFreeSpin(player, bet, error) Promise
        +publishToUser(userId, payload)
    }

    class PromotionApiClient {
        +claimPromotion(playerId, promotionId) Promise
        +deductBonusItem(playerId, promotionId, amount) Promise
        +rollbackBonusItem(playerId, promotionId, amount) Promise
        +createPromotionTicket(ticketData) Promise
        +getPlayerPromotion(playerId, promotionId) Promise
    }

    class PlayerPromotion {
        +playerId string
        +promotionId string
        +remainingBonusItems number
        +lastUsedDate Date
        +isActive boolean
        +gameEligibility Array
        +promotionType string
        +expiryDate Date
    }

    class PromotionTicket {
        +playerId string
        +operatorId string
        +gameId number
        +gameRoundId number
        +betId string
        +appType string
        +betAmount number
        +winAmount number
        +promotionId string
        +ticketType string
        +createdAt Date
    }

    class PlaceBetPublisher {
        +publishGameFailedBet(playerId, payload)
        +publishSuccessBet(playerId, payload, rate)
        +publishFreeSpinSuccess(playerId, result)
        +publishFreeSpinFailure(playerId, error)
        +publishToUser(userId, payload)
    }

    class ProcessBetQueue {
        +start()
        +dequeueBets()
        +proceedBet(player, payload) Promise
        +proceedFreeSpinBet(player, payload) Promise
        +handleSuccessBet(player, balance, roundId, bet) Promise
        +handleFailedBet(player, notice, bet)
        +handleFreeSpinSuccess(player, result) Promise
        +handleFreeSpinFailure(player, error) Promise
        +callPromotionApis(player, payload) Promise
    }

    class GameData {
        +remainingTime number
        +roundId number
        +realPlayers Object
        +ingame Object
        +gameConfigs Object
        +freeSpinConfigs Object
        +promotions Object
    }

    class GameDefinition {
        +id number
        +name string
        +choices Array
        +durations Object
        +hedgeBetGroups Array
        +freeSpinEnabled boolean
        +freeSpinChoices Array
    }

    class PlayerInGame {
        +name string
        +betTracks Object
        +betQueue Array
        +betProcessing boolean
        +availablePromotions Array
        +freeSpinsRemaining number
        +activePromotionId string
    }



        %% Relationships
    UserSignInConsumer --> PromotionApiClient
    UserSignInConsumer --> GameData

    PlaceBetConsumer --> PromotionApiClient
    PlaceBetConsumer --> GameData
    PlaceBetConsumer --> GameDefinition
    PlaceBetConsumer --> PlaceBetPublisher

    ProcessBetQueue --> GameData
    ProcessBetQueue --> PlaceBetPublisher
    ProcessBetQueue --> PromotionApiClient

    GameData --> PlayerInGame

    %% API relationships
    PromotionApiClient ..> PlayerPromotion : retrieves
    PromotionApiClient ..> PromotionTicket : creates
```

## Key Relationships:

### 1. **Free Spin Integration**

- `UserSignInConsumer` claims promotions during sign-in and stores data in `PlayerInGame`
- `PlaceBetConsumer` automatically detects free spin eligibility from player data
- `ProcessBetQueue` handles both regular and free spin bet processing with API integration
- Simplified architecture with promotion data pre-loaded at sign-in

### 2. **Simplified Architecture**

- Removed base classes (`BaseSocketRouter`, `BaseEventPublisher`) for cleaner design
- `PromotionApiClient` handles all promotion-related API calls
- `PlayerPromotion` and `PromotionTicket` are data models returned from APIs
- Direct relationships between core business logic components

### 3. **Data Management**

- `GameData` includes free spin configurations
- `PlayerInGame` tracks player state including available promotions and free spins
- `PromotionTicket` (via API) tracks all free spin metadata and status

### 4. **Validation & Processing**

- `PlaceBetConsumer` handles free spin validation through Promotion APIs
- Bonus item management through Promotion APIs
- Rollback mechanisms via API calls for failed free spin attempts

### 5. **Event Publishing**

- `PlaceBetPublisher` handles all client notifications directly
- Free spin specific notification methods included
- Separate success/failure handling for free spin results

### 6. **Game Configuration**

- `GameDefinition` includes free spin enablement and eligible choices
- `GameData` maintains free spin specific configurations

## Free Spin Flow Integration:

### **Sign-In Processing:**

1. `UserSignInConsumer` calls `player-promotion/claim-promotion` API during sign-in
2. Store promotion data in `PlayerInGame` for quick access

### **Bet Processing:**

1. `PlaceBetConsumer` detects free spin eligibility from `PlayerInGame` data
2. Call `player-promotion/deduct-bonus-item` API before bet placement

### **Processing:**

1. Process free spin bet through regular bet queue with API integration
2. Track promotion state via `PromotionTicket` API

### **Post-Processing:**

1. Call `promotion-ticket` API to create audit trail
2. Handle rollback via `player-promotion/deduct-bonus-item` API (negative amount) for failures

This updated architecture maintains the existing place bet system's integrity while seamlessly integrating free spin functionality with proper separation of concerns and comprehensive error handling.
