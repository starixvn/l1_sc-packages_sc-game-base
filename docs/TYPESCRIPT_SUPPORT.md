# TypeScript Support for SC Game Base

This library now includes comprehensive TypeScript support with automatically generated type definitions.

## Features

- ✅ Full TypeScript type definitions for all exported classes and modules
- ✅ Auto-generated `.d.ts` files from JavaScript source code
- ✅ Support for Core, Table, and Constants modules
- ✅ Type-safe usage in TypeScript projects
- ✅ IntelliSense and autocomplete support in IDEs

## Usage

### Installation

```bash
npm install sc-game-base
```

### TypeScript Usage

```typescript
import { Core, Table, Constants } from "sc-game-base";

// Core module usage
const gameData = new Core.GameData(30);
const baseMetrics = new Core.BaseMetrics({ hostingPort: 5000 });
const gameApp = new Core.BaseGameApp("my-service", { hostingPort: 5000 }, baseMetrics);

// Table module usage
const tableGameData = new Table.TableGameData(60);
const tableContainerRegistry = new Table.TableContainerRegistry();

// Constants usage
const systemType = Constants.Systems.Cocos;
```

### Available Modules

#### Core Module

- `BaseGameApp` - Main application class
- `BaseStartup` - Application startup logic
- `BaseMetrics` - Metrics collection
- `ContainerRegistry` - Dependency injection container
- `GameData` - Game state management
- `GameDefinition` - Game configuration
- Event consumers, publishers, interceptors
- Helpers, models, validators, routers, crons

#### Table Module

- `TableGameData` - Table-specific game data
- `TableGameDefinition` - Table game configuration
- `TableContainerRegistry` - Table dependency injection
- Table-specific event consumers and publishers
- Table-specific crons and routers

#### Constants Module

- `Systems` - System type constants (Cocos, Mobi, Mini)

## Development

### Building Type Definitions

```bash
npm run build-types
```

This command generates `.d.ts` files in the `dist/` directory from the JavaScript source code.

### Scripts Available

- `npm run build-types` - Generate TypeScript definitions
- `npm run build` - Full build (includes type generation)
- `npm test` - Run tests
- `npm run test-coverage` - Run tests with coverage

## Type Definitions Location

The main type definitions are located at `./dist/index.d.ts` and are automatically included when you install the package.

## IDE Support

Modern IDEs like VS Code, WebStorm, and others will automatically pick up the type definitions and provide:

- IntelliSense/autocomplete
- Type checking
- Parameter hints
- Error detection

## Notes

- Type definitions are automatically generated from the JavaScript source
- The library maintains backward compatibility with JavaScript projects
- All classes, methods, and properties are typed for better development experience
