# Place Bet System - Flow Diagrams (Updated with Free Spin)

## Overview

The place bet flow has been updated to include free spin functionality, broken down into smaller, focused diagrams for better readability and understanding.

## 1. High-Level Overview

```mermaid
flowchart LR
    Client[Client Application] --> Socket[WebSocket]
    Socket --> Router[BaseSocketRouter]

    Router --> SignIn[UserSignInConsumer]
    SignIn --> ClaimPromo[Claim Promotions API]
    ClaimPromo --> StoreData[Store in PlayerInGame]

    Router --> Consumer[PlaceBetConsumer]
    Consumer --> DetectFreeSpin{Detect Free Spin from PlayerInGame}
    DetectFreeSpin -->|Yes| FreeSpinFlow[Free Spin Flow]
    DetectFreeSpin -->|No| RegularFlow[Regular Bet Flow]
    FreeSpinFlow --> Validation[Validation Layer]
    RegularFlow --> Validation
    Validation --> Queue[Bet Queue]
    Queue --> Processor[ProcessBetQueue]
    Processor --> API[External API]
    API --> Response[Response Handler]
    Response --> Publisher[PlaceBetPublisher]
    Publisher --> Client
```

## 2. User Sign-In & Promotion Claiming

```mermaid
flowchart TD
    SignInRequest[User Sign-In Request] --> UserSignInConsumer[UserSignInConsumer]
    UserSignInConsumer --> ValidateUser[Validate User Session]
    ValidateUser --> UserValid{User Valid?}

    UserValid -->|No| RejectSignIn[Reject Sign-In]
    UserValid -->|Yes| ClaimPromotionAPI[Call player-promotion/claim-promotion API]

    ClaimPromotionAPI --> PromotionResult{Promotion Available?}
    PromotionResult -->|No| CreatePlayerData[Create PlayerInGame without Promotions]
    PromotionResult -->|Yes| StorePromotionData[Store Promotion Data in PlayerInGame]

    StorePromotionData --> SetPromotionData[Set promotionData Object]
    SetPromotionData --> SetPromotionFields[promotionId, code, bonusItemCount]
    SetPromotionFields --> CompleteSignIn[Complete Sign-In Process]

    CreatePlayerData --> CompleteSignIn
    CompleteSignIn --> NotifyClient[Notify Client of Sign-In Success]

    classDef signInStyle fill:#f3e5f5,stroke:#4a148c
    classDef apiStyle fill:#e1f5fe,stroke:#0277bd
    classDef dataStyle fill:#e8f5e8,stroke:#1b5e20
    classDef errorStyle fill:#ffebee,stroke:#c62828

    class UserSignInConsumer,ValidateUser,CompleteSignIn signInStyle
    class ClaimPromotionAPI apiStyle
    class StorePromotionData,SetPromotionData,SetPromotionFields,CreatePlayerData dataStyle
    class RejectSignIn errorStyle
```

## 3. Request Reception & Initial Processing (Updated)

```mermaid
flowchart TD
    Client[Client Application] -->|bet event| Socket[WebSocket Connection]
    Socket --> Router[BaseSocketRouter]
    Router --> Verify{verify connection?}
    Verify -->|No| Reject[Reject Request]
    Verify -->|Yes| Consumer[PlaceBetConsumer]
    Consumer --> Normalize[Normalize Payload]
    Normalize --> CheckFreeSpin{Free Spin Bet?}

    CheckFreeSpin -->|Yes| GetPromotionData[Get Promotion Data from PlayerInGame]
    CheckFreeSpin -->|No| ParamCheck[Parameter Validation]

    GetPromotionData --> CheckBonusCount{bonusItemCount > 0?}
    CheckBonusCount -->|No| ParamCheck
    CheckBonusCount -->|Yes| DeductBonus[Call player-promotion/deduct-bonus-item]
    DeductBonus --> BonusSuccess{API Success?}
    BonusSuccess -->|No| BonusError[Send API Error]
    BonusSuccess -->|Yes| SetFreeSpinParams[Set Free Spin Parameters with promotionId]
    SetFreeSpinParams --> ParamCheck

    ParamCheck -->|Invalid| ErrorResponse[Send Error Response]
    ParamCheck -->|Valid| BetValidation[Business Logic Validation]

    classDef errorStyle fill:#ffebee,stroke:#c62828
    classDef successStyle fill:#e8f5e8,stroke:#2e7d32
    classDef apiStyle fill:#e1f5fe,stroke:#0277bd

    class Reject,ErrorResponse,BonusError errorStyle
    class Consumer,Normalize,BetValidation successStyle
    class GetPromotionData,DeductBonus,SetFreeSpinParams apiStyle
```

## 4. Free Spin Detection & Validation Layer

```mermaid
flowchart TD
    FreeSpinDetection[Free Spin Detection] --> CheckPlayerData[Check PlayerInGame Data]
    CheckPlayerData --> GetPromotionData[Get Promotion Data from PlayerInGame]

        GetPromotionData --> PromotionData[Return Promotion Data]
    PromotionData --> ShowData[promotionId, code, bonusItemCount]
    ShowData --> HasBonusItems{bonusItemCount > 0?}
    HasBonusItems -->|No| NoFreeSpins[No Free Spins Available]
    HasBonusItems -->|Yes| DeductAPI[Call player-promotion/deduct-bonus-item API]

    NoFreeSpins --> RegularBetFlow[Continue as Regular Bet]

    DeductAPI --> DeductResult{API Success?}
    DeductResult -->|No| APIError[API Error Response]
    DeductResult -->|Yes| UpdatePlayerData[Update PlayerInGame bonusItemCount]
    UpdatePlayerData --> RegularValidation[Continue to Regular Validation]

    classDef dataStyle fill:#e8f5e8,stroke:#1b5e20
    classDef apiStyle fill:#e1f5fe,stroke:#0277bd
    classDef promotionStyle fill:#fff3e0,stroke:#e65100
    classDef errorStyle fill:#ffebee,stroke:#c62828
    classDef successStyle fill:#e8f5e8,stroke:#2e7d32

    class CheckPlayerData,GetPromotionData,UpdatePlayerData dataStyle
    class DeductAPI apiStyle
    class PromotionData,ShowData promotionStyle
    class APIError,NoFreeSpins errorStyle
    class RegularValidation,RegularBetFlow successStyle
```

## 5. Regular Validation Layer Details

```mermaid
flowchart TD
    BetValidation[Business Logic Validation] --> TimeCheck[Betting Time Validation]
    BetValidation --> AmountCheck[Bet Amount Validation]
    BetValidation --> ChoiceCheck[Bet Choice Validation]
    BetValidation --> HedgeCheck[Hedge Bet Validation]
    BetValidation --> FreeSpinCheck[Free Spin Config Check]

    TimeCheck --> TimeResult{Valid?}
    AmountCheck --> AmountResult{Valid?}
    ChoiceCheck --> ChoiceResult{Valid?}
    HedgeCheck --> HedgeResult{Valid?}
    FreeSpinCheck --> FreeSpinResult{Valid?}

    TimeResult -->|No| ValidationFail[Validation Failed]
    AmountResult -->|No| ValidationFail
    ChoiceResult -->|No| ValidationFail
    HedgeResult -->|No| ValidationFail
    FreeSpinCheck -->|No| ValidationFail

    TimeResult -->|Yes| ValidationPass[All Validations Pass]
    AmountResult -->|Yes| ValidationPass
    ChoiceResult -->|Yes| ValidationPass
    HedgeResult -->|Yes| ValidationPass
    FreeSpinResult -->|Yes| ValidationPass

    ValidationFail --> CheckFreeSpin{Was Free Spin?}
    CheckFreeSpin -->|Yes| RollbackAPI[Call player-promotion/rollback-bonus-item API]
    CheckFreeSpin -->|No| NotifyError[Notify Error to Client]
    RollbackAPI --> NotifyError

    ValidationPass --> PlayerManagement[Player Data Management]

    classDef validationStyle fill:#fff3e0,stroke:#e65100
    classDef errorStyle fill:#ffebee,stroke:#c62828
    classDef successStyle fill:#e8f5e8,stroke:#2e7d32
    classDef apiStyle fill:#e1f5fe,stroke:#0277bd

    class TimeCheck,AmountCheck,ChoiceCheck,HedgeCheck,FreeSpinCheck validationStyle
    class ValidationFail,NotifyError errorStyle
    class ValidationPass,PlayerManagement successStyle
    class RollbackAPI apiStyle
```

## 6. Player Data Management (Updated)

```mermaid
flowchart TD
    PlayerManagement[Player Data Management] --> PlayerExists{Player in GameData?}
    PlayerExists -->|No| CreatePlayer[Create New Player]
    PlayerExists -->|Yes| UpdateTracks[Update Bet Tracks]

    CreatePlayer --> InitializePlayer[Initialize Player Object]
    InitializePlayer --> SetBetTracks[Set Empty Bet Tracks]
    SetBetTracks --> SetBetQueue[Set Empty Bet Queue]
    SetBetQueue --> CheckFreeSpin{Free Spin Bet?}

    CheckFreeSpin -->|Yes| UpdateTracks
    CheckFreeSpin -->|No| UpdateTracks

    UpdateTracks --> AddAmount[Add Bet Amount to Choice]
    AddAmount --> QueueBet[Add Bet to Queue]
    QueueBet --> QueueComplete[Queue Management Complete]

    classDef dataStyle fill:#e8f5e8,stroke:#1b5e20
    classDef processStyle fill:#e3f2fd,stroke:#0d47a1

    class CreatePlayer,InitializePlayer,SetBetTracks,SetBetQueue,UpdateTracks,AddAmount dataStyle
    class QueueBet,QueueComplete processStyle
```

## 6. Queue Processing (Updated)

```mermaid
flowchart TD
    QueueProcessor[ProcessBetQueue Cron] --> CheckQueues[Check All Player Queues]
    CheckQueues --> HasBets{Queue Has Bets?}
    HasBets -->|No| WaitLoop[Wait 50ms]
    WaitLoop --> CheckQueues

    HasBets -->|Yes| CheckProcessing{Player Processing?}
    CheckProcessing -->|Yes| WaitLoop
    CheckProcessing -->|No| DequeueBet[Dequeue Next Bet]

    DequeueBet --> SetProcessing[Set Player Processing = true]
    SetProcessing --> CheckBetType{Free Spin Bet?}

    CheckBetType -->|Yes| FormatFreeSpinAPI[Format Free Spin API Request]
    CheckBetType -->|No| FormatAPI[Format Regular API Request]

    FormatFreeSpinAPI --> AdditionalValidation[Additional Validation]
    FormatAPI --> AdditionalValidation
    AdditionalValidation --> APICall[Call External API]
    APICall --> ProcessComplete[Set Processing = false]

    classDef queueStyle fill:#f3e5f5,stroke:#4a148c
    classDef processStyle fill:#e3f2fd,stroke:#0d47a1
    classDef freeSpinStyle fill:#fff3e0,stroke:#ff6f00

    class QueueProcessor,CheckQueues,DequeueBet queueStyle
    class SetProcessing,AdditionalValidation,APICall,ProcessComplete processStyle
    class FormatFreeSpinAPI freeSpinStyle
```

## 8. API Processing & Response Handling (Updated)

```mermaid
flowchart TD
    APICall[External API Call] --> APIResponse{API Response}
    APIResponse -->|Success| SuccessPath[Success Handler]
    APIResponse -->|Failure| FailurePath[Failure Handler]

    SuccessPath --> InsertLog[Insert Bet Log]
    InsertLog --> UpsertBet[Upsert Bet Record]
    UpsertBet --> UpdateStats[Update Game Statistics]
    UpdateStats --> CheckBetType{Free Spin Bet?}

    CheckBetType -->|Yes| CreateTicketAPI[Call promotion-ticket API with betId & promotionId]
    CheckBetType -->|No| CheckFreeBet{Free Bet?}

    CreateTicketAPI --> TicketResult{API Success?}
    TicketResult -->|Yes| NotifySuccess[Notify Success]
    TicketResult -->|No| LogTicketError[Log Ticket Creation Error]
    LogTicketError --> NotifySuccess

    CheckFreeBet -->|Yes| UpdateBalance[Update Balance & Coins]
    CheckFreeBet -->|No| NotifySuccess
    UpdateBalance --> NotifySuccess

    FailurePath --> CheckFailedBetType{Failed Free Spin?}
    CheckFailedBetType -->|Yes| RollbackBonusAPI[Call player-promotion/rollback-bonus-item API]
    CheckFailedBetType -->|No| RollbackTracks[Rollback Bet Tracks]

    RollbackBonusAPI --> NotifyFailure[Notify Failure]
    RollbackTracks --> NotifyFailure

    NotifySuccess --> Publisher[PlaceBetPublisher]
    NotifyFailure --> Publisher
    Publisher --> ClientResponse[Send to Client via WebSocket]

    classDef successStyle fill:#e8f5e8,stroke:#2e7d32
    classDef failureStyle fill:#ffebee,stroke:#c62828
    classDef publisherStyle fill:#e3f2fd,stroke:#0d47a1
    classDef apiStyle fill:#e1f5fe,stroke:#0277bd

    class SuccessPath,InsertLog,UpsertBet,UpdateStats,UpdateBalance,NotifySuccess successStyle
    class FailurePath,RollbackTracks,NotifyFailure,LogTicketError failureStyle
    class Publisher,ClientResponse publisherStyle
    class CreateTicketAPI,RollbackBonusAPI apiStyle
```

## 9. Free Spin Sequence Flow (API-Based)

```mermaid
sequenceDiagram
    participant Player
    participant Game
    participant API as PromotionAPI
    participant B as BetSystem
    participant S as Settlement

    Player->>Game: Place Free Spin Bet

    Game->>API: GET player-promotion/claim-promotion
    API->>Game: Return promotion data (remainingBonusItems: 50)

    Game->>API: POST player-promotion/deduct-bonus-item (amount: 1)
    API->>Game: Deduction success (remainingBonusItems: 49)

    Game->>B: Create Free Spin Bet
    Note over B: isFreeSpin: true, amount: 0.00, promotionId: "promo123"

    alt Bet Placement Successful
        B->>Game: Bet created successfully

        Game->>S: End Game & Settle
        S->>B: Process settlement
        S->>Game: Settlement complete

        Game->>API: POST promotion-ticket (betId, promotionId, playerId, etc.)
        API->>Game: Ticket created successfully

        Game->>Player: Free spin completed successfully

    else Bet Placement Failed
        B->>Game: Bet creation failed

        Game->>API: POST player-promotion/rollback-bonus-item (promotionId, amount: 1)
        Note over API: Rollback: remainingBonusItems: 50 (restored)
        API->>Game: Rollback successful

        Game->>Player: Free spin failed - bonus restored
    end
```

## Summary

The updated place bet system now handles both regular bets and free spins with these key enhancements:

### **Free Spin Specific Features (API-Based):**

1. **API-based validation**: Call `player-promotion/claim-promotion` to check eligibility
2. **API-based deduction**: Call `player-promotion/deduct-bonus-item` before bet placement
3. **API-based rollback**: Call `player-promotion/rollback-bonus-item` if bet fails
4. **API-based tracking**: Call `promotion-ticket` API with betId and promotionId for complete audit trail
5. **Zero-amount handling**: Process bets with 0.00 amount
6. **Promotion tracking**: Include promotionId in bet data throughout the entire flow
7. **External state management**: All promotion state managed via Promotion APIs

### **Enhanced Error Handling:**

- Free spin specific error paths with API fallbacks
- Dedicated `rollback-bonus-item` API for bonus item restoration on failures
- Promotion state consistency via external APIs

### **Validation Layers:**

1. Free spin eligibility validation via `player-promotion/claim-promotion` API
2. Bonus items availability check through API response
3. Regular bet validation (adapted for free spins)
4. API-level validation and error handling

### **Data Flow:**

- Maintains separation between free spin and regular bet logic
- API-based communication for all promotion operations
- Consistent error handling across both flows
- Comprehensive audit trail via `promotion-ticket` API

This API-based approach ensures that free spin functionality integrates seamlessly with the existing place bet system while maintaining clear separation of concerns, external state management, and robust error handling through dedicated Promotion APIs.

```

```
