import { logger } from "sc-common";

import { UserRecheckinConsumer } from "./../../core/event-consumers";
import BaseSocketRouter from "./../../core/routers/socket-router";
import { InGameConsumer, OutGameConsumer, TablePlaceBetConsumer, UserSignInConsumer } from "./../event-consumers";
import { RoundQuery } from "../../core";

export default class TableSocketRouter extends BaseSocketRouter {
    /**
     * @param {InGameConsumer} inGameConsumer
     * @param {TablePlaceBetConsumer} placeBetConsumer
     * @param {UserRecheckinConsumer} reCheckinConsumer
     * @param {RoundQuery} roundQuery
     * @param {UserSignInConsumer} userSignInConsumer
     * @param {OutGameConsumer} userDisconnectConsumer
     */
    constructor(
        definition,
        gameData,
        userSignInConsumer = null,
        userDisconnectConsumer = null,
        inGameConsumer = null,
        reCheckinConsumer = null,
        placeBetConsumer = null,
        roundQuery = null,
    ) {
        super(
            definition,
            gameData,
            userSignInConsumer ?? new UserSignInConsumer(definition, gameData),
            userDisconnectConsumer ?? new OutGameConsumer(definition, gameData),
            reCheckinConsumer ?? new UserRecheckinConsumer(gameData),
            placeBetConsumer ?? new TablePlaceBetConsumer(definition, gameData),
            roundQuery ?? new RoundQuery(definition)
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

    async handleInGame() {
        try {
            this.inGameConsumer.inGame(this.socketClient);
        } catch (error) {
            logger.logError(error);
        }
    }
}
