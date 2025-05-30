# Place Bet System - Flow Diagrams (Updated with Promotion)

## Overview

The place bet flow has been updated to include promotion functionality using Pentagon's official `@sc/game-promotion-api-client` package, broken down into smaller, focused diagrams for better readability and understanding.

## 1. High-Level Overview

```mermaid
flowchart LR
    Client[Client Application] --> Socket[WebSocket]
    Socket --> Router[BaseSocketRouter]

    Router --> SignIn[UserSignInConsumer]
    SignIn --> OfficialAPI[GamePromotionApiClient]
    OfficialAPI --> StoreData[Store in PlayerInGame]

    Router --> Consumer[PlaceBetConsumer]
    Consumer --> DetectPromotion{Detect Promotion from PlayerInGame}
    DetectPromotion -->|Yes| PromotionFlow[Promotion Flow]
    DetectPromotion -->|No| RegularFlow[Regular Bet Flow]
    PromotionFlow --> Validation[Validation Layer]
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
    UserValid -->|Yes| CallOfficialAPI[Call GamePromotionApiClient.claimPromotion()]

    CallOfficialAPI --> PromotionResult{Promotion Available?}
    PromotionResult -->|No| CreatePlayerData[Create PlayerInGame without Promotions]
    PromotionResult -->|Yes| StorePromotionData[Store Promotion Data in PlayerInGame]

    StorePromotionData --> SetPromotion[Set promotion Object]
    SetPromotion --> SetPromotionFields[promotionId, code, bonusItemCount]
    SetPromotionFields --> CompleteSignIn[Complete Sign-In Process]

    CreatePlayerData --> CompleteSignIn
    CompleteSignIn --> NotifyClient[Notify Client of Sign-In Success]

    classDef signInStyle fill:#f3e5f5,stroke:#4a148c
    classDef apiStyle fill:#e1f5fe,stroke:#0277bd
    classDef dataStyle fill:#e8f5e8,stroke:#1b5e20
    classDef errorStyle fill:#ffebee,stroke:#c62828

    class UserSignInConsumer,ValidateUser,CompleteSignIn signInStyle
    class CallOfficialAPI apiStyle
    class StorePromotionData,SetPromotion,SetPromotionFields,CreatePlayerData dataStyle
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
    Normalize --> CheckPromotion{Promotion Bet?}

    CheckPromotion -->|Yes| GetPromotion[Get Promotion from PlayerInGame]
    CheckPromotion -->|No| ParamCheck[Parameter Validation]

    GetPromotion --> CheckBonusCount{bonusItemCount > 0?}
    CheckBonusCount -->|No| ParamCheck
    CheckBonusCount -->|Yes| DeductBonus[Call GamePromotionApiClient.deductBonusItem()]
    DeductBonus --> BonusSuccess{API Success?}
    BonusSuccess -->|No| BonusError[Send API Error]
    BonusSuccess -->|Yes| SetPromotionParams[Set Promotion Parameters with promotionId]
    SetPromotionParams --> ParamCheck

    ParamCheck -->|Invalid| ErrorResponse[Send Error Response]
    ParamCheck -->|Valid| BetValidation[Business Logic Validation]

    classDef errorStyle fill:#ffebee,stroke:#c62828
    classDef successStyle fill:#e8f5e8,stroke:#2e7d32
    classDef apiStyle fill:#e1f5fe,stroke:#0277bd

    class Reject,ErrorResponse,BonusError errorStyle
    class Consumer,Normalize,BetValidation successStyle
    class GetPromotion,DeductBonus,SetPromotionParams apiStyle
```

## 4. Promotion Detection & Validation Layer

```mermaid
flowchart TD
    PromotionDetection[Promotion Detection] --> CheckPlayerData[Check PlayerInGame Data]
    CheckPlayerData --> GetPromotion[Get Promotion from PlayerInGame]

    GetPromotion --> PromotionData[Return Promotion Data]
    PromotionData --> ShowData[promotionId, code, bonusItemCount]
    ShowData --> HasBonusItems{bonusItemCount > 0?}
    HasBonusItems -->|No| NoPromotions[No Promotions Available]
    HasBonusItems -->|Yes| DeductAPI[Call GamePromotionApiClient.deductBonusItem()]

    NoPromotions --> RegularBetFlow[Continue as Regular Bet]

    DeductAPI --> DeductResult{API Success?}
    DeductResult -->|No| APIError[API Error Response]
    DeductResult -->|Yes| UpdatePlayerData[Update PlayerInGame bonusItemCount]
    UpdatePlayerData --> RegularValidation[Continue to Regular Validation]

    classDef dataStyle fill:#e8f5e8,stroke:#1b5e20
    classDef apiStyle fill:#e1f5fe,stroke:#0277bd
    classDef promotionStyle fill:#fff3e0,stroke:#e65100
    classDef errorStyle fill:#ffebee,stroke:#c62828
    classDef successStyle fill:#e8f5e8,stroke:#2e7d32

    class CheckPlayerData,GetPromotion,UpdatePlayerData dataStyle
    class DeductAPI apiStyle
    class PromotionData,ShowData promotionStyle
    class APIError,NoPromotions errorStyle
    class RegularValidation,RegularBetFlow successStyle
```

## 5. Regular Validation Layer Details

```mermaid
flowchart TD
    BetValidation[Business Logic Validation] --> TimeCheck[Betting Time Validation]
    BetValidation --> AmountCheck[Bet Amount Validation]
    BetValidation --> ChoiceCheck[Bet Choice Validation]
    BetValidation --> HedgeCheck[Hedge Bet Validation]
    BetValidation --> PromotionCheck[Promotion Config Check]

    TimeCheck --> TimeResult{Valid?}
    AmountCheck --> AmountResult{Valid?}
    ChoiceCheck --> ChoiceResult{Valid?}
    HedgeCheck --> HedgeResult{Valid?}
    PromotionCheck --> PromotionResult{Valid?}

    TimeResult -->|No| ValidationFail[Validation Failed]
    AmountResult -->|No| ValidationFail
    ChoiceResult -->|No| ValidationFail
    HedgeResult -->|No| ValidationFail
    PromotionCheck -->|No| ValidationFail

    TimeResult -->|Yes| ValidationPass[All Validations Pass]
    AmountResult -->|Yes| ValidationPass
    ChoiceResult -->|Yes| ValidationPass
    HedgeResult -->|Yes| ValidationPass
    PromotionResult -->|Yes| ValidationPass

    ValidationFail --> CheckPromotion{Was Promotion?}
    CheckPromotion -->|Yes| RollbackAPI[Call GamePromotionApiClient.rollbackBonusItem()]
    CheckPromotion -->|No| NotifyError[Notify Error to Client]
    RollbackAPI --> NotifyError

    ValidationPass --> PlayerManagement[Player Data Management]

    classDef validationStyle fill:#fff3e0,stroke:#e65100
    classDef errorStyle fill:#ffebee,stroke:#c62828
    classDef successStyle fill:#e8f5e8,stroke:#2e7d32
    classDef apiStyle fill:#e1f5fe,stroke:#0277bd

    class TimeCheck,AmountCheck,ChoiceCheck,HedgeCheck,PromotionCheck validationStyle
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
    SetBetQueue --> CheckPromotion{Promotion Bet?}

    CheckPromotion -->|Yes| UpdateTracks
    CheckPromotion -->|No| UpdateTracks

    UpdateTracks --> AddAmount[Add Bet Amount to Choice]
    AddAmount --> QueueBet[Add Bet to Queue]
    QueueBet --> QueueComplete[Queue Management Complete]

    classDef dataStyle fill:#e8f5e8,stroke:#1b5e20
    classDef processStyle fill:#e3f2fd,stroke:#0d47a1

    class CreatePlayer,InitializePlayer,SetBetTracks,SetBetQueue,UpdateTracks,AddAmount dataStyle
    class QueueBet,QueueComplete processStyle
```

## 7. Queue Processing (Updated)

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
    SetProcessing --> CheckBetType{Promotion Bet?}

    CheckBetType -->|Yes| FormatPromotionAPI[Format Promotion API Request]
    CheckBetType -->|No| FormatAPI[Format Regular API Request]

    FormatPromotionAPI --> AdditionalValidation[Additional Validation]
    FormatAPI --> AdditionalValidation
    AdditionalValidation --> APICall[Call External API]
    APICall --> ProcessComplete[Set Processing = false]

    classDef queueStyle fill:#f3e5f5,stroke:#4a148c
    classDef processStyle fill:#e3f2fd,stroke:#0d47a1
    classDef promotionStyle fill:#fff3e0,stroke:#ff6f00

    class QueueProcessor,CheckQueues,DequeueBet queueStyle
    class SetProcessing,AdditionalValidation,APICall,ProcessComplete processStyle
    class FormatPromotionAPI promotionStyle
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
    UpdateStats --> CheckBetType{Promotion Bet?}

    CheckBetType -->|Yes| CreateTicketAPI[Call GamePromotionApiClient.createPromotionTicket()]
    CheckBetType -->|No| CheckFreeBet{Free Bet?}

    CreateTicketAPI --> TicketResult{API Success?}
    TicketResult -->|Yes| NotifySuccess[Notify Success]
    TicketResult -->|No| LogTicketError[Log Ticket Creation Error]
    LogTicketError --> NotifySuccess

    CheckFreeBet -->|Yes| UpdateBalance[Update Balance & Coins]
    CheckFreeBet -->|No| NotifySuccess
    UpdateBalance --> NotifySuccess

    FailurePath --> CheckFailedBetType{Failed Promotion?}
    CheckFailedBetType -->|Yes| RollbackBonusAPI[Call GamePromotionApiClient.rollbackBonusItem()]
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

## 9. Promotion Sequence Flow (Official API)

```mermaid
sequenceDiagram
    participant Player
    participant Game
    participant API as GamePromotionApiClient
    participant B as BetSystem
    participant S as Settlement

    Player->>Game: Place Promotion Bet

    Game->>API: claimPromotion(playerDto)
    API->>Game: Return promotion data (remainingBonusItems: 50)

    Game->>API: deductBonusItem(deductDto)
    API->>Game: Deduction success (remainingBonusItems: 49)

    Game->>B: Create Promotion Bet
    Note over B: usePromotion: true, amount: 0.00, promotionId: "promo123"

    alt Bet Placement Successful
        B->>Game: Bet created successfully

        Game->>S: End Game & Settle
        S->>B: Process settlement
        S->>Game: Settlement complete

        Game->>API: createPromotionTicket(ticketDto)
        API->>Game: Ticket created successfully

        Game->>Player: Promotion completed successfully

    else Bet Placement Failed
        B->>Game: Bet creation failed

        Game->>API: rollbackBonusItem(rollbackDto)
        Note over API: Rollback: remainingBonusItems: 50 (restored)
        API->>Game: Rollback successful

        Game->>Player: Promotion failed - bonus restored
    end
```

## 10. Complete Bet Flow Sequence Diagrams

### 10.1 Regular Bet Flow Sequence

```mermaid
sequenceDiagram
    participant Player
    participant Socket as WebSocket
    participant Consumer as PlaceBetConsumer
    participant GameData
    participant Queue as ProcessBetQueue
    participant API as External Bet API
    participant Publisher as PlaceBetPublisher
    participant DB as Database

    Player->>Socket: Send bet event
    Note over Player,Socket: { betChoice: "red", amount: 500, usePromotion: false }

    Socket->>Consumer: Route bet event
    Consumer->>Consumer: Normalize payload
    Consumer->>Consumer: Validate request params
    Consumer->>Consumer: Validate bet request
    Note over Consumer: Check time, amount, choice, hedge bets

    alt Validation Fails
        Consumer->>Publisher: publishToUser(error)
        Publisher->>Socket: Send error response
        Socket->>Player: Bet rejected
    else Validation Passes
        Consumer->>GameData: Initialize/update player data
        Consumer->>GameData: Adjust bet tracks
        Consumer->>GameData: Add to bet queue
        Note over Consumer,GameData: Bet queued for processing

        Consumer->>Socket: (No immediate response)
        Socket->>Player: (Waiting for processing)

        Queue->>GameData: Dequeue bet from queue
        Queue->>Queue: Validate bet request (additional checks)
        Queue->>API: Place bet via external API

        alt API Success
            API->>Queue: Bet successful + balance
            Queue->>DB: Insert bet log
            Queue->>DB: Upsert bet record
            Queue->>GameData: Update game statistics
            Queue->>GameData: Adjust own bets
            Queue->>Publisher: publishSuccessBet()
            Publisher->>Socket: Send success response
            Socket->>Player: Bet confirmed
        else API Failure
            API->>Queue: Bet failed + error
            Queue->>GameData: Decrease bet tracks (rollback)
            Queue->>Publisher: publishGameFailedBet()
            Publisher->>Socket: Send failure response
            Socket->>Player: Bet failed
        end
    end
```

### 10.2 Promotion Bet Flow Sequence

```mermaid
sequenceDiagram
    participant Player
    participant Socket as WebSocket
    participant Consumer as PlaceBetConsumer
    participant GameData
    participant Queue as ProcessBetQueue
    participant PromotionAPI as GamePromotionApiClient
    participant BetAPI as External Bet API
    participant Publisher as PlaceBetPublisher
    participant DB as Database

    Player->>Socket: Send promotion bet event
    Note over Player,Socket: { betChoice: "red", amount: 100, usePromotion: true }

    Socket->>Consumer: Route bet event
    Consumer->>Consumer: Normalize payload
    Consumer->>Consumer: Check usePromotion flag
    Consumer->>Consumer: Get promotion bet amount (0)
    Note over Consumer: payload.amount = 0, promotionId = "promo123"

    Consumer->>Consumer: Validate request params
    Consumer->>Consumer: Validate promotion criteria
    Note over Consumer: Check endDate, bonusItemCount, isActive

    alt Promotion Validation Fails
        Consumer->>Publisher: publishToUser(promotion error)
        Publisher->>Socket: Send promotion error
        Socket->>Player: Promotion bet rejected
    else Promotion Validation Passes
        Consumer->>GameData: Initialize/update player data
        Consumer->>GameData: Adjust bet tracks (amount: 0)
        Consumer->>GameData: Add to bet queue
        Note over Consumer,GameData: Promotion bet queued

        Consumer->>Socket: (No immediate response)
        Socket->>Player: (Waiting for processing)

        Queue->>GameData: Dequeue promotion bet
        Queue->>Queue: Validate bet request
        Queue->>PromotionAPI: deductBonusItem()
        Note over Queue,PromotionAPI: Deduct 1 bonus item

        alt Deduction Fails
            PromotionAPI->>Queue: Deduction failed
            Queue->>Publisher: publishGameFailedBet(deduction error)
            Publisher->>Socket: Send deduction error
            Socket->>Player: Promotion deduction failed
        else Deduction Success
            PromotionAPI->>Queue: Deduction success + remaining items
            Queue->>GameData: Update player.promotion.bonusItemCount
            Queue->>BetAPI: Place bet via external API
            Note over Queue,BetAPI: amount: 0, metadata: { usePromotion: true }

            alt Bet API Success
                BetAPI->>Queue: Bet successful + balance
                Queue->>DB: Insert bet log (with promotion metadata)
                Queue->>DB: Upsert bet record (with promotion metadata)
                Queue->>GameData: Update game statistics
                Queue->>GameData: Adjust own bets
                Queue->>PromotionAPI: createPromotionTicket()
                Note over Queue,PromotionAPI: Create audit ticket with betId

                alt Ticket Creation Success
                    PromotionAPI->>Queue: Ticket created successfully
                    Queue->>Publisher: publishSuccessBet()
                    Publisher->>Socket: Send success response
                    Socket->>Player: Promotion bet confirmed
                else Ticket Creation Fails
                    PromotionAPI->>Queue: Ticket creation failed
                    Note over Queue: Log error but continue (bet still successful)
                    Queue->>Publisher: publishSuccessBet()
                    Publisher->>Socket: Send success response
                    Socket->>Player: Promotion bet confirmed
                end
            else Bet API Failure
                BetAPI->>Queue: Bet failed + error
                Queue->>GameData: Decrease bet tracks (rollback)
                Queue->>PromotionAPI: rollbackBonusItem()
                Note over Queue,PromotionAPI: Restore deducted bonus item

                alt Rollback Success
                    PromotionAPI->>Queue: Rollback successful
                    Queue->>GameData: Update player.promotion.bonusItemCount
                    Queue->>Publisher: publishGameFailedBet()
                    Publisher->>Socket: Send failure response
                    Socket->>Player: Promotion bet failed (bonus restored)
                else Rollback Fails
                    PromotionAPI->>Queue: Rollback failed
                    Note over Queue: Log rollback error
                    Queue->>Publisher: publishGameFailedBet()
                    Publisher->>Socket: Send failure response
                    Socket->>Player: Promotion bet failed (bonus may be lost)
                end
            end
        end
    end
```

### 10.3 Error Handling Flow Sequence

```mermaid
sequenceDiagram
    participant Player
    participant Socket as WebSocket
    participant Consumer as PlaceBetConsumer
    participant Queue as ProcessBetQueue
    participant PromotionAPI as GamePromotionApiClient
    participant Publisher as PlaceBetPublisher

    Player->>Socket: Send invalid bet
    Socket->>Consumer: Route bet event

    alt Consumer Validation Error
        Consumer->>Consumer: Validation fails
        Consumer->>Publisher: publishToUser(validation error)
        Publisher->>Socket: Send validation error
        Socket->>Player: Immediate error response
    else Queue Processing Error
        Consumer->>Queue: Bet queued successfully
        Queue->>Queue: Additional validation fails
        Queue->>Publisher: publishGameFailedBet(queue error)
        Publisher->>Socket: Send queue error
        Socket->>Player: Delayed error response
    else Promotion API Error
        Queue->>PromotionAPI: deductBonusItem()
        PromotionAPI->>Queue: API timeout/error
        Queue->>Publisher: publishGameFailedBet(API error)
        Publisher->>Socket: Send API error
        Socket->>Player: API error response
    else Unexpected Error
        Consumer->>Consumer: Exception thrown
        Consumer->>Publisher: publishToUser(generic error)
        Publisher->>Socket: Send generic error
        Socket->>Player: Generic error response
    end
```

### 10.4 Data Flow Summary

```mermaid
flowchart TD
    A[Player Input] --> B[PlaceBetConsumer]
    B --> C{Validation}
    C -->|Pass| D[Queue Bet]
    C -->|Fail| E[Immediate Error]

    D --> F[ProcessBetQueue]
    F --> G{Promotion?}
    G -->|Yes| H[Deduct Bonus Item]
    G -->|No| I[Direct to Bet API]

    H --> J{Deduction OK?}
    J -->|Yes| I
    J -->|No| K[Deduction Error]

    I --> L[External Bet API]
    L --> M{Bet Success?}
    M -->|Yes| N[Success Flow]
    M -->|No| O[Failure Flow]

    N --> P[Store Data]
    N --> Q{Promotion?}
    Q -->|Yes| R[Create Ticket]
    Q -->|No| S[Notify Success]
    R --> S

    O --> T{Promotion?}
    T -->|Yes| U[Rollback Bonus]
    T -->|No| V[Notify Failure]
    U --> V

    E --> W[Player Response]
    K --> W
    S --> W
    V --> W

    style B fill:#e1f5fe
    style F fill:#f3e5f5
    style H fill:#fff3e0
    style R fill:#fff3e0
    style U fill:#ffebee
```

## Summary

The updated place bet system now handles both regular bets and promotions using Pentagon's official `@sc/game-promotion-api-client` package with these key enhancements:

### **Official API Integration:**

1. **GamePromotionApiClient.claimPromotion()**: Check and claim promotions during sign-in
2. **GamePromotionApiClient.deductBonusItem()**: Deduct bonus items before bet placement
3. **GamePromotionApiClient.rollbackBonusItem()**: Rollback bonus items if bet fails
4. **GamePromotionApiClient.createPromotionTicket()**: Create audit tickets with betId and promotionId
5. **Zero-amount handling**: Process bets with 0.00 amount
6. **Promotion tracking**: Include promotionId in bet data throughout the entire flow
7. **Official state management**: All promotion state managed via Pentagon's official APIs

### **Enhanced Error Handling:**

- Promotion specific error paths with official API fallbacks
- Dedicated rollback mechanisms through official API
- Promotion state consistency via Pentagon's infrastructure

### **Validation Layers:**

1. Promotion eligibility validation via official API
2. Bonus items availability check through API response
3. Regular bet validation (adapted for promotions)
4. Official API-level validation and error handling

### **Data Flow:**

- Maintains separation between promotion and regular bet logic
- Official API-based communication for all promotion operations
- Consistent error handling across both flows
- Comprehensive audit trail via official promotion ticket API

This official API-based approach ensures that promotion functionality integrates seamlessly with the existing place bet system while maintaining clear separation of concerns, official Pentagon support, and robust error handling through Pentagon's standardized promotion infrastructure.

```

```
