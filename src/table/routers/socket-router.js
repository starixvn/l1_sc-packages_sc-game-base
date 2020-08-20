import { logger } from "sc-common";
import BaseSocketRouter from "./../../core/routers/socket-router";
import { OutGameConsumer, UserSignInConsumer, TablePlaceBetConsumer, InGameConsumer } from "./../event-consumers";
import { UserRecheckinConsumer } from "./../../core/event-consumers";

export default class TableSocketRouter extends BaseSocketRouter {
    /**
     * @param {InGameConsumer} inGameConsumer
     * @param {TablePlaceBetConsumer} placeBetConsumer
     * @param {UserRecheckinConsumer} reCheckinConsumer
     */
    constructor(
        definition,
        gameData,
        userSignInConsumer = null,
        userDisconnectConsumer = null,
        inGameConsumer = null,
        reCheckinConsumer = null,
        placeBetConsumer = null
    ) {
        super(
            definition,
            gameData,
            userSignInConsumer ?? new UserSignInConsumer(definition),
            userDisconnectConsumer ?? new OutGameConsumer(definition, gameData),
            reCheckinConsumer ?? new UserRecheckinConsumer(),
            placeBetConsumer ?? new TablePlaceBetConsumer(definition, gameData)
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
