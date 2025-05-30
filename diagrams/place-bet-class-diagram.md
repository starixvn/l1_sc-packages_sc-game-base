# Place Bet System - Class Diagram (Updated with Promotion)

## Overview

This class diagram shows the relationships between all components in the place bet system, including the promotion functionality and promotion API integration using the official `@sc/game-promotion-api-client` package.

## Class Diagram

```mermaid
classDiagram
    class BaseSocketRouter {
        +handleBetEvent(socket, payload)
        +verifyConnection(socket)
        +delegateToConsumer(event, data)
    }

    class PlaceBetConsumer {
        +consumeBetEvent(payload)
        +validateParameters(betData)
        +detectPromotion(playerData)
        +addToQueue(betData)
    }

    class GamePromotionApiClient {
        <<external package>>
        +claimPromotion(playerDto)
        +deductBonusItem(deductDto)
        +rollbackBonusItem(rollbackDto)
        +createPromotionTicket(ticketDto)
        +checkEligibility(playerDto)
        +assignPromotion(assignDto)
        +testConnection()
    }

    class UserSignInConsumer {
        +handleSignIn(userData)
        +validateUser(userId)
        +claimPromotions(playerId)
        +storePlayerData(playerData)
    }

    class ProcessBetQueue {
        +processPlayerQueues()
        +dequeueBet(playerId)
        +validateBet(betData)
        +callExternalAPI(betData)
        +handleResponse(response)
    }

    class PlaceBetPublisher {
        +publishBetResult(result)
        +notifyClient(socket, data)
        +broadcastUpdate(gameData)
    }

    class GameData {
        +players: Map
        +gameState: Object
        +addPlayer(playerId, playerData)
        +updatePlayerData(playerId, data)
        +getPlayer(playerId)
    }

    class PlayerInGame {
        +playerId: string
        +betTracks: Object
        +betQueue: Array
        +promotion: Object
        +bonusItemCount: number
        +isProcessing: boolean
    }

    class BetData {
        +playerId: string
        +amount: number
        +betChoice: string
        +clientSeed: string
        +usePromotion: boolean
        +promotionId: string
    }

    class PlayerPromotion {
        +promotionId: string
        +code: string
        +bonusItemCount: number
        +isActive: boolean
        +expiryDate: string
    }

    class PromotionTicket {
        +ticketId: string
        +playerId: string
        +promotionId: string
        +betId: string
        +gameRoundId: string
        +createdAt: string
    }

    class PromotionBet {
        +amount: 0.00
        +usePromotion: true
        +promotionId: string
        +originalBonusCount: number
    }

    %% Relationships
    BaseSocketRouter --> PlaceBetConsumer : delegates to
    BaseSocketRouter --> UserSignInConsumer : delegates to

    PlaceBetConsumer --> GameData : reads/writes
    PlaceBetConsumer --> GamePromotionApiClient : calls for promotions

    UserSignInConsumer --> GameData : creates PlayerInGame
    UserSignInConsumer --> GamePromotionApiClient : claims promotions

    ProcessBetQueue --> GameData : processes queues
    ProcessBetQueue --> GamePromotionApiClient : creates tickets
    ProcessBetQueue --> PlaceBetPublisher : publishes results

    GameData --> PlayerInGame : contains
    PlayerInGame --> BetData : queues
    PlayerInGame --> PlayerPromotion : has

    GamePromotionApiClient ..> PlayerPromotion : retrieves
    GamePromotionApiClient ..> PromotionTicket : creates

    BetData <|-- PromotionBet : extends

    PlaceBetPublisher --> BaseSocketRouter : sends responses
```

## Key Components

### Core Flow Components

- `BaseSocketRouter` handles WebSocket events and routes to appropriate consumers
- `PlaceBetConsumer` processes bet requests and manages validation
- `ProcessBetQueue` asynchronously processes bet queues with external API calls
- `PlaceBetPublisher` handles real-time client notifications

### Official Promotion Integration

- `GamePromotionApiClient` is the official Pentagon package for promotion operations
- Handles all promotion-related API calls including claiming, deducting, and ticket creation
- Provides standardized interface for promotion management

### Data Management

- `GameData` manages all in-memory game state and player data
- `PlayerInGame` represents individual player state including promotions
- `BetData` represents individual bet information
- `PromotionBet` extends BetData for promotion specific functionality

### Promotion System

- `PlayerPromotion` represents promotion data stored in PlayerInGame
- `PromotionTicket` represents audit trail tickets for promotion usage
- Integration with official Pentagon promotion APIs for all operations

## Promotion Integration Points

1. **Sign-In**: `UserSignInConsumer` calls `GamePromotionApiClient.claimPromotion()`
2. **Detection**: `PlaceBetConsumer` detects promotions from PlayerInGame promotion data
3. **Deduction**: `PlaceBetConsumer` calls `GamePromotionApiClient.deductBonusItem()`
4. **Processing**: `ProcessBetQueue` creates tickets via `GamePromotionApiClient.createPromotionTicket()`
5. **Rollback**: Error scenarios call `GamePromotionApiClient.rollbackBonusItem()`

## API Integration

The system now uses the official `@sc/game-promotion-api-client` package directly:

- **Standardized**: Uses Pentagon's official API client
- **Maintained**: Officially supported and maintained by Pentagon
- **Consistent**: Follows Pentagon's standard patterns and conventions
- **Reliable**: Production-tested and validated by Pentagon team

This integration ensures compatibility with Pentagon's promotion infrastructure while maintaining clean separation of concerns in the game system architecture.
