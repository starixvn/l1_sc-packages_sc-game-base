# Game Base

Support base implementations for SC game services. You can overide the base classes if needed for your detail business

- **app / startup** : Inititialize app service, register middlewares in startup like Database, Logger, ...
- **socket/http router** : Handle and forward socket/http requests to specific comsumers
- **query-apis** : Process the query request from router like get history, get logs
- **event-consumers** : Process the requests which need to update database like place bet, ...
- **event-publishers** : Work with socket, publish the repsonse data fronm event consumers to client via socket

## Installation

```sh
npm set registry http://npm.lumigame.com
npm install sc-game-base --save-dev
```

## Architecture

![](https://i.ibb.co/r5y42hZ/Game-Server-Flow-Chart-Page-1.png)
