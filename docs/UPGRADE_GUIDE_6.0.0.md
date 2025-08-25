# SC-Game-Base 6.0.0 Upgrade Guide

**Package Version:** `sc-game-base@6.0.0`  
**Release Date:** 2025  
**Migration Difficulty:** Medium  
**Estimated Time:** 60-90 minutes

This document outlines the breaking changes introduced in `sc-game-base v6.0.0` and provides step-by-step migration instructions.

## 🚨 Breaking Changes Overview

### 1. Node.js Upgrade (v18 → v20)

### 2. Mongoose Connection String Updates

### 3. Sentry Tracing Upgrade

### 4. OpenID Client Authentication Changes

### 5. New Event Interceptor System

### 6. Container Registry Architecture Changes

### 7. API Changes

---

## ⚡ Backwards Compatibility

**Important**: Existing services without promotion API configuration will continue to work normally. The promotion features are **completely optional** and do not affect core betting functionality.

### What Still Works Without Changes:

- ✅ Regular bet processing
- ✅ User sign-in flows
- ✅ All existing game mechanics
- ✅ Payment processing
- ✅ Event publishing/consuming
- ✅ Current interceptor patterns

### What Requires Migration:

- 🔧 Node.js version upgrade to v20
- 🔧 MongoDB connection string updates
- 🔧 Sentry configuration updates
- 🔧 Services that want to **add** promotion features (optional)

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

## 5. Event Interceptor System

### What Changed

- **New**: Event interceptor system with `ProcessBetQueue` integration
- **New**: Mixin-based architecture for interceptor functionality
- **Automatic**: Container registry setup for interceptor arrays

### Migration Steps

**No manual migration required** - the system is backward compatible. However, to take advantage of new features:

1. **Update Dependencies**:

   ```bash
   npm install sc-game-base@^6.0.0
   ```

2. **Event Interceptors** (optional - for advanced customization):

   ```javascript
   // Create custom interceptors if needed
   import { BaseEventInterceptor } from "sc-game-base/core/event-interceptors";

   export default class YourCustomInterceptor extends BaseEventInterceptor {
     constructor(dependencies) {
       super(dependencies);
     }

     shouldIntercept(context) {
       // Your custom logic
       return true;
     }

     async beforeEvent(context) {
       // Your pre-processing logic
       return { success: true };
     }
   }
   ```

---

## 6. Container Registry Changes

### What Changed

- **Automatic**: Interceptor registrations - no manual setup required
- **Automatic**: Event interceptor array creation
- **Simplified**: Base `ContainerRegistry` handles most configuration

### Migration Steps

**Minimal Setup** (no custom interceptors):

```javascript
// src/container-registry.js
import { ContainerRegistry } from "sc-game-base/core";

export default class YourGameContainerRegistry extends ContainerRegistry {
  // Base registration handles everything automatically
  register(appConfigs, definition, gameData) {
    return super.register(appConfigs, definition, gameData);
  }
}
```

**Advanced Setup** (with custom interceptors):

```javascript
// src/container-registry.js
import { ContainerRegistry } from "sc-game-base/core";
import YourCustomInterceptor from "./event-interceptors/your-custom-interceptor.js";

export default class YourGameContainerRegistry extends ContainerRegistry {
  register(appConfigs, definition, gameData) {
    const container = super.register(appConfigs, definition, gameData);

    // Only add this if you have custom interceptors
    this.registerCustomInterceptors();

    return container;
  }

  // OPTIONAL: Only needed for custom interceptors
  registerCustomInterceptors() {
    this.container.register({
      yourCustomInterceptor: asClass(YourCustomInterceptor).singleton(),
    });
  }

  // OPTIONAL: Override interceptor arrays to add custom interceptors
  registerInterceptorArrays() {
    this.container.register({
      betEventInterceptors: asFunction(({ yourCustomInterceptor }) => {
        const interceptors = [];

        // Add your custom interceptors
        if (yourCustomInterceptor) {
          interceptors.push(yourCustomInterceptor);
        }

        return interceptors;
      }).singleton(),
    });
  }
}
```

---

## 7. API Changes

### What Changed

- **New**: `ProcessBetQueue` constructor automatically receives `betEventInterceptors` parameter
- **Enhanced**: Consumer methods for event handling
- **Improved**: Error handling patterns

### Migration Steps

**No changes required** for basic usage. The system is backward compatible.

For advanced usage:

```javascript
// ProcessBetQueue automatically includes interceptors
const processBetQueue = new ProcessBetQueue({
  // ... existing dependencies
  betEventInterceptors, // Automatically injected
});
```

---

## 🧪 Testing Strategy

### Update Test Files

1. **Update Dependencies in Tests**:

   ```javascript
   // package.json
   {
     "devDependencies": {
       "jest": "^29.0.0",
       "@types/jest": "^29.0.0"
     }
   }
   ```

2. **Update Test Scripts**:

   ```json
   {
     "scripts": {
       "test": "node --import=extensionless/register node_modules/.bin/jest",
       "test:watch": "node --import=extensionless/register node_modules/.bin/jest --watch"
     }
   }
   ```

3. **Basic Test Template**:

   ```javascript
   describe("Service Tests", () => {
     let service;

     beforeEach(() => {
       service = new YourService(/* dependencies */);
     });

     it("should work with new architecture", async () => {
       const result = await service.someMethod();
       expect(result).toBeDefined();
     });
   });
   ```

---

## 🚨 Common Migration Issues

### Issue 1: Node.js Module Resolution Errors

**Problem**: Getting module resolution errors after Node.js 20 upgrade

**Solution**: Ensure you're using the `--import=extensionless/register` flag:

```bash
# ❌ WRONG
node index.js

# ✅ CORRECT
node --import=extensionless/register index.js
```

### Issue 2: MongoDB Connection Failures

**Problem**: Database connection fails with `auto_reconnect` error

**Solution**: Remove `auto_reconnect` from connection strings:

```javascript
// ❌ WRONG
"mongodb://localhost:27017/db?auto_reconnect=true";

// ✅ CORRECT
"mongodb://localhost:27017/db";
```

### Issue 3: Container Resolution Errors

**Problem**: Getting Awilix resolution errors

**Solution**: Ensure you're extending from the base `ContainerRegistry` class:

```javascript
// ✅ CORRECT
export default class YourGameContainerRegistry extends ContainerRegistry {
  register(appConfigs, definition, gameData) {
    return super.register(appConfigs, definition, gameData);
  }
}
```

### Issue 4: Sentry Initialization Errors

**Problem**: Sentry performance monitoring not working

**Solution**: Update Sentry configuration with proper integrations:

```javascript
Sentry.init({
  dsn: "YOUR_DSN",
  tracesSampleRate: 1.0,
  integrations: [new Sentry.Integrations.Http({ tracing: true }), new Sentry.Integrations.Express({ app })],
});
```

### Issue 5: Authentication Failures

**Problem**: Getting 401 errors after OpenID upgrade

**Solution**: The fix is automatic, but verify your authentication flow:

```javascript
// This should work automatically
const token = bearerAuthenticator.formatToken(); // "Bearer <token>"
```

---

## 📊 Performance Considerations

### 1. **Node.js 20 Performance Improvements**

- Better memory management
- Improved module resolution
- Enhanced ES module support

### 2. **Interceptor System Performance**

- Interceptors only execute when needed
- Minimal overhead for basic operations
- Efficient dependency injection

### 3. **Database Performance**

- Improved MongoDB connection handling
- Better reconnection logic
- Optimized query performance

---

## 📋 Pre-Migration Checklist

- [ ] **Backup existing codebase**
- [ ] **Verify Node.js 20 compatibility**
- [ ] **Check MongoDB connection strings**
- [ ] **Review Sentry configuration**
- [ ] **Plan testing strategy**
- [ ] **Update CI/CD pipelines**
- [ ] **Review authentication flows**

---

## 📝 Post-Migration Checklist

- [ ] **Node.js version 20+ installed**
- [ ] **Run scripts include `--import=extensionless/register`**
- [ ] **MongoDB connection strings removed `auto_reconnect`**
- [ ] **Sentry tracing configured and working**
- [ ] **Authentication working with OAuth providers**
- [ ] **All tests passing**
- [ ] **Application starts without errors**
- [ ] **Performance metrics within acceptable ranges**
- [ ] **Error handling tested**
- [ ] **Monitoring and alerting configured**
- [ ] **Documentation updated**
- [ ] **Team trained on new features**

---

## Promotion System Integration

For services that want to add promotion features, see the dedicated [Promotion Integration Guide](./PROMOTION_INTEGRATION_GUIDE.md).

The promotion system is completely optional and includes:

- Promotion bet handling
- Event interceptor patterns
- API client integration
- Custom promotion logic

---

## 📚 Additional Resources

- [Promotion Integration Guide](./PROMOTION_INTEGRATION_GUIDE.md)
- [Event Interceptor Documentation](../diagrams/event-interceptor-system.md)
- [SC-Game-Base Architecture Guide](../README.md)
- [Testing Patterns for Game Services](../README.md#testing)

---

## 🆘 Support

If you encounter issues during migration:

1. **Check Logs**: Review application logs for specific error messages
2. **Verify Configuration**: Ensure all required configs are set
3. **Test in Isolation**: Test each change separately
4. **Review Examples**: Check example implementations in test files
5. **Contact Team**: Reach out to the sc-game-base team for assistance

---

## Version Compatibility

| Component     | Previous Version | New Version | Breaking Change                      |
| ------------- | ---------------- | ----------- | ------------------------------------ |
| Node.js       | 18.x             | 20.x+       | Yes - requires extensionless flag    |
| Mongoose      | < 6.13.8         | 6.13.8+     | Yes - auto_reconnect removed         |
| Sentry SDK    | Previous         | Latest      | Partial - new features available     |
| openid-client | Previous         | 6.6.4       | No - backward compatible fix applied |

---

**Version**: 6.0.0  
**Last Updated**: 2025  
**Compatibility**: Node.js 20+, MongoDB 4.4+, Mongoose 6.13.8+
