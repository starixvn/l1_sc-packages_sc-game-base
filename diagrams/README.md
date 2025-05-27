# Place Bet System Diagrams (Updated with Free Spin)

This folder contains comprehensive diagrams documenting the place bet system architecture and flow, including free spin functionality.

## Files

### 📊 [place-bet-class-diagram.md](./place-bet-class-diagram.md)

**Class Diagram** showing the static structure of the place bet system with free spin integration:

- Core classes and their relationships
- Free spin specific components (FreeSpinHandler, PlayerPromotion, PromotionTicket)
- Key methods and properties
- Inheritance hierarchy
- Dependencies between components

### 🔄 [place-bet-flow-diagram.md](./place-bet-flow-diagram.md)

**Flow Diagrams** broken down into 9 focused sections (Updated with Sign-In Based Free Spin):

1. **High-Level Overview** - Complete system flow with sign-in promotion claiming
2. **User Sign-In & Promotion Claiming** - Promotion claiming during sign-in process
3. **Request Reception & Initial Processing** - WebSocket handling with free spin detection
4. **Free Spin Detection & Validation Layer** - Local data-driven validation and bonus management
5. **Regular Validation Layer Details** - Multi-layer validation system with API-based rollback
6. **Player Data Management** - Player state, bet tracking, and promotion data
7. **Queue Processing** - Asynchronous processing for both regular and free spin bets
8. **API Processing & Response Handling** - External API integration with promotion tickets
9. **Free Spin Sequence Flow (API-Based)** - Complete API-driven free spin interaction sequence

## How to Use

### Viewing Diagrams

These diagrams use **Mermaid** syntax and can be viewed in:

- GitHub (native Mermaid support)
- VS Code with Mermaid extension
- Online Mermaid editors
- Documentation platforms that support Mermaid

### Understanding the System

1. Start with the **High-Level Overview** in the flow diagram
2. Review the **Class Diagram** to understand component relationships
3. Deep dive into specific flow sections as needed

## System Overview

The place bet system is designed with enhanced API-based free spin capabilities:

- **Simplified Architecture**: Removed base classes for cleaner, more focused design
- **Separation of Concerns**: Clear boundaries between validation, processing, and communication
- **Asynchronous Processing**: Queue-based system for scalability
- **Multiple Validation Layers**: Ensuring data integrity at every step
- **Real-time Communication**: Direct WebSocket-based immediate feedback
- **Error Resilience**: Comprehensive error handling and rollback mechanisms
- **API-Based Free Spin Integration**: Seamless handling of promotional free spin bets via Promotion APIs
- **External Bonus Management**: API-driven pre-deduction and rollback mechanisms for bonus items

## Architecture Highlights

### Key Components

- **UserSignInConsumer**: Handles user sign-in and claims promotions during sign-in
- **PlaceBetConsumer**: Initial validation, queuing, and free spin detection from local data
- **PromotionApiClient**: Handles all promotion-related API communications
- **ProcessBetQueue**: Asynchronous bet processing for both regular and free spin bets
- **PlaceBetPublisher**: Real-time client communication with free spin notifications
- **GameData**: Central state management for game-level data (time, rounds, players, configs)
- **PlayerInGame**: Enhanced with promotion data (promotionData object containing promotionId, code, bonusItemCount)
- **PlayerPromotion**: Data model for promotion information (from API)
- **PromotionTicket**: Complete audit trail and status tracking for free spins (created via API)

### Flow Characteristics

- **Non-blocking**: Immediate response to clients
- **Reliable**: Multiple validation and error handling layers
- **Scalable**: Queue-based processing with concurrency control
- **Auditable**: Comprehensive logging and API-based tracking
- **API-Driven**: Full free spin lifecycle management via external APIs
- **Rollback-capable**: API-based bonus item restoration on failures

### Free Spin Features (Sign-In Based)

- **Sign-in promotion claiming**: Call `player-promotion/claim-promotion` during user sign-in
- **Local free spin detection**: Always return promotion data from `PlayerInGame` (promotionId, code, bonusItemCount)
- **API-based deduction**: Call `player-promotion/deduct-bonus-item` before bet placement
- **API-based rollback**: Call `player-promotion/rollback-bonus-item` if bet fails
- **API-based tracking**: Call `promotion-ticket` API to create comprehensive audit records with status tracking
- **Zero-amount processing**: Handle bets with 0.00 amount
- **Hybrid state management**: Local promotion data for quick access, API for state changes

### Promotion APIs Integration

The system integrates with four key Promotion APIs:

1. **`player-promotion/claim-promotion`**: Get existing or claim new promotion for a player
2. **`player-promotion/deduct-bonus-item`**: Deduct bonus items from player promotion
3. **`player-promotion/rollback-bonus-item`**: Rollback bonus items if bet fails
4. **`promotion-ticket`**: Create audit tickets for tracking free spin activities

These diagrams serve as the definitive reference for understanding how the enhanced place bet system works with API-based promotion management, including both regular betting and free spin promotional features, from initial client request to final response.
