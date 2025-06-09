# Place Bet System - Flow Diagrams (Updated with Current Codebase Implementation)

## Overview

The place bet flow follows the sc-game-base architecture with proper separation of concerns into event-consumers, event-interceptors, and crons. The system uses Pentagon's official `@sc/game-promotion-api-client` package for promotion functionality.

## 1. High-Level Architecture Overview

```mermaid
flowchart TB
    Client["Client Application"] --> Socket["WebSocket"]
    Socket --> Routers["BaseSocketRouter"]

    subgraph "Event Consumers"
        UserSignIn["UserSignInConsumer"]
        PlaceBet["PlaceBetConsumer"]
        InGame["InGameConsumer"]
    end

    subgraph "Event Interceptors"
        PromotionInterceptor["PromotionBetInterceptor"]
        BaseInterceptor["BaseEventInterceptor"]
    end

    subgraph "Crons"
        ProcessQueue["ProcessBetQueue"]
    end

    subgraph "Event Publishers"
        PlaceBetPub["PlaceBetPublisher"]
        StatusPub["GameStatusPublisher"]
        UserSignInPub["UserSignInPublisher"]
    end

    subgraph "External APIs"
        PromotionAPI["GamePromotionApiClient"]
        BetAPI["placeBet API"]
        UserAPI["User Service API"]
    end

    Routers --> UserSignIn
    Routers --> PlaceBet
    Routers --> InGame
    UserSignIn --> PromotionAPI
    UserSignIn --> UserAPI
    PlaceBet --> ProcessQueue
    ProcessQueue --> PromotionInterceptor
    ProcessQueue --> PromotionAPI
    ProcessQueue --> BetAPI
    ProcessQueue --> PlaceBetPub
    PlaceBetPub --> Socket
    UserSignIn --> UserSignInPub
    UserSignInPub --> Socket
    Socket --> Client

    classDef consumerStyle fill:#e1f5fe,stroke:#0277bd
    classDef interceptorStyle fill:#f3e5f5,stroke:#4a148c
    classDef cronStyle fill:#e8f5e8,stroke:#1b5e20
    classDef publisherStyle fill:#fff3e0,stroke:#e65100
    classDef apiStyle fill:#ffebee,stroke:#c62828

    class UserSignIn,PlaceBet,InGame consumerStyle
    class PromotionInterceptor,BaseInterceptor interceptorStyle
    class ProcessQueue cronStyle
    class PlaceBetPub,StatusPub,UserSignInPub publisherStyle
    class PromotionAPI,BetAPI,UserAPI apiStyle
```

## 2. Event-Consumers: User Sign-In & Promotion Claiming

```mermaid
flowchart TD
    SignInRequest["User Sign-In Request"] --> Router["BaseSocketRouter"]
    Router --> UserSignInConsumer["UserSignInConsumer.consume()"]

    UserSignInConsumer --> ValidatePayload["Validate Payload"]
    ValidatePayload --> PayloadValid{"Payload Valid?"}
    PayloadValid -->|"No"| HandleUnauthorized["handleUnauthorizedSignIn()"]

    PayloadValid -->|"Yes"| UserServiceCall["userServiceSignInGame()"]
    UserServiceCall --> GetUserInfo["getUserInfo() from GameManagementAPI"]
    GetUserInfo --> UserInfoValid{"User Info Valid?"}
    UserInfoValid -->|"No"| HandleUnauthorized

    UserInfoValid -->|"Yes"| ValidatePermissions["PlayGamePermissionValidator.validate()"]
    ValidatePermissions -->|"Invalid"| HandleUnauthorized
    ValidatePermissions -->|"Valid"| GetBetLimit["getUserBetLimit()"]

    GetBetLimit --> DisconnectExisting["Disconnect Existing Player Sessions"]
    DisconnectExisting --> ClaimPromotions["claimPlayerPromotions()"]

    ClaimPromotions --> PromotionAvailable{"Promotion Available?"}
    PromotionAvailable -->|"No"| HandleSuccess["handleSignInSuccess() without promotion"]
    PromotionAvailable -->|"Yes"| CallPromotionAPI["promotionApiClient.claimPromotion()"]

    CallPromotionAPI --> PromotionSuccess{"Promotion Claim Success?"}
    PromotionSuccess -->|"No"| HandleSuccess
    PromotionSuccess -->|"Yes"| CreatePromotionData["Create promotionData object"]
    CreatePromotionData --> SetPromotionFields["promotionId, code, bonusItemCount,<br/>isActive, endDate"]
    SetPromotionFields --> HandleSuccessWithPromotion["handleSignInSuccess() with promotion"]

    HandleSuccess --> StorePlayerData["Store in gameData.realPlayers"]
    HandleSuccessWithPromotion --> StorePlayerDataWithPromotion["Store in gameData.realPlayers<br/>with promotion object"]
    StorePlayerData --> EmitSignIn["socketClient.emit('signedIn')"]
    StorePlayerDataWithPromotion --> EmitSignIn

    HandleUnauthorized --> PublishUnauthorized["userSignInPublisher.publishUnauthorizedMessage()"]
    PublishUnauthorized --> DisconnectClient["socketClient.disconnect()"]

    classDef consumerStyle fill:#e1f5fe,stroke:#0277bd
    classDef apiStyle fill:#ffebee,stroke:#c62828
    classDef dataStyle fill:#e8f5e8,stroke:#1b5e20
    classDef publisherStyle fill:#fff3e0,stroke:#e65100
    classDef errorStyle fill:#ffebee,stroke:#c62828

    class UserSignInConsumer consumerStyle
    class UserServiceCall,GetUserInfo,CallPromotionAPI apiStyle
    class CreatePromotionData,SetPromotionFields,StorePlayerData,StorePlayerDataWithPromotion dataStyle
    class EmitSignIn publisherStyle
    class HandleUnauthorized,PublishUnauthorized,DisconnectClient errorStyle
```

## 3. Event-Consumers: Place Bet Request Processing

```mermaid
flowchart TD
    Client["Client Application"] -->|"bet event"| Socket["WebSocket Connection"]
    Socket --> Router["BaseSocketRouter.handlePlaceBet()"]
    Router --> Verify{"verify() connection?"}
    Verify -->|"No"| Reject["Reject Request"]
    Verify -->|"Yes"| PlaceBetConsumer["PlaceBetConsumer.consume()"]

    PlaceBetConsumer --> NormalizePayload["Object.assign() - Normalize Payload"]
    NormalizePayload --> HandlePromotion["handlePromotionLogic()"]
    HandlePromotion --> CheckPromotion{"player.promotion exists?"}
    CheckPromotion -->|"Yes"| GetPromotionAmount["getPromotionBetAmount()"]
    CheckPromotion -->|"No"| ValidateParams["validateRequestParams()"]
    GetPromotionAmount --> SetPromotionFields["Set promotionId, usePromotion"]
    SetPromotionFields --> ValidateParams

    ValidateParams -->|"Invalid"| ErrorResponse["Send Error Response"]
    ValidateParams -->|"Valid"| ValidateBetRequest["validateBetRequest()"]
    ValidateBetRequest --> ComposeValidation["composeValidationCriteria()"]

    ComposeValidation --> BettingTimeCheck["composeBettingTimeValidationCriteria()"]
    ComposeValidation --> BetAmountCheck["composeBetAmountValidationCriteria()"]
    ComposeValidation --> BetChoiceCheck["composeBetChoiceValidationCriteria()"]
    ComposeValidation --> HedgeBetCheck["composeHedgeBetValidationCriteria()"]
    ComposeValidation --> PromotionCheck["composePromotionValidationCriteria()"]

    BettingTimeCheck --> VerifyCriteria["verifyCriteria()"]
    BetAmountCheck --> VerifyCriteria
    BetChoiceCheck --> VerifyCriteria
    HedgeBetCheck --> VerifyCriteria
    PromotionCheck --> VerifyCriteria

    VerifyCriteria -->|"Failed"| ValidationError["Validation Error Response"]
    VerifyCriteria -->|"Passed"| InitializePlayer["initializePlayerData()"]
    InitializePlayer --> AdjustTracks["adjustBetTracks()"]
    AdjustTracks --> QueueBet["Push to playerInGame.betQueue"]

    classDef consumerStyle fill:#e1f5fe,stroke:#0277bd
    classDef errorStyle fill:#ffebee,stroke:#c62828
    classDef successStyle fill:#e8f5e8,stroke:#2e7d32
    classDef promotionStyle fill:#fff3e0,stroke:#e65100
    classDef validationStyle fill:#f3e5f5,stroke:#4a148c

    class PlaceBetConsumer consumerStyle
    class Reject,ErrorResponse,ValidationError errorStyle
    class NormalizePayload,InitializePlayer,AdjustTracks,QueueBet successStyle
    class HandlePromotion,GetPromotionAmount,SetPromotionFields,PromotionCheck promotionStyle
    class ComposeValidation,BettingTimeCheck,BetAmountCheck,BetChoiceCheck,HedgeBetCheck,VerifyCriteria validationStyle
```

## 4. Event-Interceptors: Promotion Processing

```mermaid
flowchart TD
    InterceptorStart["getApplicableInterceptors()"] --> CheckPromotion{"payload.usePromotion?"}

    CheckPromotion -->|"No"| RegularFlow["Continue without interceptors"]
    CheckPromotion -->|"Yes"| ShouldIntercept["PromotionBetInterceptor.shouldIntercept()"]

    ShouldIntercept --> ValidatePayload{"payload.promotionId exists?"}
    ValidatePayload -->|"No"| RegularFlow
    ValidatePayload -->|"Yes"| CheckAPIAvailable{"isPromotionApiAvailable()?"}
    CheckAPIAvailable -->|"No"| RegularFlow
    CheckAPIAvailable -->|"Yes"| BeforeEvent["beforeEvent()"]

    BeforeEvent --> PrepareDeductDto["Create deductDto object"]
    PrepareDeductDto --> CallDeductAPI["gamePromotionApiClient.deductBonusItem()"]
    CallDeductAPI --> DeductSuccess{"Deduction Success?"}

    DeductSuccess -->|"No"| PublishFailure["publishGameFailedBet()"]
    PublishFailure --> ReturnFailure["Return { success: false }"]
    DeductSuccess -->|"Yes"| UpdatePromotion["Update player.promotion.bonusItemCount"]
    UpdatePromotion --> ReturnSuccess["Return { success: true }"]

    RegularFlow --> ContinueProcessing["Continue to ProcessBetQueue"]
    ReturnFailure --> ContinueProcessing
    ReturnSuccess --> ContinueProcessing

    classDef interceptorStyle fill:#f3e5f5,stroke:#4a148c
    classDef promotionStyle fill:#fff3e0,stroke:#e65100
    classDef apiStyle fill:#ffebee,stroke:#c62828
    classDef successStyle fill:#e8f5e8,stroke:#2e7d32
    classDef errorStyle fill:#ffebee,stroke:#c62828

    class InterceptorStart,ShouldIntercept,BeforeEvent,CheckAPIAvailable interceptorStyle
    class CheckPromotion,ValidatePayload,PrepareDeductDto,UpdatePromotion promotionStyle
    class CallDeductAPI apiStyle
    class RegularFlow,ReturnSuccess,ContinueProcessing successStyle
    class PublishFailure,ReturnFailure errorStyle
```

## 5. Crons: Queue Processing with Interceptors

```mermaid
flowchart TD
    QueueProcessor["ProcessBetQueue.start()"] --> StartLoop["keepDequeuingBets() loop"]
    StartLoop --> CheckQueues["dequeueBets() - Check All Player Queues"]
    CheckQueues --> HasBets{"playerInGame.betQueue.length > 0?"}
    HasBets -->|"No"| WaitLoop["setTimeout(50ms)"]
    WaitLoop --> CheckQueues

    HasBets -->|"Yes"| CheckProcessing{"playerInGame.betProcessing?"}
    CheckProcessing -->|"Yes"| WaitLoop
    CheckProcessing -->|"No"| DequeueBet["betQueue.shift() - Get Next Bet"]

    DequeueBet --> SetProcessing["Set betProcessing = true"]
    SetProcessing --> ProceedBet["proceedBet()"]
    ProceedBet --> GetInterceptors["getApplicableInterceptors()"]
    GetInterceptors --> ValidateBet["validateBetRequest()"]

    ValidateBet -->|"Invalid"| FailureFlow["handleFailedBet()"]
    ValidateBet -->|"Valid"| ExecuteBeforeEvent["executeInterceptorEvent('beforeEvent')"]
    ExecuteBeforeEvent -->|"Failed"| FailureFlow
    ExecuteBeforeEvent -->|"Success"| FormatBetInfo["formatApiBetInfo()"]

    FormatBetInfo --> EnhanceBetInfo["executeInterceptorTransform('enhanceBetInfo')"]
    EnhanceBetInfo --> APICall["placeBet() API Call"]

    APICall --> APIResponse{"apiResult.isOk?"}
    APIResponse -->|"Yes"| SuccessFlow["handleSuccessBet()"]
    APIResponse -->|"No"| FailureFlow

    SuccessFlow --> UpsertBet["upsertBet() with enhanceBetRecord transform"]
    SuccessFlow --> InsertBetLog["insertBetLog() with enhanceBetLog transform"]
    SuccessFlow --> AdjustOwnBets["adjustOwnBets()"]
    SuccessFlow --> AfterSuccess["executeInterceptorEvent('afterSuccessEvent')"]
    AfterSuccess --> PublishSuccess["publishSuccessBet()"]

    FailureFlow --> DecreaseTracks["decreaseBetTracks()"]
    FailureFlow --> AfterFailure["executeInterceptorEvent('afterFailureEvent')"]
    AfterFailure --> PublishFailure["publishGameFailedBet()"]

    PublishSuccess --> ProcessComplete["Set betProcessing = false"]
    PublishFailure --> ProcessComplete
    ProcessComplete --> WaitLoop

    classDef cronStyle fill:#e8f5e8,stroke:#1b5e20
    classDef interceptorStyle fill:#f3e5f5,stroke:#4a148c
    classDef processStyle fill:#e3f2fd,stroke:#0d47a1
    classDef apiStyle fill:#ffebee,stroke:#c62828
    classDef successStyle fill:#e8f5e8,stroke:#2e7d32
    classDef errorStyle fill:#ffebee,stroke:#c62828

    class QueueProcessor,StartLoop,CheckQueues,DequeueBet,ProceedBet,ProcessComplete cronStyle
    class GetInterceptors,ExecuteBeforeEvent,EnhanceBetInfo,AfterSuccess,AfterFailure interceptorStyle
    class SetProcessing,ValidateBet,FormatBetInfo,UpsertBet,InsertBetLog,AdjustOwnBets processStyle
    class APICall apiStyle
    class SuccessFlow,PublishSuccess successStyle
    class FailureFlow,DecreaseTracks,PublishFailure errorStyle
```

## 6. Event-Publishers: Response Broadcasting

```mermaid
flowchart TD
    ResponseHandler["Response Handler"] --> CheckResult{"Success or Failure?"}

    CheckResult -->|"Success"| PublishSuccess["PlaceBetPublisher.publishSuccessBet()"]
    CheckResult -->|"Failure"| PublishFailure["PlaceBetPublisher.publishGameFailedBet()"]

    PublishSuccess --> BasePublisher["BaseEventPublisher.publishToUser()"]
    PublishFailure --> BasePublisher

    BasePublisher --> SocketEmit["socketClient.emit()"]
    SocketEmit --> ClientResponse["Client Response"]

    subgraph "Response Types"
        SuccessResp["Success: { ownBets, endBet, betChoice, user: balance }"]
        FailureResp["Failure: { endBet: -1, betChoice, notice/apiError }"]
        UnauthorizedResp["Unauthorized: disconnect + unauthorized message"]
    end

    ClientResponse --> SuccessResp
    ClientResponse --> FailureResp
    ClientResponse --> UnauthorizedResp

    classDef publisherStyle fill:#fff3e0,stroke:#e65100
    classDef responseStyle fill:#e3f2fd,stroke:#0d47a1
    classDef successStyle fill:#e8f5e8,stroke:#2e7d32
    classDef errorStyle fill:#ffebee,stroke:#c62828

    class PublishSuccess,PublishFailure,BasePublisher publisherStyle
    class SocketEmit,ClientResponse responseStyle
    class SuccessResp successStyle
    class FailureResp,UnauthorizedResp errorStyle
```

## 7. Complete Architecture Flow Sequence

```mermaid
sequenceDiagram
    participant Client
    participant Router as "BaseSocketRouter"
    participant PlaceBetConsumer as "PlaceBetConsumer"
    participant Queue as "ProcessBetQueue"
    participant Interceptor as "PromotionBetInterceptor"
    participant PromotionAPI as "GamePromotionApiClient"
    participant BetAPI as "placeBet API"
    participant Publisher as "PlaceBetPublisher"
    participant GameData

    Client->>Router: bet event
    Router->>Router: verify() connection
    Router->>PlaceBetConsumer: consume(player, payload)
    PlaceBetConsumer->>PlaceBetConsumer: handlePromotionLogic()
    PlaceBetConsumer->>PlaceBetConsumer: validateRequestParams()
    PlaceBetConsumer->>PlaceBetConsumer: validateBetRequest()
    PlaceBetConsumer->>GameData: betQueue.push({player, payload})

    Queue->>GameData: betQueue.shift()
    Queue->>Queue: getApplicableInterceptors()
    Queue->>Queue: validateBetRequest()

    alt Promotion Bet
        Queue->>Interceptor: executeInterceptorEvent("beforeEvent")
        Interceptor->>PromotionAPI: deductBonusItem()
        PromotionAPI->>Interceptor: Deduction result
        Queue->>Interceptor: executeInterceptorTransform("enhanceBetInfo")
    end

    Queue->>BetAPI: placeBet(player, betInfo)
    BetAPI->>Queue: API result

    alt Bet Success
        Queue->>Queue: upsertBet() + insertBetLog()
        Queue->>Interceptor: executeInterceptorEvent("afterSuccessEvent")
        Interceptor->>PromotionAPI: createPromotionTicket()
        Queue->>Publisher: publishSuccessBet()
    else Bet Failure
        Queue->>Queue: decreaseBetTracks()
        Queue->>Interceptor: executeInterceptorEvent("afterFailureEvent")
        Interceptor->>PromotionAPI: rollbackBonusItem()
        Queue->>Publisher: publishGameFailedBet()
    end

    Publisher->>Client: socketClient.emit()
```

## 8. Folder Structure Summary

```
src/core/
├── event-consumers/
│   ├── place-bet-consumer.js          # Main bet processing logic
│   ├── user-signin-consumer.js        # User authentication & promotion claiming
│   ├── in-game-consumer.js            # In-game state management
│   └── index.js                       # Consumer exports
├── event-interceptors/
│   ├── base-event-interceptor.js      # Base interceptor class
│   ├── promotion-bet-interceptor.js   # Promotion-specific logic
│   └── index.js                       # Interceptor exports
├── crons/
│   ├── process-bet-queue.js           # Queue processing with interceptors
│   └── index.js                       # Cron exports
├── event-publishers/
│   ├── place-bet-publisher.js         # Bet result broadcasting
│   ├── user-signin-publisher.js       # Sign-in responses
│   ├── base-event-publisher.js        # Base publisher functionality
│   └── index.js                       # Publisher exports
├── routers/
│   ├── base-socket-router.js          # WebSocket event routing
│   └── index.js                       # Router exports
└── mixins/
    └── event-interceptor-mixin.js     # Interceptor functionality
```

## Key Architecture Benefits

### **Separation of Concerns**

- **event-consumers**: Handle request validation and queuing
- **event-interceptors**: Manage cross-cutting concerns (promotions, analytics)
- **crons**: Process queued operations with interceptor integration
- **event-publishers**: Broadcast responses to clients
- **routers**: Route WebSocket events to appropriate consumers

### **Interceptor Pattern**

- Modular and pluggable promotion logic
- Easy to add new interceptors for different features
- Clean separation from core betting logic
- Reusable across different game types

### **Official API Integration**

- Pentagon's `@sc/game-promotion-api-client` for all promotion operations
- Consistent promotion state management
- Built-in error handling and rollback mechanisms
- Standardized audit trail via promotion tickets

### **Current Implementation Features**

- **Robust Validation**: Multiple validation layers in both consumer and cron
- **Error Handling**: Comprehensive error handling with proper rollback
- **Performance**: 50ms processing timeout for optimal throughput
- **Scalability**: Queue-based processing prevents blocking
- **Monitoring**: Built-in metrics and logging throughout the flow

This architecture ensures maintainable, scalable, and testable code that follows sc-game-base patterns while providing robust promotion functionality through Pentagon's official APIs.

```

```
