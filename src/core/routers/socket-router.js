import { logger } from "sc-common";
import { HistoryQuery } from "../query-apis";
import { UserDisconnectConsumer, UserRecheckinConsumer, UserSignInConsumer, PlaceBetConsumer } from "./../event-consumers";
import GameDefinition from "./../game-definition";

export default class BaseSocketRouter {
    /**
     * @param {GameDefinition} definition
     * @param {UserSignInConsumer} userSignInConsumer
     * @param {UserDisconnectConsumer} userDisconnectConsumer
     * @param {UserRecheckinConsumer} userRecheckinConsumer
     * @param {PlaceBetConsumer} placeBetConsumer
     */
    constructor(definition, gameData, userSignInConsumer, userDisconnectConsumer = null, userRecheckinConsumer = null, placeBetConsumer) {
        this.definition = definition;
        this.gameData = gameData;
        this.userSignInConsumer = userSignInConsumer ?? new UserSignInConsumer();
        this.userDisconnectConsumer = userDisconnectConsumer ?? new UserDisconnectConsumer();
        this.placeBetConsumer = placeBetConsumer ?? new PlaceBetConsumer(definition, gameData);
        this.userRecheckinConsumer = userRecheckinConsumer ?? new UserRecheckinConsumer();
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
        this.socketClient.on("recheckin", this.handleRecheckin.bind(this));
    }

    async handlePlaceBet(payload) {
        await this.placeBetConsumer
            .placeBet(this.gameData.realPlayers[this.socketClient.id], payload, this.gameData)
            .catch(logger.logError);
    }

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

    async handleRecheckin(payload) {
        try {
            await this.userRecheckinConsumer.consume(this.socketClient, this.gameData, payload);
        } catch (err) {
            logger.logError(err);
        }
    }
}
