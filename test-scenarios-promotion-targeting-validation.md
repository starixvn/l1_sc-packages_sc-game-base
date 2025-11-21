# Test Scenarios: Promotion Targeting Validation Logic

## Issue Overview
**File:** `src/core/event-consumers/user-signin-consumer.js`
**Methods:** `isPromotionAvailableForPlayer()` and `isPromotionTargetingValid()`
**Risk Level:** HIGH

### The Problem
The validation logic uses `some()` independently for each criteria (site, player, currency) across ALL promotions. This causes false positives where criteria from different promotions are mixed together.

---

## Test Scenario 1: Mixed Criteria Across Promotions (FALSE POSITIVE)

### Setup
**User Session:**
```json
{
  "siteName": "SiteA",
  "playerId": "player123",
  "currencyGroupId": "USD",
  "operatorId": "OP1",
  "gameId": "game-001"
}
```

**Promotions in gameData.promotions:**
```json
[
  {
    "promotionId": "PROMO-1",
    "operatorId": "OP1",
    "gameIds": ["game-001"],
    "startDate": "2025-01-01T00:00:00Z",
    "claimExpirationDate": "2025-12-31T23:59:59Z",
    "offeredSiteNames": ["SiteA"],
    "offeredPlayerIds": ["player999"],
    "currencyGroups": ["EUR"]
  },
  {
    "promotionId": "PROMO-2",
    "operatorId": "OP1",
    "gameIds": ["game-001"],
    "startDate": "2025-01-01T00:00:00Z",
    "claimExpirationDate": "2025-12-31T23:59:59Z",
    "offeredSiteNames": ["SiteB"],
    "offeredPlayerIds": ["player123"],
    "currencyGroups": ["GBP"]
  },
  {
    "promotionId": "PROMO-3",
    "operatorId": "OP1",
    "gameIds": ["game-001"],
    "startDate": "2025-01-01T00:00:00Z",
    "claimExpirationDate": "2025-12-31T23:59:59Z",
    "offeredSiteNames": ["SiteC"],
    "offeredPlayerIds": ["player456"],
    "currencyGroups": ["USD"]
  }
]
```

### Expected Behavior (CORRECT)
- **Result:** `isPromotionAvailableForPlayer()` should return `FALSE`
- **Reason:** No single promotion matches ALL criteria for the user

### Actual Behavior (BUG)
- **Result:** `isPromotionAvailableForPlayer()` returns `TRUE`
- **Reason:**
  - `isTargetingSite = true` (PROMO-1 has SiteA)
  - `isTargetingPlayer = true` (PROMO-2 has player123)
  - `isTargetingCurrencyGroup = true` (PROMO-3 has USD)
  - All three return true even though they're from DIFFERENT promotions

### Test Steps
1. Configure game with the 3 promotions above
2. User signs in with credentials: SiteA, player123, USD
3. Observe `isPromotionAvailableForPlayer()` result
4. **EXPECTED:** User should NOT see promotion available
5. **ACTUAL:** User incorrectly sees promotion as available

### Pass Criteria
- ❌ **FAILS** if user can proceed to claim promotion
- ✅ **PASSES** if no promotion is shown as available

---

## Test Scenario 2: Empty Arrays Should Match All (EDGE CASE)

### Setup
**User Session:**
```json
{
  "siteName": "SiteX",
  "playerId": "player555",
  "currencyGroupId": "JPY",
  "operatorId": "OP1",
  "gameId": "game-001"
}
```

**Promotions:**
```json
[
  {
    "promotionId": "PROMO-UNIVERSAL",
    "operatorId": "OP1",
    "gameIds": ["game-001"],
    "startDate": "2025-01-01T00:00:00Z",
    "claimExpirationDate": "2025-12-31T23:59:59Z",
    "offeredSiteNames": [],
    "offeredPlayerIds": [],
    "currencyGroups": []
  }
]
```

### Expected Behavior
- **Result:** `isPromotionAvailableForPlayer()` should return `TRUE`
- **Reason:** Empty arrays mean "available to all" - this should work correctly

### Test Steps
1. Configure promotion with empty targeting arrays
2. Sign in with any user
3. Verify promotion is available

### Pass Criteria
- ✅ **PASSES** if promotion is available for all users
- ❌ **FAILS** if promotion is not detected

---

## Test Scenario 3: Partial Empty Arrays with Mismatch (FALSE POSITIVE)

### Setup
**User Session:**
```json
{
  "siteName": "SiteA",
  "playerId": "player123",
  "currencyGroupId": "USD",
  "operatorId": "OP1",
  "gameId": "game-001"
}
```

**Promotions:**
```json
[
  {
    "promotionId": "PROMO-A",
    "operatorId": "OP1",
    "gameIds": ["game-001"],
    "startDate": "2025-01-01T00:00:00Z",
    "claimExpirationDate": "2025-12-31T23:59:59Z",
    "offeredSiteNames": [],
    "offeredPlayerIds": ["player999"],
    "currencyGroups": []
  },
  {
    "promotionId": "PROMO-B",
    "operatorId": "OP1",
    "gameIds": ["game-001"],
    "startDate": "2025-01-01T00:00:00Z",
    "claimExpirationDate": "2025-12-31T23:59:59Z",
    "offeredSiteNames": [],
    "offeredPlayerIds": [],
    "currencyGroups": ["EUR"]
  }
]
```

### Expected Behavior
- **Result:** Should return `FALSE`
- **Reason:**
  - PROMO-A: Player doesn't match (player999 vs player123)
  - PROMO-B: Currency doesn't match (EUR vs USD)

### Actual Behavior (BUG)
- **Result:** Returns `TRUE`
- **Reason:**
  - `isTargetingSite = true` (both have empty site arrays → match all)
  - `isTargetingPlayer = true` (PROMO-B has empty player array → matches all)
  - `isTargetingCurrencyGroup = true` (PROMO-A has empty currency → matches all)

### Test Steps
1. Configure promotions as above
2. Sign in as player123 with USD currency
3. Check if promotion is available

### Pass Criteria
- ❌ **FAILS** if promotion shows as available
- ✅ **PASSES** if no promotion is available

---

## Test Scenario 4: Time Validation with Wrong Targeting (FALSE POSITIVE)

### Setup
**Current Date:** 2025-06-15

**User Session:**
```json
{
  "siteName": "SiteA",
  "playerId": "player123",
  "currencyGroupId": "USD",
  "operatorId": "OP1",
  "gameId": "game-001"
}
```

**Promotions:**
```json
[
  {
    "promotionId": "PROMO-EXPIRED",
    "operatorId": "OP1",
    "gameIds": ["game-001"],
    "startDate": "2025-01-01T00:00:00Z",
    "claimExpirationDate": "2025-03-31T23:59:59Z",
    "offeredSiteNames": ["SiteA"],
    "offeredPlayerIds": ["player123"],
    "currencyGroups": ["USD"]
  },
  {
    "promotionId": "PROMO-ACTIVE",
    "operatorId": "OP1",
    "gameIds": ["game-001"],
    "startDate": "2025-05-01T00:00:00Z",
    "claimExpirationDate": "2025-12-31T23:59:59Z",
    "offeredSiteNames": ["SiteB"],
    "offeredPlayerIds": ["player999"],
    "currencyGroups": ["EUR"]
  }
]
```

### Expected Behavior
- **Result:** Should return `FALSE`
- **Reason:**
  - PROMO-EXPIRED: Targeting matches but time expired
  - PROMO-ACTIVE: Time valid but targeting doesn't match

### Actual Behavior (BUG)
- **Result:** Returns `TRUE`
- **Reason:**
  - `isTimeValid = true` (PROMO-ACTIVE is time-valid)
  - `isTargetingValid = true` (criteria mixed from both promotions)
  - `isGameAndOperatorValid = true` (both match)

### Test Steps
1. Set system date to 2025-06-15
2. Configure promotions as above
3. Sign in as player123 from SiteA with USD
4. Verify promotion availability

### Pass Criteria
- ❌ **FAILS** if promotion shows as available
- ✅ **PASSES** if no promotion is available

---

## Test Scenario 5: Case Sensitivity Issue

### Setup
**User Session:**
```json
{
  "siteName": "SiteA",
  "playerId": "Player123",
  "currencyGroupId": "usd",
  "operatorId": "OP1",
  "gameId": "game-001"
}
```

**Promotions:**
```json
[
  {
    "promotionId": "PROMO-CASE",
    "operatorId": "OP1",
    "gameIds": ["game-001"],
    "startDate": "2025-01-01T00:00:00Z",
    "claimExpirationDate": "2025-12-31T23:59:59Z",
    "offeredSiteNames": ["sitea"],
    "offeredPlayerIds": ["player123"],
    "currencyGroups": ["USD"]
  }
]
```

### Expected Behavior
- **Result:** Should return `TRUE`
- **Reason:** The code uses `.toLowerCase()` for comparison, should match case-insensitively

### Test Steps
1. Configure promotion with mixed case values
2. Sign in with mixed case user data
3. Verify case-insensitive matching works

### Pass Criteria
- ✅ **PASSES** if promotion is available (case-insensitive match works)
- ❌ **FAILS** if case sensitivity blocks matching

---

## Test Scenario 6: Single Valid Promotion (BASELINE)

### Setup
**User Session:**
```json
{
  "siteName": "SiteA",
  "playerId": "player123",
  "currencyGroupId": "USD",
  "operatorId": "OP1",
  "gameId": "game-001"
}
```

**Promotions:**
```json
[
  {
    "promotionId": "PROMO-VALID",
    "operatorId": "OP1",
    "gameIds": ["game-001"],
    "startDate": "2025-01-01T00:00:00Z",
    "claimExpirationDate": "2025-12-31T23:59:59Z",
    "offeredSiteNames": ["SiteA"],
    "offeredPlayerIds": ["player123"],
    "currencyGroups": ["USD"]
  }
]
```

### Expected Behavior
- **Result:** Should return `TRUE`
- **Reason:** All criteria match for single promotion

### Test Steps
1. Configure single matching promotion
2. Sign in with matching credentials
3. Verify promotion is available

### Pass Criteria
- ✅ **PASSES** if promotion is available
- ❌ **FAILS** if promotion is not detected

---

## Test Scenario 7: Multiple Valid Promotions (Should Return Any)

### Setup
**User Session:**
```json
{
  "siteName": "SiteA",
  "playerId": "player123",
  "currencyGroupId": "USD",
  "operatorId": "OP1",
  "gameId": "game-001"
}
```

**Promotions:**
```json
[
  {
    "promotionId": "PROMO-1",
    "operatorId": "OP1",
    "gameIds": ["game-001"],
    "startDate": "2025-01-01T00:00:00Z",
    "claimExpirationDate": "2025-12-31T23:59:59Z",
    "offeredSiteNames": ["SiteA"],
    "offeredPlayerIds": ["player123"],
    "currencyGroups": ["USD"]
  },
  {
    "promotionId": "PROMO-2",
    "operatorId": "OP1",
    "gameIds": ["game-001"],
    "startDate": "2025-01-01T00:00:00Z",
    "claimExpirationDate": "2025-12-31T23:59:59Z",
    "offeredSiteNames": ["SiteA"],
    "offeredPlayerIds": ["player123"],
    "currencyGroups": ["USD"]
  }
]
```

### Expected Behavior
- **Result:** Should return `TRUE`
- **Reason:** Both promotions match all criteria - should be eligible

### Test Steps
1. Configure multiple matching promotions
2. Sign in with matching credentials
3. Verify at least one promotion is available

### Pass Criteria
- ✅ **PASSES** if promotion is available
- ❌ **FAILS** if no promotion is detected

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Backup current promotion configuration
- [ ] Set up test environment with controlled date/time
- [ ] Enable detailed logging for promotion validation
- [ ] Prepare test user accounts with known credentials

### During Testing
- [ ] Document actual results for each scenario
- [ ] Capture logs showing validation logic execution
- [ ] Screenshot any UI showing promotion availability
- [ ] Note any error messages or warnings

### Test Matrix

| Scenario | Expected | Current Bug | Priority |
|----------|----------|-------------|----------|
| 1. Mixed Criteria | FALSE | TRUE | **CRITICAL** |
| 2. Empty Arrays | TRUE | TRUE | PASS |
| 3. Partial Empty | FALSE | TRUE | **HIGH** |
| 4. Time + Targeting | FALSE | TRUE | **HIGH** |
| 5. Case Sensitivity | TRUE | TRUE | PASS |
| 6. Single Valid | TRUE | TRUE | PASS |
| 7. Multiple Valid | TRUE | TRUE | PASS |

### Success Criteria
- **All scenarios must pass** for validation logic to be considered fixed
- **Scenarios 1, 3, 4** are critical bugs that cause false positives
- **Scenario 6, 7** are baseline tests ensuring basic functionality

---

## Recommended Fix (For Development Reference)

The issue can be resolved by validating all criteria against each individual promotion:

```javascript
isPromotionTargetingValid(siteName, playerId, currencyGroupId) {
    return this.gameData.promotions.some((promotion) => {
        const siteMatch = promotion.offeredSiteNames.length === 0 ||
                         promotion.offeredSiteNames.map(s => s.toLowerCase()).includes(siteName.toLowerCase());

        const playerMatch = promotion.offeredPlayerIds.length === 0 ||
                           promotion.offeredPlayerIds.map(p => p.toLowerCase()).includes(playerId.toLowerCase());

        const currencyMatch = promotion.currencyGroups.length === 0 ||
                             promotion.currencyGroups.map(c => c.toLowerCase()).includes(currencyGroupId.toLowerCase());

        return siteMatch && playerMatch && currencyMatch;
    });
}
```

---

## QC Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| QC Tester | | | |
| QC Lead | | | |
| Developer | | | |
| Product Owner | | | |

**Notes:**
