import { BaseSocketRouter } from "./../../core/routers";
import { InGameConsumer, OutGameConsumer, UserSignInConsumer } from "./../event-consumers";

export default class TableSocketRouter extends BaseSocketRouter {
    constructor({
        gameDefinition,
        gameData,
        userSignInConsumer,
        userDisconnectConsumer,
        inGameConsumer,
        placeBetConsumer,
        userSignInPublisher,
        historyQuery,
        roundQuery,
    }) {
        super({
            gameDefinition,
            gameData,
            userSignInConsumer: userSignInConsumer ?? new UserSignInConsumer(gameDefinition, gameData),
            userDisconnectConsumer: userDisconnectConsumer ?? new OutGameConsumer(gameDefinition, gameData),
            inGameConsumer: inGameConsumer ?? new InGameConsumer(gameDefinition, gameData, roundQuery),
            placeBetConsumer,
            userSignInPublisher,
            historyQuery,
            roundQuery,
        });
    }
}
