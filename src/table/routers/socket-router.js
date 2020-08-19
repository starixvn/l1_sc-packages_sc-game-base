import { logger } from "sc-common";

import BaseSocketRouter from "./../../core/routers/socket-router";
import { OutGameConsumer, UserSignInConsumer } from "./../event-consumers";
import InGameConsumer from "./../event-consumers/in-game-consumer";

export default class TableSocketRouter extends BaseSocketRouter {
    /**
     * @param {InGameConsumer} inGameConsumer
     */
    constructor(definition, gameData, userSignInConsumer = null, userDisconnectConsumer = null, inGameConsumer = null) {
        super(
            definition,
            gameData,
            userSignInConsumer ?? new UserSignInConsumer(definition),
            userDisconnectConsumer ?? new OutGameConsumer(definition, gameData)
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
        } catch (err) {
            logger.logError(err);
        }
    }
}
