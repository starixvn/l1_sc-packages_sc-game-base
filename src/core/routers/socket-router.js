import { logger } from "sc-common";
import { BaseUserDisconnectConsumer, BaseUserSignInConsumer } from "./../event-consumers";

export default class BaseSocketRouter {
    /**
     * @param {BaseUserSignInConsumer} userSignInConsumer
     *  @param {BaseUserDisconnectConsumer} userDisconnectConsumer
     */
    constructor(userSignInConsumer, userDisconnectConsumer) {
        this.userSignInConsumer = userSignInConsumer ?? new BaseUserSignInConsumer();
        this.userDisconnectConsumer = userDisconnectConsumer ?? new BaseUserDisconnectConsumer();
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    init(storage, socketClient) {
        this.storage = storage;
        this.socketClient = socketClient;
        this.socketClient.on("bet", this.handlePlaceBet.bind(this));
        this.socketClient.on("signin", this.handleSignIn.bind(this));
        this.socketClient.on("getTime", this.handleGetTime.bind(this));
        this.socketClient.on("getLogs", this.handleGetLogs.bind(this));
        this.socketClient.on("getHistory", this.handleGetHistory.bind(this));
        this.socketClient.on("inGame", this.handleInGame.bind(this));
        this.socketClient.on("disconnect", this.handleDisconnect.bind(this));
    }

    async handlePlaceBet(payload) {}

    async handleSignIn(payload) {
        try {
            await this.userSignInConsumer.consume(this.socketClient, this.storage, payload); // push to message queue later
        } catch (err) {
            logger.logError(err);
        }
    }

    async handleGetTime(payload) {}

    async handleGetLogs(payload) {}

    async handleGetHistory(payload) {}

    async handleInGame() {}

    async handleDisconnect() {
        try {
            this.userDisconnectConsumer.consume(this.socketClient, this.storage);
            this.socketClient.disconnect();
        } catch (err) {
            logger.logError(err);
        }
    }
}
