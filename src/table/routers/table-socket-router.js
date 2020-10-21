import { BaseSocketRouter } from "./../../core/routers";
import { InGameConsumer, OutGameConsumer, UserSignInConsumer } from "./../event-consumers";

export default class TableSocketRouter extends BaseSocketRouter {
    constructor({
        definition,
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
            definition,
            gameData,
            userSignInConsumer: userSignInConsumer ?? new UserSignInConsumer(definition, gameData),
            userDisconnectConsumer: userDisconnectConsumer ?? new OutGameConsumer(definition, gameData),
            inGameConsumer: inGameConsumer ?? new InGameConsumer({ definition, gameData, roundQuery }),
            placeBetConsumer,
            userSignInPublisher,
            historyQuery,
            roundQuery,
        });
    }
}
