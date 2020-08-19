import { logger } from "sc-common";
import { BaseUserDisconnectConsumer, BaseUserSignInConsumer } from "./../event-consumers";
import GameDefinition from "../game-definition.js";

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

    async handleGetHistory(payload) {}

    async handleDisconnect() {
        try {
            this.userDisconnectConsumer.consume(this.socketClient, this.gameData);
            this.socketClient.disconnect();
        } catch (err) {
            logger.logError(err);
        }
    }
}
