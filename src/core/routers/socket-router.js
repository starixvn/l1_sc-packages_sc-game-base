import { logger } from "sc-common";

import GameDefinition from "./../game-definition";
import { HistoryQuery } from "../query-apis";
import { BaseUserDisconnectConsumer, BaseUserSignInConsumer } from "./../event-consumers";

export default class BaseSocketRouter {
    /**
     * @param {GameDefinition} definition
     * @param {BaseUserSignInConsumer} userSignInConsumer
     * @param {BaseUserDisconnectConsumer} userDisconnectConsumer
     */
    constructor(definition, gameData, userSignInConsumer, userDisconnectConsumer) {
        this.definition = definition;
        this.gameData = gameData;
        this.userSignInConsumer = userSignInConsumer ?? new BaseUserSignInConsumer();
        this.userDisconnectConsumer = userDisconnectConsumer ?? new BaseUserDisconnectConsumer();
        this.historyQuery = new HistoryQuery(definition);
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    init(socketClient) {
        this.socketClient = socketClient;
        this.socketClient.on("bet", this.handlePlaceBet.bind(this));
        this.socketClient.on("signin", this.handleSignIn.bind(this));
        this.socketClient.on("getHistory", this.handleGetHistory.bind(this));
        this.socketClient.on("disconnect", this.handleDisconnect.bind(this));
    }

    async handlePlaceBet(payload) {}

    async handleSignIn(payload) {
        try {
            await this.userSignInConsumer.consume(this.socketClient, this.gameData, payload); // push to message queue later
        } catch (err) {
            logger.logError(err);
        }
    }

    async handleGetHistory(payload) {
        try {
            const history = this.historyQuery.queryHistory(this.gameData.realPlayers[this.socketClient.id], payload.page);
            this.socketClient.emit(this.definition.name, history);
        } catch (err) {
            logger.logError(err);
        }
    }

    async handleDisconnect() {
        try {
            this.userDisconnectConsumer.consume(this.socketClient, this.gameData);
            this.socketClient.disconnect();
        } catch (err) {
            logger.logError(err);
        }
    }
}
