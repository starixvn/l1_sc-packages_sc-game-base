# Place Bet System Diagrams

This directory contains comprehensive diagrams documenting the place bet system architecture, including free spin functionality and integration with Pentagon's official promotion APIs.

## Diagrams Overview

### 1. [Class Diagram](place-bet-class-diagram.md)

- **Purpose**: Shows the relationships between all system components
- **Key Focus**: Component interactions and data flow
- **Includes**: Free spin integration points and official API usage

### 2. [Flow Diagrams](place-bet-flow-diagram.md)

- **Purpose**: Detailed step-by-step process flows
- **Structure**: 8 focused diagrams covering different aspects
- **Coverage**: Complete bet lifecycle including free spins

## System Architecture Overview

### Core Components

#### **WebSocket Layer**

- **BaseSocketRouter**: Handles incoming WebSocket events and routes to appropriate consumers

#### **Business Logic Layer**

- **PlaceBetConsumer**: Processes bet requests, validates parameters, and manages free spin detection
- **UserSignInConsumer**: Handles user authentication and promotion claiming
- **ProcessBetQueue**: Asynchronously processes bet queues with external API integration

#### **Data Management**

- **GameData**: Manages in-memory game state and player data
- **PlayerInGame**: Represents individual player state including promotion data

#### **External Integration**

- **GamePromotionApiClient**: Official Pentagon package for all promotion operations
- **External Bet API**: Handles actual bet placement and settlement

#### **Communication Layer**

- **PlaceBetPublisher**: Manages real-time client notifications via WebSocket

### Free Spin Integration

The system integrates free spin functionality through Pentagon's official promotion APIs:

1. **Sign-In Phase**: Claims available promotions and stores in player data
2. **Bet Detection**: Automatically detects free spin eligibility from player promotion data
3. **Deduction Phase**: Deducts bonus items before bet placement
4. **Processing Phase**: Processes free spin bets through regular bet queue
5. **Audit Phase**: Creates promotion tickets for complete audit trail
6. **Error Handling**: Rollback mechanisms for failed free spin attempts

### API Integration

The system now uses the official `@sc/game-promotion-api-client` package:

- **Standardized**: Uses Pentagon's official API client
- **Maintained**: Officially supported and maintained by Pentagon
- **Consistent**: Follows Pentagon's standard patterns and conventions
- **Reliable**: Production-tested and validated by Pentagon team

### Key Benefits

1. **Separation of Concerns**: Clear boundaries between game logic and promotion logic
2. **Scalability**: Asynchronous processing with queue management
3. **Reliability**: Comprehensive error handling and rollback mechanisms
4. **Auditability**: Complete audit trail through promotion tickets
5. **Official Support**: Uses Pentagon's official promotion infrastructure

## Diagram Navigation

### For Developers

- Start with **Class Diagram** to understand component relationships
- Review **Flow Diagrams** for detailed process understanding
- Focus on specific flows based on your development needs

### For Architects

- **Class Diagram** shows overall system structure
- **High-Level Overview** in flow diagrams shows system boundaries
- **API Integration** sections show external dependencies

### For QA/Testing

- **Flow Diagrams** provide complete test scenarios
- **Error Handling** flows show failure cases to test
- **Free Spin Sequence** shows specific promotion test cases

## Implementation Notes

### Configuration Requirements

- Pentagon promotion API credentials and endpoints
- Game-specific promotion eligibility rules
- Free spin configuration per game type

### Dependencies

- `@sc/game-promotion-api-client` - Official Pentagon promotion package
- WebSocket infrastructure for real-time communication
- External bet processing APIs

### Monitoring Points

- Promotion API response times and error rates
- Free spin usage patterns and success rates
- Queue processing performance and backlog monitoring

This documentation provides a complete reference for understanding, implementing, and maintaining the place bet system with integrated free spin functionality.
