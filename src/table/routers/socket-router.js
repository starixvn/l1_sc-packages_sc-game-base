import { logger } from "sc-common";

import { BaseEventConsumers, BaseEventPublishers, QueryApis } from "./../../core";
import BaseSocketRouter from "./../../core/routers/socket-router";
import { InGameConsumer, OutGameConsumer, UserSignInConsumer } from "./../event-consumers";
import TableGameData from "./../table-game-data";
import TableGameDefinition from "./../table-game-definition";

export default class TableSocketRouter extends BaseSocketRouter {
    /**
     * @param {TableGameDefinition} definition
     * @param {TableGameData} gameData
     * @param {UserSignInConsumer} userSignInConsumer
     * @param {OutGameConsumer} userDisconnectConsumer
     * @param {InGameConsumer} inGameConsumer
     * @param {BaseEventConsumers.PlaceBetConsumer} placeBetConsumer
     * @param {BaseEventPublishers.UserSignInPublisher} userSignInPublisher
     * @param {QueryApis.HistoryQuery} historyQuery
     * @param {QueryApis.RoundQuery} roundQuery
     */
    constructor(
        definition,
        gameData,
        userSignInConsumer = null,
        userDisconnectConsumer = null,
        inGameConsumer = null,
        placeBetConsumer = null,
        userSignInPublisher = null,
        historyQuery = null,
        roundQuery = null
    ) {
        super(
            definition,
            gameData,
            userSignInConsumer ?? new UserSignInConsumer(definition, gameData),
            userDisconnectConsumer ?? new OutGameConsumer(definition, gameData),
            placeBetConsumer,
            userSignInPublisher,
            historyQuery,
            roundQuery
        );

        this.inGameConsumer = inGameConsumer ?? new InGameConsumer(definition, gameData);
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    init(socketClient) {
        super.init(socketClient);
        this.socketClient.on("inGame", this.handleInGame.bind(this));
    }

    handleInGame() {
        this.inGameConsumer.consume(this.socketClient).catch(logger.logError);
    }
}
