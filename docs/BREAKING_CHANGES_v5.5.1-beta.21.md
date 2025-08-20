# Breaking Changes Migration Guide - v5.5.1-beta.21

**Package Version:** `sc-game-base@5.5.1-beta.21`  
**Release Date:** August 2025  
**Migration Difficulty:** Medium  
**Estimated Time:** 30-60 minutes

This document outlines the breaking changes introduced in `sc-game-base v5.5.1-beta.21` and provides step-by-step migration instructions.

## 🚨 Breaking Changes Overview

### 1. Node.js Upgrade (v18 → v20)

### 2. Mongoose Connection String Updates

### 3. Sentry Tracing Upgrade

### 4. OpenID Client Authentication Changes

---

## 1. Node.js Upgrade: v18 → v20

### What Changed

- **Required**: Node.js version 20 or higher
- **Required**: Use `--import=extensionless/register` in run scripts

### Why This Change is Needed

#### Extensionless Import Requirement

Node.js 20 introduced stricter ES module resolution. The `extensionless/register` flag enables:

- **Backward Compatibility**: Allows importing modules without file extensions (`.js`, `.mjs`)
- **Legacy Code Support**: Maintains compatibility with existing import statements like:
  ```javascript
  import helpers from "./helpers"; // instead of './helpers.js'
  ```
- **Build Tool Integration**: Required for proper module resolution with our current build setup

### Migration Steps

1. **Update Node.js Version**:

   ```bash
   # Check current version
   node --version

   # Install Node.js 20+
   # Using nvm (recommended)
   nvm install 20
   nvm use 20
   ```

2. **Update package.json Scripts**:

   ```json
   {
     "scripts": {
       "start": "node --import=extensionless/register index.js",
       "dev": "node --import=extensionless/register --watch index.js",
       "test": "node --import=extensionless/register node_modules/.bin/jest"
     }
   }
   ```

3. **Update Dockerfile** (if applicable):
   ```dockerfile
   FROM node:20-alpine
   # ... rest of Dockerfile
   ```

---

## 2. Mongoose Connection String Updates

### What Changed

- **Removed**: `auto_reconnect` option from MongoDB connection strings
- **Version**: Mongoose upgraded to 6.13.8

### Why This Change is Needed

- `auto_reconnect` was deprecated and removed in newer MongoDB driver versions
- Mongoose 6.13.8+ handles reconnection automatically with improved logic
- The option now causes connection failures instead of being ignored

### Migration Steps

1. **Update Connection Strings**:

   **Before**:

   ```javascript
   const connectionString = "mongodb://localhost:27017/gamedb?auto_reconnect=true&retryWrites=true";
   ```

   **After**:

   ```javascript
   const connectionString = "mongodb://localhost:27017/gamedb?retryWrites=true";
   ```

2. **Environment Variables**:
   Remove `auto_reconnect=true` from your database connection strings in:

   - `.env` files
   - Configuration files
   - Docker compose files
   - Kubernetes manifests

3. **Connection Options** (alternative approach):
   ```javascript
   // If you need custom reconnection behavior
   mongoose.connect(connectionString, {
     serverSelectionTimeoutMS: 5000,
     socketTimeoutMS: 45000,
   });
   ```

---

## 3. Sentry Tracing Upgrade

### What Changed

- Updated to latest Sentry SDK with enhanced tracing capabilities
- New performance monitoring features
- Updated initialization patterns

### Migration Steps

1. **Update Sentry Configuration**:

   ```javascript
   // Before
   Sentry.init({
     dsn: "YOUR_DSN",
     environment: process.env.NODE_ENV,
   });

   // After
   Sentry.init({
     dsn: "YOUR_DSN",
     environment: process.env.NODE_ENV,
     tracesSampleRate: 1.0, // Adjust based on your needs
     integrations: [new Sentry.Integrations.Http({ tracing: true }), new Sentry.Integrations.Express({ app })],
   });
   ```

2. **Add Performance Monitoring**:

   ```javascript
   // Express middleware
   app.use(Sentry.Handlers.requestHandler());
   app.use(Sentry.Handlers.tracingHandler());

   // Your routes...

   app.use(Sentry.Handlers.errorHandler());
   ```

---

## 4. OpenID Client Authentication Changes

### What Changed

- Upgraded `openid-client` to version 6.6.4
- **Critical**: OAuth servers return `token_type: "bearer"` (lowercase)
- **Legacy APIs expect**: `Authorization: Bearer <token>` (capitalized)

### Why This Matters

Authentication failures (401 errors) occur when:

- OAuth server returns: `token_type: "bearer"`
- Legacy API expects: `Authorization: Bearer <token>`
- Case mismatch causes rejection

### Migration Steps

1. **Automatic Fix Applied**:
   The `BearerAuthenticator.formatToken()` method now automatically capitalizes token types:

   ```javascript
   formatToken() {
       if (!this.hasValidToken()) {
           logger.logWarning("No valid bearer token available");
           return "";
       }
       // Automatically capitalize first letter
       const tokenType = this.token.token_type.charAt(0).toUpperCase() + this.token.token_type.slice(1);
       return `${tokenType} ${this.token.access_token}`;
   }
   ```

2. **No Action Required**: This fix is backward compatible and handles both cases automatically.

3. **Testing Recommendation**:
   Verify authentication works with your OAuth provider after upgrade:
   ```bash
   # Test authentication endpoint
   curl -H "Authorization: Bearer <your-token>" https://your-api.com/test
   ```

### ⚠️ Legacy API Warning

If you encounter 401 authentication errors after upgrading:

1. Check if your API expects capitalized `Bearer` tokens
2. Verify the `formatToken()` method is being used correctly
3. Test with both lowercase and uppercase token types

---

## Verification Checklist

After completing the migration:

- [ ] Node.js version 20+ installed
- [ ] Run scripts include `--import=extensionless/register`
- [ ] MongoDB connection strings removed `auto_reconnect`
- [ ] Sentry tracing configured and working
- [ ] Authentication working with OAuth providers
- [ ] All tests passing
- [ ] Application starts without errors

## Support

If you encounter issues during migration:

1. **Check logs** for specific error messages
2. **Verify versions** match the requirements
3. **Test incrementally** - apply one change at a time
4. **Review this guide** for missed steps

## Version Compatibility

| Component     | Previous Version | New Version | Breaking Change                      |
| ------------- | ---------------- | ----------- | ------------------------------------ |
| Node.js       | 18.x             | 20.x+       | Yes - requires extensionless flag    |
| Mongoose      | < 6.13.8         | 6.13.8+     | Yes - auto_reconnect removed         |
| Sentry SDK    | Previous         | Latest      | Partial - new features available     |
| openid-client | Previous         | 6.6.4       | No - backward compatible fix applied |

## Related Files Modified

- `src/core/helpers/bearer-authenticator.js` - Token capitalization fix
- `src/core/helpers/__tests__/bearer-authenticator.test.js` - Updated tests
- `package.json` - Dependency versions updated

---

_Last updated: August 20, 2025_  
_Package version: sc-game-base@5.5.1-beta.21_  
_Migration difficulty: Medium_  
_Estimated time: 30-60 minutes_
