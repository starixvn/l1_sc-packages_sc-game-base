import { logger } from "sc-common";

import { HistoryQuery, RoundQuery } from "../query-apis";
import { PlaceBetConsumer, UserDisconnectConsumer, UserRecheckinConsumer, UserSignInConsumer } from "./../event-consumers";
import GameData from "./../game-data";
import GameDefinition from "./../game-definition";

export default class BaseSocketRouter {
    /**
     * @param {GameDefinition} definition
     * @param {GameData} gameData
     * @param {UserSignInConsumer} userSignInConsumer
     * @param {UserDisconnectConsumer} userDisconnectConsumer
     * @param {UserRecheckinConsumer} userRecheckinConsumer
     * @param {PlaceBetConsumer} placeBetConsumer
     * @param {RoundQuery} roundQuery
     */
    constructor(
        definition,
        gameData,
        userSignInConsumer,
        userDisconnectConsumer = null,
        userRecheckinConsumer = null,
        placeBetConsumer = null,
        roundQuery = null
    ) {
        this.definition = definition;
        this.gameData = gameData;
        this.userSignInConsumer = userSignInConsumer ?? new UserSignInConsumer(gameData);
        this.userDisconnectConsumer = userDisconnectConsumer ?? new UserDisconnectConsumer(gameData);
        this.placeBetConsumer = placeBetConsumer ?? new PlaceBetConsumer(definition, gameData);
        this.userRecheckinConsumer = userRecheckinConsumer ?? new UserRecheckinConsumer(gameData);
        this.historyQuery = new HistoryQuery(definition);
        this.roundQuery = roundQuery ?? new RoundQuery(definition);
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
        await this.placeBetConsumer.placeBet(this.gameData.realPlayers[this.socketClient.id], payload).catch(logger.logError);
    }

    async handleSignIn(payload) {
        await this.userSignInConsumer.consume(this.socketClient, payload).catch(logger.logError); // push to message queue later
    }

    async handleGetHistory(payload) {
        try {
            const history = await this.historyQuery.queryHistory(this.gameData.realPlayers[this.socketClient.id], payload.page);

            this.socketClient.emit(this.definition.name, history);
        } catch (err) {
            logger.logError(err);
        }
    }

    async handleDisconnect() {
        try {
            this.userDisconnectConsumer.consume(this.socketClient);
            this.socketClient.disconnect();
        } catch (err) {
            logger.logError(err);
        }
    }

    async handleRecheckin(payload) {
        await this.userRecheckinConsumer.consume(this.socketClient, payload).catch(logger.logError);
    }
}
