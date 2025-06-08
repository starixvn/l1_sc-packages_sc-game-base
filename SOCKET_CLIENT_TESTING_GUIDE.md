# Socket Client Testing Guide

This guide provides step-by-step instructions for setting up a socket client to test the full game flow based on the BaseSocketRouter implementation.

## Overview

The socket server handles the following events:

- `signin` - User authentication
- `inGame` - Join game session
- `bet` - Place bets
- `getHistory` - Retrieve betting history
- `getRoundPF` - Get provably fair data for rounds
- `betDetails` - Get detailed bet information
- `disconnect` - Handle user disconnection

## Prerequisites

- Node.js installed
- Socket.IO client library
- Access to the game server endpoint

## Installation

```bash
npm install socket.io-client
```

## Basic Client Setup

### 1. Simple Node.js Test Client

```javascript
const io = require("socket.io-client");

// Connect to your game server
const socket = io("http://localhost:3000", {
  transports: ["websocket"],
});

// Connection event handlers
socket.on("connect", () => {
  console.log("Connected to server:", socket.id);
});

socket.on("disconnect", () => {
  console.log("Disconnected from server");
});

// Listen for game responses (replace 'gameName' with actual game name)
socket.on("gameName", (data) => {
  console.log("Game Response:", data);
});

socket.on("connect_error", (error) => {
  console.error("Connection error:", error);
});
```

### 2. Browser Test Client

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Socket Game Client Test</title>
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
  </head>
  <body>
    <div id="status">Disconnected</div>
    <div id="responses"></div>

    <script>
      const socket = io("http://localhost:3000");
      const statusDiv = document.getElementById("status");
      const responsesDiv = document.getElementById("responses");

      socket.on("connect", () => {
        statusDiv.textContent = "Connected: " + socket.id;
      });

      socket.on("disconnect", () => {
        statusDiv.textContent = "Disconnected";
      });

      // Listen for game responses
      socket.on("gameName", (data) => {
        responsesDiv.innerHTML += "<pre>" + JSON.stringify(data, null, 2) + "</pre>";
      });
    </script>
  </body>
</html>
```

## Testing Flow

### Step 1: Sign In

```javascript
// Sign in payload - adjust based on your authentication requirements
const signinPayload = {
  username: "testuser",
  token: "your-auth-token",
  operatorId: "operator123",
  siteId: "site456",
  // Add other required authentication fields
};

socket.emit("signin", signinPayload);
```

### Step 2: Join Game

```javascript
// After successful signin, join the game
socket.emit("inGame");
```

### Step 3: Place Bets

```javascript
// Place a regular bet - adjust payload based on game requirements
const betPayload = {
  amount: 10.0,
  betChoice: "red",
  freeBet: false,
  // Add other bet-specific fields
};

socket.emit("bet", betPayload);

// Place a promotion bet (amount will be auto-assigned by server)
const promotionBetPayload = {
  betChoice: "black",
  amount: 0, // This will be overridden by promotion amount
  freeBet: false,
  usePromotion: true,
};

socket.emit("bet", promotionBetPayload);
```

### Step 4: Get History

```javascript
// Get betting history (page-based)
const historyPayload = {
  page: 1,
};

socket.emit("getHistory", historyPayload);
```

### Step 5: Get Provably Fair Data

```javascript
// Get provably fair data for a specific round
const pfPayload = {
  roundId: 12345,
};

socket.emit("getRoundPF", pfPayload);
```

### Step 6: Get Bet Details

```javascript
// Get detailed bet information
const betDetailsPayload = {
  mode: "detailed",
  timeZoneOffset: -300, // UTC offset in minutes
  roundId: 12345,
  language: "en",
};

socket.emit("betDetails", betDetailsPayload);
```

## Complete Test Client Example

```javascript
const io = require("socket.io-client");

class GameSocketTester {
  constructor(serverUrl, gameName) {
    this.serverUrl = serverUrl;
    this.gameName = gameName;
    this.socket = null;
    this.isSignedIn = false;
  }

  connect() {
    this.socket = io(this.serverUrl, {
      transports: ["websocket"],
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.socket.on("connect", () => {
      console.log("✅ Connected to server:", this.socket.id);
    });

    this.socket.on("disconnect", () => {
      console.log("❌ Disconnected from server");
      this.isSignedIn = false;
    });

    this.socket.on(this.gameName, (data) => {
      console.log("🎮 Game Response:", JSON.stringify(data, null, 2));

      // Handle specific response types
      if (data.betDetailsUrl) {
        console.log("📊 Bet Details URL:", data.betDetailsUrl);
      }
    });

    this.socket.on("connect_error", (error) => {
      console.error("🚫 Connection error:", error);
    });
  }

  async signin(credentials) {
    console.log("🔐 Attempting signin...");
    this.socket.emit("signin", credentials);

    // Wait for response (you might want to implement proper response handling)
    await new Promise((resolve) => setTimeout(resolve, 1000));
    this.isSignedIn = true;
  }

  joinGame() {
    if (!this.isSignedIn) {
      console.log("⚠️  Must sign in first");
      return;
    }

    console.log("🎯 Joining game...");
    this.socket.emit("inGame");
  }

  placeBet(betData) {
    if (!this.isSignedIn) {
      console.log("⚠️  Must sign in first");
      return;
    }

    console.log("💰 Placing bet:", betData);
    this.socket.emit("bet", betData);
  }

  getHistory(page = 1) {
    if (!this.isSignedIn) {
      console.log("⚠️  Must sign in first");
      return;
    }

    console.log("📜 Getting history page:", page);
    this.socket.emit("getHistory", { page });
  }

  getRoundPF(roundId) {
    if (!this.isSignedIn) {
      console.log("⚠️  Must sign in first");
      return;
    }

    console.log("🎲 Getting provably fair data for round:", roundId);
    this.socket.emit("getRoundPF", { roundId });
  }

  getBetDetails(roundId, options = {}) {
    if (!this.isSignedIn) {
      console.log("⚠️  Must sign in first");
      return;
    }

    const payload = {
      roundId,
      mode: options.mode || "detailed",
      timeZoneOffset: options.timeZoneOffset || new Date().getTimezoneOffset(),
      language: options.language || "en",
      ...options,
    };

    console.log("📊 Getting bet details:", payload);
    this.socket.emit("betDetails", payload);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// Usage example
async function runTest() {
  const tester = new GameSocketTester("http://localhost:3000", "yourGameName");

  tester.connect();

  // Wait for connection
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Test signin
  await tester.signin({
    username: "testuser",
    token: "your-auth-token",
    operatorId: "op123",
    siteId: "site456",
  });

  // Test game flow
  tester.joinGame();

  await new Promise((resolve) => setTimeout(resolve, 500));

  tester.placeBet({
    amount: 10.0,
    betChoice: "red",
    freeBet: false,
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  tester.getHistory(1);

  await new Promise((resolve) => setTimeout(resolve, 500));

  tester.getRoundPF(12345);

  await new Promise((resolve) => setTimeout(resolve, 500));

  tester.getBetDetails(12345);

  // Cleanup after 10 seconds
  setTimeout(() => {
    tester.disconnect();
    process.exit(0);
  }, 10000);
}

// Run the test
runTest().catch(console.error);
```

## Error Handling

The server will:

- Disconnect unauthorized users automatically
- Return errors for invalid operations
- Log warnings for authentication issues (403 errors)

Make sure to handle these cases in your client:

```javascript
socket.on("disconnect", (reason) => {
  if (reason === "io server disconnect") {
    console.log("🚫 Server disconnected the client (likely unauthorized)");
  }
});
```

## Testing Promotion Bets

If your player has promotion data, you can test promotion betting:

```javascript
// Test promotion bet - amount will be auto-assigned by server
const promotionTest = async () => {
  // Ensure player has promotion data during signin
  await tester.signin({
    username: "testuser",
    token: "your-auth-token",
    operatorId: "op123",
    siteId: "site456",
    // Promotion data should be included in server response
  });

  tester.joinGame();

  // Place promotion bet - amount gets completely overridden
  tester.placeBet({
    betChoice: "red",
    amount: 999999, // ANY amount works - gets replaced with promotional value
    freeBet: true, // freeBet setting is ignored for promotions
    usePromotion: true,
  });
};

// Test edge cases for promotion validation
const testPromotionEdgeCases = async () => {
  // Test with invalid amounts - should still work
  tester.placeBet({
    betChoice: "red",
    amount: -100, // Negative amount - ignored
    usePromotion: true,
  });

  // Test with amounts above max bet - should still work
  tester.placeBet({
    betChoice: "black",
    amount: 999999999, // Extremely high - ignored
    usePromotion: true,
  });

  // Test with amounts below min bet - should still work
  tester.placeBet({
    betChoice: "red",
    amount: 0.001, // Tiny amount - ignored
    usePromotion: true,
  });
};
```

### Key Promotion Bet Characteristics

- ✅ **Amount Override**: Any amount in payload gets replaced with `getPromotionBetAmount()` result
- ✅ **No Amount Validation**: Min/max bet limits don't apply to promotion bets
- ✅ **FreeBet Independence**: `freeBet` setting is ignored for promotion bets
- ✅ **Predetermined Values**: Promotional amounts are set by game-specific logic
- ✅ **Separate Validation**: Uses `composePromotionValidationCriteria()` instead of amount validation

## Testing Checklist

- [ ] Connection to server established
- [ ] Signin with valid credentials
- [ ] Join game successfully
- [ ] Place regular bet with valid payload
- [ ] Place promotion bet (if applicable)
- [ ] Retrieve betting history
- [ ] Get provably fair data (if enabled)
- [ ] Get bet details with proper parameters
- [ ] Handle disconnection gracefully
- [ ] Test with invalid/missing authentication
- [ ] Test rate limiting and error scenarios
- [ ] Test promotion validation (expired, no bonus items, etc.)

## Troubleshooting

1. **Connection Issues**: Check server URL, port, and CORS settings
2. **Authentication Failures**: Verify signin payload format and required fields
3. **Permission Denied**: Ensure user is properly authenticated before other operations
4. **No Response**: Check if game name in listener matches server's `definition.name`
5. **Validation Errors**: Review payload structures against server expectations

## Notes

- Replace `'yourGameName'` with the actual game name from `this.definition.name`
- Adjust payload structures based on your specific game requirements
- The server expects specific session data after signin for authorization
- Most operations require successful signin and verification
- Server will automatically disconnect unauthorized clients
